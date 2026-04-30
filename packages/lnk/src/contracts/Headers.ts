/**
 * Headers — Durable Streams wire headers.
 *
 * Per spec, the protocol's control-plane metadata travels in HTTP headers,
 * not in response bodies. This module defines:
 *
 *   1. Canonical header-name constants.
 *   2. Parsers (`Effect.fn` traced) that extract typed values from a
 *      `HeaderSource` (web `Headers`, fetch `Response.headers`, etc.).
 *   3. Serializers that produce string-keyed records suitable for handing to
 *      `fetch`'s `headers` option or `HttpClient`'s request builder.
 *
 * All parsers follow the same shape:
 *   - `parseX(source)`           → succeeds with typed value, fails with `InvalidHeaderError`
 *                                  if header is missing
 *   - `parseXOptional(source)`   → succeeds with `Option<T>` (None if missing), fails only on
 *                                  malformed value
 *
 * @module @tmnl/lnk/contracts/Headers
 */

import * as Effect from "effect-v4/Effect"
import * as Option from "effect-v4/Option"
import { Offset, type Offset as OffsetT, trust as trustOffset } from "./Offset.js"
import {
  Epoch,
  ProducerId,
  Seq,
  trustProducerId,
  type Epoch as EpochT,
  type ProducerId as ProducerIdT,
  type Seq as SeqT,
} from "./Producer.js"
import { ContentType, type ContentType as ContentTypeT, trust as trustContentType } from "./ContentType.js"
import { InvalidHeaderError } from "./errors.js"

// ─── Header name constants ──────────────────────────────────────────────────
// Names follow the spec's PascalCase-with-hyphens form.
// Header lookups are case-insensitive at the wire (per RFC 7230 §3.2),
// but we use the canonical casing in our own emitted headers for clarity.

/** `Stream-Next-Offset` — response header; offset to use for the next read. */
export const STREAM_NEXT_OFFSET = "Stream-Next-Offset" as const

/** `Stream-Up-To-Date` — response header; literal `"true"` when caught up. */
export const STREAM_UP_TO_DATE = "Stream-Up-To-Date" as const

/** `Stream-Closed` — header (req or resp); literal `"true"` to close / signal closure. */
export const STREAM_CLOSED = "Stream-Closed" as const

/**
 * `Stream-Cursor` — opaque cursor for CDN request-collapsing in live modes.
 * Echoed by clients; required from servers in live mode when stream is open.
 */
export const STREAM_CURSOR = "Stream-Cursor" as const

/**
 * `Stream-TTL` — request header (PUT); time-to-live for stream metadata in seconds.
 * Server-supported on stream creation.
 */
export const STREAM_TTL = "Stream-TTL" as const

/**
 * `Stream-Expires-At` — request header (PUT); explicit expiration time
 * (Unix seconds or ISO-8601, server-defined).
 */
export const STREAM_EXPIRES_AT = "Stream-Expires-At" as const

/** `Producer-Id` — write idempotency: stable producer identifier. */
export const PRODUCER_ID = "Producer-Id" as const

/** `Producer-Epoch` — write idempotency: epoch (incremented on `restart()`). */
export const PRODUCER_EPOCH = "Producer-Epoch" as const

/** `Producer-Seq` — write idempotency: monotonic seq within `(producerId, epoch)`. */
export const PRODUCER_SEQ = "Producer-Seq" as const

/** `Content-Type` — framing mode driver. */
export const CONTENT_TYPE = "Content-Type" as const

/** All canonical header names known to this contract. */
export const ALL_HEADERS = [
  STREAM_NEXT_OFFSET,
  STREAM_UP_TO_DATE,
  STREAM_CLOSED,
  STREAM_CURSOR,
  STREAM_TTL,
  STREAM_EXPIRES_AT,
  PRODUCER_ID,
  PRODUCER_EPOCH,
  PRODUCER_SEQ,
  CONTENT_TYPE,
] as const
export type HeaderName = (typeof ALL_HEADERS)[number]

// ─── HeaderSource — minimal interface satisfied by all platforms ────────────

