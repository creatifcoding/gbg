/**
 * Lnk HTTP routes — Layer-shaped, composes onto a shared `HttpRouter`.
 *
 * This is the production counterpart to the test-only `_spec-server.ts`
 * which serves the same surface over `node:http` for conformance
 * testing. By exposing the routes as a Layer, we can compose them
 * onto a single `HttpRouter` alongside other protocol routes (e.g.
 * `@tmnl/pct/server` Routes) for multi-protocol single-host deployment.
 *
 * # Endpoints (Phase 1.4 minimum, sufficient for the bedside-vitals tracer)
 *
 *   - `PUT  /streams/:streamId`   — register/create a stream (with content-type
 *                                    + optional initial body + ttl/expires/closed)
 *   - `POST /streams/:streamId`   — append a message
 *                                    (with optional Producer-* headers for
 *                                     idempotent producer tracking)
 *   - `GET  /streams/:streamId`   — read from a position. Supports:
 *                                    `?offset=...&limit=...&live=long-poll|sse`
 *
 * # Deferred (Phase 1.5+)
 *
 *   - HEAD /streams/:streamId    — metadata-only (covered by spec-server)
 *   - DELETE /streams/:streamId  — remove (covered by spec-server)
 *   - Full SSE/long-poll keepalive semantics
 *
 * The spec-server (`test/services/wire/http/_spec-server.ts`) remains
 * the conformance test driver. This Layer is the production wire.
 *
 * @module @tmnl/lnk/services/wire/http/HttpRoutes
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"

import * as ContentType from "../../../contracts/ContentType.js"
import * as Headers from "../../../contracts/Headers.js"
import * as StreamId from "../../../contracts/StreamId.js"
import { Wire } from "../Wire.js"

// ─── Header source adapter ──────────────────────────────────────────────────

/**
 * Build a `HeaderSource` from an `HttpServerRequest`. Header lookups
 * are case-insensitive; the parser modules expect this.
 */
const headerSourceFor = (
  request: HttpServerRequest.HttpServerRequest,
): Headers.HeaderSource => ({
  get: (name) => {
    const v = request.headers[name.toLowerCase()]
    if (v === undefined) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
  },
})

// ─── Path-param helper ──────────────────────────────────────────────────────

const getStreamIdParam = Effect.gen(function* () {
  const params = yield* HttpRouter.params
  const raw = params.streamId
  if (raw === undefined || raw === "") return null
  return StreamId.trust(decodeURIComponent(raw))
})

// ─── Generic error → JSON response helper ───────────────────────────────────

const errorResponse = (
  status: number,
  message: string,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ error: { message } }, { status })

// ─── PUT /streams/:streamId ─────────────────────────────────────────────────

const putHandler = Effect.gen(function* () {
  const streamId = yield* getStreamIdParam
  if (streamId === null) {
    return errorResponse(400, "missing or empty streamId path parameter")
  }
  const request = yield* HttpServerRequest.HttpServerRequest
  const headerSource = headerSourceFor(request)

  // Parse headers via the contract-level parsers
  const ctOpt = yield* Headers.parseContentTypeHeader(headerSource)
  const ct = Option.isSome(ctOpt)
    ? (ctOpt.value as string)
    : "application/octet-stream"
  const ttlOrExpires = yield* Headers.parseStreamTtlOrExpiresAt(headerSource)
  const streamClosed = yield* Headers.parseStreamClosed(headerSource)
  const schemaIdOpt = yield* Headers.parseSchemaId(headerSource)

  // Body (optional initial append)
  const bodyArr = yield* request.arrayBuffer.pipe(
    Effect.catchCause(() => Effect.succeed(new ArrayBuffer(0))),
  )
  const body = new Uint8Array(bodyArr)

  const wire = yield* Wire
  const out = yield* wire.put({
    streamId,
    contentType: ContentType.trust(ct),
    ...(Option.isSome(ttlOrExpires.ttl)
      ? { streamTtl: ttlOrExpires.ttl.value }
      : {}),
    ...(Option.isSome(ttlOrExpires.expiresAt)
      ? { streamExpiresAt: ttlOrExpires.expiresAt.value }
      : {}),
    ...(streamClosed ? { streamClosed: true } : {}),
    ...(Option.isSome(schemaIdOpt) ? { schemaId: schemaIdOpt.value } : {}),
    ...(body.length > 0 ? { body } : {}),
  })

  // Per spec: 201 on creation includes Location header pointing at canonical resource.
  const host = headerSource.get("host") ?? "localhost"
  const url = new URL(request.url, `http://${host}`)

  const headers: Record<string, string> = {
    "Content-Type": String(out.contentType),
  }
  if (out.nextOffset !== undefined) {
    headers[Headers.STREAM_NEXT_OFFSET] = String(out.nextOffset)
  }
  if (out.closed) headers[Headers.STREAM_CLOSED] = "true"
  if (out.created) headers["Location"] = `http://${host}${url.pathname}`

  return HttpServerResponse.empty({
    status: out.created ? 201 : 200,
    headers,
  })
}).pipe(
  Effect.catchTag("InvalidHeaderError", (err) =>
    Effect.succeed(errorResponse(400, String(err))),
  ),
  Effect.catchTag("StreamConfigMismatchError", (err) =>
    Effect.succeed(errorResponse(409, String(err))),
  ),
  Effect.catchCause(() => Effect.succeed(errorResponse(500, "internal error"))),
)

