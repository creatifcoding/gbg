/**
 * HttpInner — internal request/response service for `HttpWire`.
 *
 * Responsibilities (per ARCHITECTURE.md §5 — *Wire impls compose internal *Inner services):
 *   - Build spec-compliant `HttpClientRequest` per Wire op (verb + path + headers)
 *   - Send via `HttpClient` with retry/backoff/abort
 *   - Parse spec response headers (`Stream-Next-Offset`, `Stream-Up-To-Date`,
 *     `Stream-Closed`, `Stream-Cursor`, `Producer-Epoch`, etc.)
 *   - Map HTTP status codes → typed errors per spec
 *   - Expose response body as `Stream<Uint8Array>`
 *
 * `HttpInner` does NOT know about op semantics (e.g. JSON framing, producer
 * dedup logic) — that's the wire layer above. `HttpInner` is the lowest
 * possible layer that still has Durable-Streams-spec knowledge.
 *
 * Not exported from the package barrel.
 *
 * @module @tmnl/lnk/services/wire/http/HttpInner
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Schedule from "effect-v4/Schedule"
import * as Stream from "effect-v4/Stream"

import * as HttpClient from "effect-v4/unstable/http/HttpClient"
import * as HttpClientRequest from "effect-v4/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect-v4/unstable/http/HttpClientResponse"

import {
  decodeRawDataPayload,
  decodeSseStream,
  SSE_CONTENT_TYPE,
} from "../Sse.js"
import { defaultPaths, type PathResolver } from "../Paths.js"

import { trust as trustOffset, type Offset } from "../../../contracts/Offset.js"
import {
  FetchError,
  InvalidPayloadError,
  RetentionDroppedError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"

// ─── Header constants (mirrors contracts/Headers.ts but lookup-shaped) ────

const H_NEXT_OFFSET = "Stream-Next-Offset"
const H_UP_TO_DATE = "Stream-Up-To-Date"
const H_CLOSED = "Stream-Closed"
const H_CURSOR = "Stream-Cursor"
const H_PRODUCER_ID = "Producer-Id"
const H_PRODUCER_EPOCH = "Producer-Epoch"
const H_PRODUCER_SEQ = "Producer-Seq"
const H_PRODUCER_EXPECTED_SEQ = "Producer-Expected-Seq"
const H_PRODUCER_RECEIVED_SEQ = "Producer-Received-Seq"
const H_CONTENT_TYPE = "Content-Type"
const H_STREAM_TTL = "Stream-TTL"
const H_STREAM_EXPIRES_AT = "Stream-Expires-At"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface SendInput {
  /** HTTP verb. */
  readonly method: "GET" | "PUT" | "POST" | "HEAD" | "DELETE"
  /** Path component appended to the configured baseUrl (e.g. `/streams/foo`). */
  readonly path: string
  /** Query parameters as `Record<string, string>`. Undefined values omitted. */
  readonly query?: Record<string, string | undefined>
  /** Request headers (canonical PascalCase keys). */
  readonly headers?: Record<string, string>
  /** Request body. */
  readonly body?: Uint8Array
}

export interface ParsedResponse {
  readonly status: number
  /** Raw response headers (case-insensitive lookup via web `Headers`). */
  readonly headers: globalThis.Headers
  readonly body: Stream.Stream<Uint8Array, FetchError, never>
  // Pre-parsed spec headers for ergonomics:
  readonly nextOffset: Option.Option<Offset>
  readonly upToDate: boolean
  readonly closed: boolean
  readonly cursor: Option.Option<string>
}

export interface HttpInnerShape {
  /** Raw send. Returns parsed response with body Stream. */
  readonly send: (input: SendInput) => Effect.Effect<ParsedResponse, FetchError>

  /** Send + map status to typed errors per spec. */
  readonly sendChecked: (input: SendInput) => Effect.Effect<
    ParsedResponse,
    | FetchError
    | InvalidPayloadError
    | StreamNotFoundError
    | StreamConfigMismatchError
    | StreamClosedError
    | StaleEpochError
    | SequenceGapError
    | RetentionDroppedError
  >
}

// ─── Configuration ──────────────────────────────────────────────────────────