/**
 * Minimal `HeaderSource` interface.
 *
 * Satisfied by:
 *   - `Headers` (web/fetch)
 *   - `Response.headers` (fetch)
 *   - `Request.headers` (fetch)
 *   - effect-v4's `HttpClientResponse.headers` (lowercased keys; case-insensitive `.get`)
 *
 * `get(name)` returns the value or `null` if absent.
 */
export interface HeaderSource {
  readonly get: (name: string) => string | null
}

// ─── Internal helper: case-insensitive header lookup ────────────────────────

/**
 * Returns the value of the named header, or `null` if absent.
 *
 * Works with `Headers.get` (which is case-insensitive per spec) and with
 * plain `Record<string, string>`-shaped sources via the same name.
 */
const getHeader = (source: HeaderSource, name: string): string | null =>
  source.get(name)

// ─── Stream-Next-Offset ─────────────────────────────────────────────────────

/**
 * Parse the `Stream-Next-Offset` response header. Required.
 *
 * Offsets are opaque; this `trust`s the server's value without further
 * validation. Fails with `InvalidHeaderError` only when the header is missing.
 */
export const parseStreamNextOffset = Effect.fn(
  "@tmnl/lnk/Headers.parseStreamNextOffset",
)(function* (source: HeaderSource) {
  const v = getHeader(source, STREAM_NEXT_OFFSET)
  if (v === null) {
    return yield* new InvalidHeaderError({
      name: STREAM_NEXT_OFFSET,
      reason: "missing",
    })
  }
  return trustOffset(v)
})

/** Optional variant: returns `Option<Offset>` (None if missing). */
export const parseStreamNextOffsetOptional = Effect.fn(
  "@tmnl/lnk/Headers.parseStreamNextOffsetOptional",
)(function* (source: HeaderSource) {
  const v = getHeader(source, STREAM_NEXT_OFFSET)
  return v === null ? Option.none<OffsetT>() : Option.some(trustOffset(v))
})

// ─── Stream-Up-To-Date ──────────────────────────────────────────────────────

/**
 * Parse the `Stream-Up-To-Date` response header.
 *
 * Per spec, this header's *presence* with the value `"true"` means the
 * response includes all data available at the time of the request. Any other
 * value (including absent) means catch-up is still in progress.
 */
export const parseStreamUpToDate = Effect.fn(
  "@tmnl/lnk/Headers.parseStreamUpToDate",
)(function* (source: HeaderSource) {
  const v = getHeader(source, STREAM_UP_TO_DATE)
  return v !== null && v.toLowerCase() === "true"
})

// ─── Stream-Closed ──────────────────────────────────────────────────────────

/**
 * Parse the `Stream-Closed` header.
 *
 * Per spec: presence with value `"true"` means the stream is permanently
 * finished and no more data will arrive. Used both as request header (POST
 * with `Stream-Closed: true` to close) and response header (informing
 * clients that the stream has been closed).
 */
export const parseStreamClosed = Effect.fn(
  "@tmnl/lnk/Headers.parseStreamClosed",
)(function* (source: HeaderSource) {
  const v = getHeader(source, STREAM_CLOSED)
  return v !== null && v.toLowerCase() === "true"
})

// ─── Stream-Cursor ──────────────────────────────────────────────────────────

/**
 * Parse the `Stream-Cursor` header (opaque CDN request-collapsing cursor).
 *
 * Returns `Option<string>` — present in live-mode responses when the stream
 * is open; absent in catch-up mode and for closed streams.
 */
export const parseStreamCursor = Effect.fn(
  "@tmnl/lnk/Headers.parseStreamCursor",
)(function* (source: HeaderSource) {
  const v = getHeader(source, STREAM_CURSOR)
  return v === null ? Option.none<string>() : Option.some(v)
})

// ─── Producer-Id / Epoch / Seq (request side) ───────────────────────────────

/**
 * Parse all three producer-idempotency headers as a tuple.
 *
 * All three are required together for idempotent writes per spec. If any
 * are missing, returns `Option.none` for the whole tuple. If all are
 * present but malformed (non-integer epoch/seq), fails with
 * `InvalidHeaderError`.
 */
