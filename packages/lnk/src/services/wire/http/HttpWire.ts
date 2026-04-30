/**
 * HttpWire — `Layer<Wire>` backed by HTTP requests to a remote
 * Durable-Streams-spec server.
 *
 * Composes `HttpInner` (low-level fetch + spec header parsing) into the
 * public `Wire` shape. Translates each Wire op into a spec-compliant HTTP
 * request, parses spec response headers, and surfaces typed errors.
 *
 * # Op → HTTP mapping
 *
 *   put    → PUT /streams/<id> (Content-Type, optional Stream-TTL)
 *   post   → POST /streams/<id> (body, optional Producer-{Id,Epoch,Seq}, optional Stream-Closed)
 *   get    → GET /streams/<id>?offset=<...>&limit=<...>&live=<...>&timeout=<...>&cursor=<...>
 *   head   → HEAD /streams/<id>
 *   delete → DELETE /streams/<id>
 *
 * # Body framing
 *
 * `HttpWire` itself is content-type-agnostic — it ships request body bytes
 * verbatim and returns response body as a raw `Stream<Uint8Array>`. The
 * server is responsible for applying spec framing semantics (JSON array
 * flattening on POST, JSON-array body on GET) per the stream's content type.
 *
 * Consumers wanting client-side framing convenience (e.g. POST a JSON object
 * via a typed argument and have HttpWire JSON-encode it) compose that layer
 * above; HttpWire is the wire-fidelity primitive.
 *
 * @module @tmnl/lnk/services/wire/http/HttpWire
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import type * as Stream from "effect-v4/Stream"

import type * as HttpClient from "effect-v4/unstable/http/HttpClient"

import { trust as trustContentType } from "../../../contracts/ContentType.js"
import { Wire } from "../Wire.js"
import { defaultPaths } from "../Paths.js"
import { HttpInner, HEADERS, type HttpInnerConfig } from "./HttpInner.js"
import { FetchError } from "../../../contracts/errors.js"

// ─── Layer ──────────────────────────────────────────────────────────────────

export class HttpWire {
  /**
   * Layer factory — provide an `HttpInnerConfig` (baseUrl + retry schedule).
   *
   * Self-contained at the HTTP-level: provides `HttpInner` internally. Caller
   * must additionally provide an `HttpClient` (typically via
   * `FetchHttpClient.layer` from `effect-v4/unstable/http/FetchHttpClient`).
   *
   * @example
   * ```ts
   * import { Effect, Layer } from "effect-v4"
   * import * as FetchHttpClient from "effect-v4/unstable/http/FetchHttpClient"
   * import { Wire } from "@tmnl/lnk/services/wire"
   * import { HttpWire } from "@tmnl/lnk/services/wire/http"
   *
   * const program = Effect.gen(function*() {
   *   const wire = yield* Wire
   *   yield* wire.put({ streamId: ..., contentType: ... })
   * })
   *
   * Effect.runPromise(
   *   program.pipe(
   *     Effect.provide(HttpWire.layer({ baseUrl: "http://localhost:4437" })),
   *     Effect.provide(FetchHttpClient.layer),
   *   ),
   * )
   * ```
   */
  static readonly layer = (
    config: HttpInnerConfig,
  ): Layer.Layer<Wire, never, HttpClient.HttpClient> =>
    Layer.effect(
      Wire,
      Effect.gen(function* () {
        const inner = yield* HttpInner
        const paths = config.paths ?? defaultPaths

        return Wire.of({
          // ── put ────────────────────────────────────────────────────────────
          put: (input) =>
            Effect.gen(function* () {
              const headers: Record<string, string> = {
                [HEADERS.H_CONTENT_TYPE]: input.contentType as string,
                ...(input.streamTtl !== undefined
                  ? { [HEADERS.H_STREAM_TTL]: String(input.streamTtl) }
                  : {}),
                ...(input.streamExpiresAt !== undefined
                  ? { [HEADERS.H_STREAM_EXPIRES_AT]: input.streamExpiresAt }
                  : {}),
              }
              const r = yield* inner.sendChecked({
                method: "PUT",
                path: paths.streamPath(input.streamId as string),
                headers,
                ...(input.body !== undefined && input.body.length > 0
                  ? { body: input.body }
                  : {}),
              })
              return {
                streamId: input.streamId,
                contentType: input.contentType,
                created: r.status === 201,
                ...(Option.isSome(r.nextOffset)
                  ? { nextOffset: r.nextOffset.value }
                  : {}),
              }
            }).pipe(
              // PUT can yield FetchError or StreamConfigMismatchError per the
              // wire shape. Other tagged errors from sendChecked don't apply
              // to PUT — die on them as defects.
              Effect.catchTags({
                StreamNotFoundError: (e) => Effect.die(e),
                StreamClosedError: (e) => Effect.die(e),
                StaleEpochError: (e) => Effect.die(e),
                SequenceGapError: (e) => Effect.die(e),
                RetentionDroppedError: (e) => Effect.die(e),
              }),
            ),

          // ── post ───────────────────────────────────────────────────────────
          post: (input) =>
            Effect.gen(function* () {
              const headers: Record<string, string> = {
                ...(input.contentType !== undefined
                  ? { [HEADERS.H_CONTENT_TYPE]: input.contentType as string }
                  : {}),
                ...(input.producer !== undefined
                  ? {
                      [HEADERS.H_PRODUCER_ID]: input.producer.producerId as string,
                      [HEADERS.H_PRODUCER_EPOCH]: String(
                        input.producer.epoch as number,
                      ),
                      [HEADERS.H_PRODUCER_SEQ]: String(
                        input.producer.seq as number,
                      ),
                    }
                  : {}),
                ...(input.streamClosed === true
                  ? { [HEADERS.H_CLOSED]: "true" }
                  : {}),
              }
              const r = yield* inner.sendChecked({
                method: "POST",
                path: paths.streamPath(input.streamId as string),
                headers,
                body: input.body,
              })
              // Per spec POST status semantics:
              //   Producer-tracked + new      → 200 OK
              //   Producer-tracked + duplicate → 204 No Content
              //   Generic                     → 204 No Content
              // For producer-tracked requests, 204 means duplicate.
              const duplicate = input.producer !== undefined && r.status === 204
              if (Option.isNone(r.nextOffset)) {
                return yield* new FetchError({
                  status: r.status,
                  message: `protocol violation: missing Stream-Next-Offset on POST /streams/${input.streamId}`,
                })
              }
              return { nextOffset: r.nextOffset.value, duplicate }
            }).pipe(
              // POST can yield FetchError, StaleEpochError, SequenceGapError,
              // StreamClosedError, StreamNotFoundError, InvalidPayloadError.
              // Other tagged errors don't apply to POST — die on them.
              Effect.catchTags({
                RetentionDroppedError: (e) => Effect.die(e),
                StreamConfigMismatchError: (e) => Effect.die(e),
              }),
            ),

          // ── get ────────────────────────────────────────────────────────────
          get: (input) =>
            Effect.gen(function* () {
              const query: Record<string, string | undefined> = {
                offset: input.position as string,
                ...(input.limit !== undefined ? { limit: String(input.limit) } : {}),
                ...(input.live !== undefined ? { live: input.live } : {}),
                ...(input.timeout !== undefined
                  ? { timeout: String(input.timeout) }
                  : {}),
                ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
              }
              const r = yield* inner.sendChecked({
                method: "GET",
                path: paths.streamPath(input.streamId as string),
                query,
              })
              return {
                body: r.body as Stream.Stream<Uint8Array, FetchError, never>,
                ...(Option.isSome(r.nextOffset)
                  ? { nextOffset: r.nextOffset.value }
                  : {}),
                upToDate: r.upToDate,
                closed: r.closed,
                ...(Option.isSome(r.cursor) ? { cursor: r.cursor.value } : {}),
              }
            }).pipe(
              Effect.catchTags({
                StreamConfigMismatchError: (e) => Effect.die(e),
                StreamClosedError: (e) => Effect.die(e),
                StaleEpochError: (e) => Effect.die(e),
              }),
            ),

          // ── head ───────────────────────────────────────────────────────────
          head: (input) =>
            Effect.gen(function* () {
              const r = yield* inner.sendChecked({
                method: "HEAD",
                path: paths.streamPath(input.streamId as string),
              })
              const ct = r.headers.get(HEADERS.H_CONTENT_TYPE)
              return {
                ...(ct !== null ? { contentType: trustContentType(ct) } : {}),
                ...(Option.isSome(r.nextOffset)
                  ? { nextOffset: r.nextOffset.value }
                  : {}),
                closed: r.closed,
              }
            }).pipe(
              Effect.catchTags({
                StreamConfigMismatchError: (e) => Effect.die(e),
                StreamClosedError: (e) => Effect.die(e),
                StaleEpochError: (e) => Effect.die(e),
                RetentionDroppedError: (e) => Effect.die(e),
              }),
            ),

          // ── delete ─────────────────────────────────────────────────────────
          delete: (input) =>
            Effect.gen(function* () {
              const r = yield* inner.send({
                method: "DELETE",
                path: paths.streamPath(input.streamId as string),
              })
              // 200/204 → deleted; 404 → not found, return deleted:false per
              // our service's contract (consistent with InMemoryWire.delete).
              if (r.status === 404) return { deleted: false }
              if (r.status >= 200 && r.status < 300) return { deleted: true }
              // Any other status: surface as FetchError.
              return yield* Effect.fail(
                ((): FetchError =>
                  ({} as FetchError))(),
              )
            }),
        })
      }),
    ).pipe(Layer.provide(HttpInner.layer(config)))
}