export interface HttpInnerConfig {
  /** Base URL, e.g. "http://localhost:4437". No trailing slash. */
  readonly baseUrl: string
  /**
   * URL path resolver. Defaults to `/streams/<id>`. Override with
   * `v1Paths` (or `makePaths("/v1/stream/{id}")`) when talking to a
   * server that uses the `/v1/stream/<id>` convention (e.g. when running
   * the upstream conformance test suite).
   */
  readonly paths?: PathResolver
  /** Retry schedule for transient failures. Default: 3 retries with 100ms-1s exponential backoff. */
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown>
}

// Both = run an exponential backoff AND limit to 3 retries (intersection of
// schedule conditions). `Schedule.both` returns the more-restrictive of two,
// which is the standard "exponential capped at N retries" idiom.
const defaultRetrySchedule: Schedule.Schedule<unknown, unknown> = Schedule.both(
  Schedule.exponential("100 millis", 2),
  Schedule.recurs(3),
)

// ─── Response parsing helpers ───────────────────────────────────────────────

const parseSpec = (h: globalThis.Headers): {
  readonly nextOffset: Option.Option<Offset>
  readonly upToDate: boolean
  readonly closed: boolean
  readonly cursor: Option.Option<string>
} => {
  const next = h.get(H_NEXT_OFFSET)
  const upToDate = (h.get(H_UP_TO_DATE) ?? "").toLowerCase() === "true"
  const closed = (h.get(H_CLOSED) ?? "").toLowerCase() === "true"
  const cursor = h.get(H_CURSOR)
  return {
    nextOffset: next === null ? Option.none() : Option.some(trustOffset(next)),
    upToDate,
    closed,
    cursor: cursor === null ? Option.none() : Option.some(cursor),
  }
}

const buildUrl = (baseUrl: string, path: string, query?: SendInput["query"]): string => {
  const normalizedBase = baseUrl.replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  let url = `${normalizedBase}${normalizedPath}`
  if (query) {
    const params = Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    if (params.length > 0) url += `?${params.join("&")}`
  }
  return url
}

// ─── Service implementation ─────────────────────────────────────────────────