export const parseProducerHeaders = Effect.fn(
  "@tmnl/lnk/Headers.parseProducerHeaders",
)(function* (source: HeaderSource) {
  const id = getHeader(source, PRODUCER_ID)
  const epochRaw = getHeader(source, PRODUCER_EPOCH)
  const seqRaw = getHeader(source, PRODUCER_SEQ)

  // All-or-nothing: any missing → None.
  if (id === null && epochRaw === null && seqRaw === null) {
    return Option.none<{
      readonly producerId: ProducerIdT
      readonly epoch: EpochT
      readonly seq: SeqT
    }>()
  }
  if (id === null || epochRaw === null || seqRaw === null) {
    return yield* new InvalidHeaderError({
      name: "Producer-{Id,Epoch,Seq}",
      reason: "partial-tuple",
    })
  }

  const epoch = Number(epochRaw)
  if (!Number.isInteger(epoch) || epoch < 0) {
    return yield* new InvalidHeaderError({
      name: PRODUCER_EPOCH,
      value: epochRaw,
      reason: "expected-non-negative-integer",
    })
  }

  const seq = Number(seqRaw)
  if (!Number.isInteger(seq) || seq < 0) {
    return yield* new InvalidHeaderError({
      name: PRODUCER_SEQ,
      value: seqRaw,
      reason: "expected-non-negative-integer",
    })
  }

  return Option.some({
    producerId: trustProducerId(id),
    epoch: epoch as EpochT,
    seq: seq as SeqT,
  })
})

// ─── Content-Type ───────────────────────────────────────────────────────────

/**
 * Parse the `Content-Type` header. Required when set on stream creation.
 *
 * Returns `Option<ContentType>` — None when absent. Does NOT validate the
 * MIME structure here; use `ContentType.parseContentType` for that. This
 * parser exists to extract the raw value for downstream framing decisions.
 */
export const parseContentTypeHeader = Effect.fn(
  "@tmnl/lnk/Headers.parseContentType",
)(function* (source: HeaderSource) {
  const v = getHeader(source, CONTENT_TYPE)
  return v === null ? Option.none<ContentTypeT>() : Option.some(trustContentType(v))
})

// ─── Serializers ────────────────────────────────────────────────────────────

/**
 * Compose a `Record<string, string>` of producer-idempotency headers
 * suitable for handing to `fetch` or `HttpClient`.
 */
export const producerHeaders = (input: {
  readonly producerId: ProducerIdT
  readonly epoch: EpochT
  readonly seq: SeqT
}): Record<string, string> => ({
  [PRODUCER_ID]: input.producerId as string,
  [PRODUCER_EPOCH]: String(input.epoch as number),
  [PRODUCER_SEQ]: String(input.seq as number),
})

/** `Stream-Closed: true` request header. */
export const streamClosedHeader = (): Record<string, string> => ({
  [STREAM_CLOSED]: "true",
})

/** `Stream-Cursor: <value>` request header (echo back to enable CDN collapsing). */
export const streamCursorHeader = (cursor: string): Record<string, string> => ({
  [STREAM_CURSOR]: cursor,
})

/** `Content-Type: <value>` request header. */
export const contentTypeHeader = (
  ct: ContentTypeT | string,
): Record<string, string> => ({
  [CONTENT_TYPE]: ct as string,
})

/** `Stream-TTL: <seconds>` request header (PUT only). */
export const streamTtlHeader = (seconds: number): Record<string, string> => ({
  [STREAM_TTL]: String(seconds),
})

/** `Stream-Expires-At: <value>` request header (PUT only). */
export const streamExpiresAtHeader = (value: string): Record<string, string> => ({
  [STREAM_EXPIRES_AT]: value,
})

// ─── Re-exports for convenience ─────────────────────────────────────────────

export type { OffsetT as Offset, EpochT as Epoch, ProducerIdT as ProducerId, SeqT as Seq, ContentTypeT as ContentType }
export { Offset as OffsetSchema, Epoch as EpochSchema, ProducerId as ProducerIdSchema, Seq as SeqSchema, ContentType as ContentTypeSchema }