// ─── POST /streams/:streamId ────────────────────────────────────────────────

const postHandler = Effect.gen(function* () {
  const streamId = yield* getStreamIdParam
  if (streamId === null) {
    return errorResponse(400, "missing or empty streamId path parameter")
  }
  const request = yield* HttpServerRequest.HttpServerRequest
  const headerSource = headerSourceFor(request)

  const bodyArr = yield* request.arrayBuffer.pipe(
    Effect.catchCause(() => Effect.succeed(new ArrayBuffer(0))),
  )
  const body = new Uint8Array(bodyArr)

  const ctOpt = yield* Headers.parseContentTypeHeader(headerSource)
  const producerOpt = yield* Headers.parseProducerHeaders(headerSource)
  const streamSeqOpt = yield* Headers.parseStreamSeq(headerSource)
  const closed = yield* Headers.parseStreamClosed(headerSource)

  const ct = Option.getOrUndefined(ctOpt) as string | undefined

  // Per spec: POSTs MUST carry Content-Type unless close-only (empty body + Stream-Closed).
  if (ct === undefined && !(closed && body.length === 0)) {
    return errorResponse(400, "missing Content-Type on POST")
  }

  const producer = Option.getOrUndefined(producerOpt)
  const streamSeq = Option.getOrUndefined(streamSeqOpt)

  const wire = yield* Wire
  const out = yield* wire.post({
    streamId,
    body,
    ...(ct !== undefined ? { contentType: ContentType.trust(ct) } : {}),
    ...(producer !== undefined ? { producer } : {}),
    ...(streamSeq !== undefined && streamSeq !== "" ? { streamSeq } : {}),
    ...(closed ? { streamClosed: true } : {}),
  })

  const headers: Record<string, string> = {
    [Headers.STREAM_NEXT_OFFSET]: String(out.nextOffset),
  }
  if (producer !== undefined) {
    headers[Headers.PRODUCER_ID] = String(producer.producerId)
    headers[Headers.PRODUCER_EPOCH] = String(
      out.producerEpoch !== undefined ? out.producerEpoch : producer.epoch,
    )
    headers[Headers.PRODUCER_SEQ] = String(
      out.producerSeq !== undefined ? out.producerSeq : producer.seq,
    )
  }
  if (out.closed) headers[Headers.STREAM_CLOSED] = "true"

  // Status: producer-tracked + body present → 200/204 (dup), else 204
  const status =
    producer !== undefined && body.length > 0
      ? out.duplicate
        ? 204
        : 200
      : 204

  return HttpServerResponse.empty({ status, headers })
}).pipe(
  Effect.catchTag("InvalidHeaderError", (err) =>
    Effect.succeed(errorResponse(400, String(err))),
  ),
  Effect.catchTag("StreamNotFoundError", (err) =>
    Effect.succeed(errorResponse(404, String(err))),
  ),
  Effect.catchTag("StreamClosedError", (err) =>
    Effect.succeed(errorResponse(409, String(err))),
  ),
  Effect.catchTag("StaleEpochError", (err) =>
    Effect.succeed(errorResponse(409, String(err))),
  ),
  Effect.catchTag("SequenceGapError", (err) =>
    Effect.succeed(errorResponse(409, String(err))),
  ),
  Effect.catchCause(() => Effect.succeed(errorResponse(500, "internal error"))),
)

// ─── GET /streams/:streamId ─────────────────────────────────────────────────