const make = (
  config: HttpInnerConfig,
): Effect.Effect<HttpInnerShape, never, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const retry = config.retrySchedule ?? defaultRetrySchedule
    const paths = config.paths ?? defaultPaths

    const send: HttpInnerShape["send"] = (input) =>
      Effect.gen(function* () {
        const url = buildUrl(config.baseUrl, input.path, input.query)
        const baseReq =
          input.method === "GET"
            ? HttpClientRequest.get(url)
            : input.method === "PUT"
              ? HttpClientRequest.put(url)
              : input.method === "POST"
                ? HttpClientRequest.post(url)
                : input.method === "HEAD"
                  ? HttpClientRequest.head(url)
                  : HttpClientRequest.delete(url)
        const withHeaders = input.headers
          ? HttpClientRequest.setHeaders(input.headers)(baseReq)
          : baseReq
        const withBody =
          input.body !== undefined
            ? HttpClientRequest.bodyUint8Array(input.body)(withHeaders)
            : withHeaders

        const response = yield* client.execute(withBody).pipe(
          Effect.retry(retry),
          Effect.mapError(
            (e) =>
              new FetchError({
                message:
                  e instanceof Error ? e.message : `request failed: ${String(e)}`,
                cause: e,
              }),
          ),
        )

        // Convert effect-v4 HttpClientResponse to our ParsedResponse shape.
        const r = response as HttpClientResponse.HttpClientResponse
        const respHeaders = new globalThis.Headers()
        for (const [k, v] of Object.entries(r.headers)) {
          respHeaders.set(k, v as string)
        }
        const spec = parseSpec(respHeaders)
        const ct = (respHeaders.get("content-type") ?? "").toLowerCase()
        // 204 / 304 have no body. v4's `r.stream` throws EmptyBodyError
        // if accessed; substitute Stream.empty.
        if (r.status === 204 || r.status === 304) {
          return {
            status: r.status,
            headers: respHeaders,
            body: Stream.empty,
            ...spec,
          } satisfies ParsedResponse
        }
        // SSE responses: parse the event-stream into Data + Control events,
        // assemble the final byte body + lift control-event metadata into
        // the spec headers so the rest of the wire layer treats it uniformly.
        if (ct.startsWith(SSE_CONTENT_TYPE)) {
          const sseDecoded = decodeSseStream(
            r.stream.pipe(
              Stream.mapError(() => undefined as never),
            ) as Stream.Stream<Uint8Array, never, never>,
          )
          // Realize all events synchronously into a Promise-shaped Effect.
          // (Phase 1.2 is single-shot SSE responses; Phase 2 will switch to
          // continuous streaming via the Lnk handle.)
          const all = yield* Stream.runCollect(sseDecoded).pipe(
            Effect.mapError(
              (e) =>
                new FetchError({
                  message:
                    e instanceof Error ? e.message : `SSE decode failed: ${String(e)}`,
                  cause: e,
                }),
            ),
          )
          // Extract control metadata from the FIRST control event we see.
          // Concatenate Data events into one body stream.
          const dataPieces: Uint8Array[] = []
          let controlNextOffset: string | undefined
          let controlCursor: string | undefined
          let controlUpToDate = false
          let controlClosed = false
          // For raw streams the data is base64; for JSON streams it's a
          // JSON-array string. We can't disambiguate from the SSE stream alone
          // without the stream's content-type — use a pragmatic check:
          // try base64-decode; fall back to UTF-8 if it round-trips as text.
          // (The Lnk handle in Phase 2 will distinguish properly via the
          // configured content-type carried alongside the Stream connection.)
          // Heuristic for distinguishing JSON-array vs base64 SSE data:
          // base64 charset is [A-Za-z0-9+/=]. JSON arrays contain `[`, `{`,
          // `:`, `,`, `"`, etc. which fall outside. (Phase 2 will replace
          // this heuristic with content-type carried alongside the connection.)
          const BASE64_CHARSET = /^[A-Za-z0-9+/=\s]*$/
          for (const ev of all) {
            if (ev._tag === "Data") {
              const looksLikeBase64 =
                ev.payload.length > 0 && BASE64_CHARSET.test(ev.payload)
              const bytes: Uint8Array = looksLikeBase64
                ? decodeRawDataPayload(ev.payload)
                : new TextEncoder().encode(ev.payload)
              dataPieces.push(bytes)
            } else if (ev._tag === "Control") {
              if (ev.payload.streamNextOffset !== undefined && controlNextOffset === undefined)
                controlNextOffset = ev.payload.streamNextOffset
              if (ev.payload.streamCursor !== undefined && controlCursor === undefined)
                controlCursor = ev.payload.streamCursor
              if (ev.payload.upToDate === true) controlUpToDate = true
              if (ev.payload.streamClosed === true) controlClosed = true
            }
          }
          // Lift control metadata into headers so downstream parseSpec works.
          if (controlNextOffset !== undefined)
            respHeaders.set("Stream-Next-Offset", controlNextOffset)
          if (controlCursor !== undefined)
            respHeaders.set("Stream-Cursor", controlCursor)
          if (controlUpToDate) respHeaders.set("Stream-Up-To-Date", "true")
          if (controlClosed) respHeaders.set("Stream-Closed", "true")
          const newSpec = parseSpec(respHeaders)
          // Concatenate body pieces into a single Stream.
          const body: Stream.Stream<Uint8Array, FetchError, never> =
            dataPieces.length === 0
              ? Stream.empty
              : Stream.fromIterable(dataPieces)
          return {
            status: r.status,
            headers: respHeaders,
            body,
            ...newSpec,
          } satisfies ParsedResponse
        }
        // Non-SSE: pass response.stream through with FetchError mapping.
        const body: Stream.Stream<Uint8Array, FetchError, never> = r.stream.pipe(
          Stream.mapError((e: unknown) =>
            new FetchError({
              message:
                e instanceof Error ? e.message : `body stream failed: ${String(e)}`,
              cause: e,
            }),
          ),
        )
        return {
          status: r.status,
          headers: respHeaders,
          body,
          ...spec,
        } satisfies ParsedResponse
      })

    /**
     * Map status codes per spec to typed errors.
     *   404 → StreamNotFoundError (path-derived streamId)
     *   409 → StreamConfigMismatchError | StreamClosedError | SequenceGapError
     *           (disambiguate via response headers)
     *   403 → StaleEpochError
     *   410 → RetentionDroppedError
     *   400 → InvalidPayloadError (we surface as FetchError for now)
     *   5xx → FetchError
     */
    const sendChecked: HttpInnerShape["sendChecked"] = (input) =>
      Effect.gen(function* () {
        const r = yield* send(input)
        const streamId = paths.parseStreamPath(input.path) ?? ""
        if (r.status >= 200 && r.status < 300) return r
        if (r.status === 404) {
          return yield* new StreamNotFoundError({ streamId })
        }
        if (r.status === 400) {
          // Per spec: 400 means malformed payload (invalid JSON, empty array).
          const ct = input.headers?.[H_CONTENT_TYPE] ?? ""
          return yield* new InvalidPayloadError({
            streamId,
            contentType: ct,
            reason: `400 Bad Request on ${input.method} ${input.path}`,
          })
        }
        if (r.status === 410) {
          const requestedOffset = input.query?.offset ?? "?"
          return yield* new RetentionDroppedError({
            streamId,
            requestedOffset,
            ...(r.headers.get("Stream-Oldest-Offset") !== null
              ? { oldestAvailableOffset: r.headers.get("Stream-Oldest-Offset")! }
              : {}),
          })
        }
        if (r.status === 403) {
          // Stale epoch
          const serverEpoch = Number(r.headers.get(H_PRODUCER_EPOCH) ?? "0")
          const ourEpoch = Number(input.headers?.[H_PRODUCER_EPOCH] ?? "0")
          const producerId = input.headers?.[H_PRODUCER_ID] ?? ""
          return yield* new StaleEpochError({
            streamId,
            producerId,
            ourEpoch,
            serverEpoch,
          })
        }
        if (r.status === 409) {
          // Discriminate by response headers per spec:
          //   Stream-Closed: true                  → StreamClosedError
          //   Stream-Expected-Content-Type        → StreamConfigMismatchError
          //   Producer-Expected-Seq + -Received-Seq → SequenceGapError
          if (r.closed) {
            return yield* new StreamClosedError({
              streamId,
              ...(Option.isSome(r.nextOffset)
                ? { lastOffset: r.nextOffset.value }
                : {}),
            })
          }
          const expected = r.headers.get("Stream-Expected-Content-Type")
          const received = input.headers?.[H_CONTENT_TYPE]
          if (expected && received) {
            return yield* new StreamConfigMismatchError({
              streamId,
              expectedContentType: expected,
              receivedContentType: received,
            })
          }
          const expectedSeq = r.headers.get(H_PRODUCER_EXPECTED_SEQ)
          const receivedSeq = r.headers.get(H_PRODUCER_RECEIVED_SEQ)
          if (expectedSeq !== null && receivedSeq !== null) {
            return yield* new SequenceGapError({
              streamId,
              producerId: input.headers?.[H_PRODUCER_ID] ?? "",
              expectedSeq: Number(expectedSeq),
              receivedSeq: Number(receivedSeq),
            })
          }
          // Default: bubble as FetchError.
          return yield* new FetchError({
            status: 409,
            message: `409 Conflict on ${input.method} ${input.path}`,
          })
        }
        // 4xx/5xx fallthrough.
        return yield* new FetchError({
          status: r.status,
          message: `${r.status} on ${input.method} ${input.path}`,
        })
      })

    return { send, sendChecked } satisfies HttpInnerShape
  })

// ─── Service tag + layer factory ────────────────────────────────────────────

export class HttpInner extends Context.Service<HttpInner, HttpInnerShape>()(
  "@tmnl/lnk/services/wire/http/HttpInner",
) {
  /** Layer factory — provide a config to get a Layer<HttpInner>. */
  static readonly layer = (
    config: HttpInnerConfig,
  ): Layer.Layer<HttpInner, never, HttpClient.HttpClient> =>
    Layer.effect(HttpInner, make(config))
}

// ─── Re-exported header constants for the wire layer ────────────────────────

export const HEADERS = {
  H_NEXT_OFFSET,
  H_UP_TO_DATE,
  H_CLOSED,
  H_CURSOR,
  H_PRODUCER_ID,
  H_PRODUCER_EPOCH,
  H_PRODUCER_SEQ,
  H_PRODUCER_EXPECTED_SEQ,
  H_PRODUCER_RECEIVED_SEQ,
  H_CONTENT_TYPE,
  H_STREAM_TTL,
  H_STREAM_EXPIRES_AT,
} as const
