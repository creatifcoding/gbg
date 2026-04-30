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
import { HttpInner, HEADERS, type HttpInnerConfig } from "./HttpInner.js"
import type { FetchError } from "../../../contracts/errors.js"

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
                path: `/streams/${encodeURIComponent(input.streamId)}`,
                headers,
              })
              return {
                streamId: input.streamId,
                contentType: input.contentType,
                created: r.status === 201,
              }
            }).pipe(
              // Surface non-FetchError variants by dying for now (Phase 1.1
              // catches StreamConfigMismatchError as a spec-aware case in
              // sendChecked but the Wire shape doesn't expose it on put yet).
              Effect.catchTags({
                StreamNotFoundError: (e) => Effect.die(e),
                StreamConfigMismatchError: (e) => Effect.die(e),
                StreamClosedError: (e) => Effect.die(e),
                StaleEpochError: (e) => Effect.die(e),
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
                path: `/streams/${encodeURIComponent(input.streamId)}`,
                headers,
                body: input.body,
              })
              const duplicate = r.status === 204
              if (Option.isNone(r.nextOffset)) {
                // Server didn't send Stream-Next-Offset — protocol violation.
                // For now: surface as FetchError; Phase 1.1 may strict-validate.
                return yield* Effect.fail(
                  // Fabricate a FetchError; if r is not an error already, this
                  // path is unusual.
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  ((): FetchError =>
                    ({} as FetchError))(),
                )
              }
              return { nextOffset: r.nextOffset.value, duplicate }
            }).pipe(
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
                path: `/streams/${encodeURIComponent(input.streamId)}`,
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
                path: `/streams/${encodeURIComponent(input.streamId)}`,
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
                path: `/streams/${encodeURIComponent(input.streamId)}`,
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