const getHandler = Effect.gen(function* () {
  const streamId = yield* getStreamIdParam
  if (streamId === null) {
    return errorResponse(400, "missing or empty streamId path parameter")
  }
  const request = yield* HttpServerRequest.HttpServerRequest
  const url = new URL(
    request.url,
    `http://${headerSourceFor(request).get("host") ?? "localhost"}`,
  )

  const offsetParams = url.searchParams.getAll("offset")
  if (offsetParams.length > 1) {
    return errorResponse(400, "multiple offset parameters")
  }
  const rawOffset = url.searchParams.get("offset")
  const offsetParam = rawOffset ?? "-1"
  const limitParam = url.searchParams.get("limit")
  const liveParam = url.searchParams.get("live")
  const liveMode =
    liveParam === "long-poll" || liveParam === "sse" ? liveParam : undefined

  if (liveMode !== undefined && rawOffset === null) {
    return errorResponse(400, `${liveMode} mode requires offset parameter`)
  }

  const wire = yield* Wire

  // Get stream metadata for content-type framing. Absence isn't fatal
  // (we'll just omit the Content-Type response header).
  const metaResult = yield* Effect.result(wire.head({ streamId }))
  const metaCt =
    metaResult._tag === "Success"
      ? (metaResult.success.contentType as string | undefined)
      : undefined

  const out = yield* Effect.scoped(
    wire.get({
      streamId,
      position: offsetParam as never,
      ...(limitParam !== null ? { limit: Number(limitParam) } : {}),
      ...(liveMode !== undefined ? { live: liveMode } : {}),
    }),
  )

  // Realize body to bytes (full streaming response lands in Phase 1.5).
  const bodyStream = out.body as Stream.Stream<Uint8Array, never, never>
  const collected = yield* Stream.runCollect(bodyStream)
  const chunks = Array.from(collected as Iterable<Uint8Array>)
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const combined = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    combined.set(c, off)
    off += c.length
  }

  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    [Headers.STREAM_NEXT_OFFSET]: String(out.nextOffset ?? "-"),
  }
  if (out.upToDate) headers[Headers.STREAM_UP_TO_DATE] = "true"
  if (out.closed) headers[Headers.STREAM_CLOSED] = "true"
  if (metaCt !== undefined) headers["Content-Type"] = metaCt

  // Empty + long-poll = 204 (timeout); empty + non-live = 200 (caught up)
  if (total === 0) {
    return HttpServerResponse.empty({
      status: liveMode === "long-poll" ? 204 : 200,
      headers,
    })
  }

  return HttpServerResponse.uint8Array(combined, { status: 200, headers })
}).pipe(
  Effect.catchTag("StreamNotFoundError", (err) =>
    Effect.succeed(errorResponse(404, String(err))),
  ),
  Effect.catchTag("RetentionDroppedError", (err) =>
    Effect.succeed(errorResponse(410, String(err))),
  ),
  Effect.catchTag("InvalidOffsetError", (err) =>
    Effect.succeed(errorResponse(400, String(err))),
  ),
  Effect.catchCause(() => Effect.succeed(errorResponse(500, "internal error"))),
)

// ─── Routes Layer ───────────────────────────────────────────────────────────

/**
 * The Lnk routes Layer. Adds PUT/POST/GET to whatever `HttpRouter` is
 * in scope. Composes alongside `@tmnl/pct/server`'s `Routes` to host
 * both protocols on a single HTTP server.
 *
 * Requires (in addition to HttpRouter): `Wire` — the Lnk wire service
 * that backs the actual stream operations.
 *
 * Path namespace: `/streams/:streamId`. PCT uses `/capabilities`,
 * `/schemas/*`, `/publish` — no collision.
 *
 * @example Composing with PCT routes
 * ```ts
 * import { HttpLayerRouter } from "@effect/platform"
 * import * as Pact from "@tmnl/pct"
 * import * as Lnk from "@tmnl/lnk"
 *
 * const App = HttpLayerRouter.serve(
 *   Layer.mergeAll(Pact.Server.Routes, Lnk.HttpRoutes),
 * ).pipe(
 *   // ... provide deps
 * )
 * ```
 */
// ─── HEAD /streams/:streamId ───────────────────────────────────────────

/**
 * Stream metadata-only query. Echoes the producer-supplied
 * `Schema-Id`, the stream's `Content-Type`, the next-offset cursor,
 * and the closed state. Consumed by `Wire.head(streamId)` which
 * feeds `Lnks.connectTyped(streamId)` auto-resolution.
 */
const headHandler = Effect.gen(function* () {
  const streamId = yield* getStreamIdParam
  if (streamId === null) {
    return errorResponse(400, "missing or empty streamId path parameter")
  }
  const wire = yield* Wire
  const out = yield* wire.head({ streamId })

  const headers: Record<string, string> = {}
  if (out.contentType !== undefined) headers["Content-Type"] = String(out.contentType)
  if (out.nextOffset !== undefined)
    headers[Headers.STREAM_NEXT_OFFSET] = String(out.nextOffset)
  if (out.closed) headers[Headers.STREAM_CLOSED] = "true"
  if (out.schemaId !== undefined) headers[Headers.SCHEMA_ID] = String(out.schemaId)
  // Optional ttl/expiresAt echoes — present when configured
  if ((out as { ttl?: number }).ttl !== undefined)
    headers[Headers.STREAM_TTL] = String((out as { ttl?: number }).ttl)
  if ((out as { expiresAt?: string }).expiresAt !== undefined)
    headers[Headers.STREAM_EXPIRES_AT] = String(
      (out as { expiresAt?: string }).expiresAt,
    )

  return HttpServerResponse.empty({ status: 200, headers })
}).pipe(
  Effect.catchTag("StreamNotFoundError", (err) =>
    Effect.succeed(errorResponse(404, String(err))),
  ),
  Effect.catchCause(() =>
    Effect.succeed(errorResponse(500, "internal error")),
  ),
)

export const Routes = HttpRouter.addAll([
  HttpRouter.route("PUT", "/streams/:streamId", putHandler),
  HttpRouter.route("POST", "/streams/:streamId", postHandler),
  HttpRouter.route("GET", "/streams/:streamId", getHandler),
  HttpRouter.route("HEAD", "/streams/:streamId", headHandler),
])
