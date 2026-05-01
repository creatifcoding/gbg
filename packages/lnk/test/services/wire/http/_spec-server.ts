/**
 * Node `http`-based Durable Streams spec server, backed by an `InMemoryWire`.
 *
 * Test-only utility. Translates HTTP requests into `Wire` service calls and
 * formats `Wire` responses as spec-compliant HTTP responses. The inverse of
 * `HttpWire` (which is the client-side translator).
 *
 * # Why node:http (and not @effect/platform-bun)?
 *
 * `@effect/platform-bun@4.0.0-beta.59` exists on npm but installing it into
 * this monorepo is currently blocked by an unrelated workspace resolution
 * issue (`@tmnl/codemode` missing). For Phase 1.1 conformance testing we
 * just need a port-bound HTTP server running our Wire — `node:http` works
 * cross-runtime (Bun supports it natively) and avoids the platform-bun
 * dep. When that install issue is resolved, this file can be replaced by a
 * `BunHttpServer.layer` Layer + `HttpRouter`-based handlers without any
 * public-API change.
 *
 * @module @tmnl/lnk/test/services/wire/http/_spec-server
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http"
import { AddressInfo } from "node:net"

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Stream from "effect-v4/Stream"
import * as ManagedRuntime from "effect-v4/ManagedRuntime"

import { Wire } from "../../../../src/services/wire/index.js"
import { InMemoryWire } from "../../../../src/services/wire/in-memory/index.js"
import {
  encodeControl,
  encodeDataAndControl,
  encodeRawDataPayload,
  SSE_CONTENT_TYPE,
  type ControlPayload,
} from "../../../../src/services/wire/Sse.js"
import { defaultPaths, type PathResolver } from "../../../../src/services/wire/Paths.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import {
  trustProducerId,
  trustEpoch,
  trustSeq,
} from "../../../../src/contracts/Producer.js"

export interface SpecServerHandle {
  readonly baseUrl: string
  readonly port: number
  readonly server: Server
  readonly runtime: ManagedRuntime.ManagedRuntime<Wire, never>
}

export interface SpecServerOptions {
  /**
   * Path resolver used to extract streamIds from request URLs. Default:
   * `/streams/<id>` (matches our internal HttpWire client's defaults).
   * Use `v1Paths` (or `makePaths("/v1/stream/{id}")`) when running the
   * upstream conformance suite, which uses `/v1/stream/<id>`.
   */
  readonly paths?: PathResolver
}

// ─── HTTP helpers ───────────────────────────────────────────────────────────

const readRequestBody = (req: IncomingMessage): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))))
    req.on("error", reject)
  })

const writeResponse = (
  res: ServerResponse,
  status: number,
  headers: Record<string, string>,
  body?: Uint8Array,
): void => {
  res.writeHead(status, headers)
  if (body && body.length > 0) res.write(body)
  res.end()
}

const errorResponse = (res: ServerResponse, status: number, message?: string): void =>
  writeResponse(res, status, {}, message ? new TextEncoder().encode(message) : undefined)

// ─── Wire op → HTTP response builders ───────────────────────────────────────

const buildPutResponse = (
  res: ServerResponse,
  out: { created: boolean; closed: boolean; nextOffset?: string },
): void => {
  // Per spec: PUT response includes Stream-Next-Offset (so clients can
  // resume reading) AND Stream-Closed: true if the stream is closed (whether
  // it was created already-closed or transitioned via Stream-Closed: true).
  const headers: Record<string, string> = {}
  if (out.nextOffset !== undefined)
    headers["Stream-Next-Offset"] = out.nextOffset
  if (out.closed) headers["Stream-Closed"] = "true"
  writeResponse(res, out.created ? 201 : 200, headers)
}

const buildPostResponse = (
  res: ServerResponse,
  out: { nextOffset: string; duplicate: boolean; closed: boolean },
  producer?: {
    producerId: string
    epoch: string
    seq: string
  },
): void => {
  // Per spec status semantics:
  //   Producer-tracked POST + new      → 200 OK
  //   Producer-tracked POST + duplicate → 204 No Content
  //   Generic (non-producer) POST      → 204 No Content
  // Server echoes Producer-{Id,Epoch,Seq} on every producer-tracked POST.
  // Stream-Closed: true is echoed if the stream became closed.
  const headers: Record<string, string> = {
    "Stream-Next-Offset": out.nextOffset,
  }
  if (producer !== undefined) {
    headers["Producer-Id"] = producer.producerId
    headers["Producer-Epoch"] = producer.epoch
    headers["Producer-Seq"] = producer.seq
  }
  if (out.closed) headers["Stream-Closed"] = "true"
  const status =
    producer !== undefined
      ? (out.duplicate ? 204 : 200)
      : 204
  writeResponse(res, status, headers)
}

const buildHeadResponse = (
  res: ServerResponse,
  out: {
    contentType?: string
    nextOffset?: string
    closed: boolean
  },
): void => {
  const headers: Record<string, string> = {}
  if (out.contentType !== undefined) headers["Content-Type"] = out.contentType
  if (out.nextOffset !== undefined) headers["Stream-Next-Offset"] = out.nextOffset
  if (out.closed) headers["Stream-Closed"] = "true"
  writeResponse(res, 200, headers)
}

const buildGetResponse = async (
  res: ServerResponse,
  out: {
    body: Stream.Stream<Uint8Array, unknown, never>
    nextOffset?: string
    upToDate: boolean
    closed: boolean
    cursor?: string
  },
  opts: {
    /** Stream's content-type — affects body framing (used inside SSE for JSON streams). */
    streamContentType?: string
    /** Live mode requested by client. SSE emits text/event-stream; long-poll/none emit raw bytes. */
    live?: "long-poll" | "sse"
  } = {},
): Promise<void> => {
  // Realize body stream (sufficient for tests).
  const chunks = await Effect.runPromise(
    Stream.runCollect(out.body) as Effect.Effect<Iterable<Uint8Array>, unknown, never>,
  )
  const arr: Uint8Array[] = []
  let total = 0
  for (const c of chunks) {
    arr.push(c)
    total += c.length
  }

  // ── SSE branch ────────────────────────────────────────────────────────────
  if (opts.live === "sse") {
    const headers: Record<string, string> = {
      "Content-Type": SSE_CONTENT_TYPE,
      // Suggest no caching for SSE responses (live).
      "Cache-Control": "no-store",
    }
    const control: ControlPayload = {
      ...(out.nextOffset !== undefined ? { streamNextOffset: out.nextOffset } : {}),
      ...(out.cursor !== undefined ? { streamCursor: out.cursor } : {}),
      ...(out.upToDate ? { upToDate: true as const } : {}),
      ...(out.closed ? { streamClosed: true as const } : {}),
    }
    if (total === 0) {
      // No data — just emit a control event (timeout / caught-up).
      const body = encodeControl(control)
      writeResponse(res, 200, headers, body)
      return
    }
    // Data + control. JSON streams: body is already a JSON array (assembled by
    // InMemoryWire's content-type-aware get). Raw streams: base64-encode bytes.
    const ct = opts.streamContentType ?? "application/octet-stream"
    const isJson =
      ct.startsWith("application/json") ||
      (ct.startsWith("application/") && ct.includes("+json"))
    const combined = new Uint8Array(total)
    let off = 0
    for (const c of arr) {
      combined.set(c, off)
      off += c.length
    }
    const dataPayload = isJson
      ? new TextDecoder().decode(combined)
      : encodeRawDataPayload(combined)
    const body = encodeDataAndControl(dataPayload, control)
    writeResponse(res, 200, headers, body)
    return
  }

  // ── Non-SSE (catch-up / long-poll) branch ────────────────────────────────
  const headers: Record<string, string> = {}
  if (out.nextOffset !== undefined) headers["Stream-Next-Offset"] = out.nextOffset
  if (out.upToDate) headers["Stream-Up-To-Date"] = "true"
  if (out.closed) headers["Stream-Closed"] = "true"
  if (out.cursor !== undefined) headers["Stream-Cursor"] = out.cursor
  if (opts.streamContentType) headers["Content-Type"] = opts.streamContentType
  // Per spec: 204 No Content is ONLY for long-poll TIMEOUTS (no new data
  // available within the timeout window). A normal empty range — e.g. GET
  // immediately after PUT, or GET past the tail — returns 200 OK with empty
  // body and Stream-Up-To-Date: true so clients can distinguish.
  if (total === 0) {
    if (opts.live === "long-poll") {
      writeResponse(res, 204, headers)
    } else {
      writeResponse(res, 200, headers)
    }
    return
  }
  const combined = new Uint8Array(total)
  let off = 0
  for (const c of arr) {
    combined.set(c, off)
    off += c.length
  }
  writeResponse(res, 200, headers, combined)
}

// ─── Request dispatcher ─────────────────────────────────────────────────────

const handle = async (
  req: IncomingMessage,
  res: ServerResponse,
  runtime: ManagedRuntime.ManagedRuntime<Wire, never>,
  paths: PathResolver,
): Promise<void> => {
  const fullUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const parsed = paths.parseStreamPath(fullUrl.pathname)
  if (parsed === null) return errorResponse(res, 404, "not a stream path")
  const streamId = trustStreamId(parsed)

  // Run an Effect that extracts Wire from context, then calls the right method.
  // Context.Service is yieldable in Effect.gen — but NOT directly assignable to
  // Effect, so we must wrap in `gen(function*() { yield* Wire })`.
  const withWire = <A, E>(
    f: (wire: Wire["Service"]) => Effect.Effect<A, E, never>,
  ): Promise<A> =>
    runtime.runPromise(
      Effect.flatMap(
        Effect.gen(function* () {
          return yield* Wire
        }),
        f,
      ),
    )

  try {
    switch (req.method) {
      case "PUT": {
        const ct = (req.headers["content-type"] as string) ?? "application/octet-stream"
        const ttl = req.headers["stream-ttl"]
        const expires = req.headers["stream-expires-at"]
        const closedHdr = (req.headers["stream-closed"] as string | undefined) ?? ""
        const streamClosed = closedHdr.toLowerCase() === "true"
        // Per spec: PUT may carry an initial body AND Stream-Closed: true.
        const body = await readRequestBody(req)
        const out = await withWire((wire) =>
          wire.put({
            streamId,
            contentType: trustContentType(ct),
            ...(ttl !== undefined ? { streamTtl: Number(ttl) } : {}),
            ...(expires !== undefined ? { streamExpiresAt: String(expires) } : {}),
            ...(streamClosed ? { streamClosed: true } : {}),
            ...(body.length > 0 ? { body } : {}),
          }),
        )
        return buildPutResponse(res, {
          created: out.created,
          closed: out.closed,
          ...(out.nextOffset !== undefined
            ? { nextOffset: out.nextOffset as string }
            : {}),
        })
      }
      case "POST": {
        const body = await readRequestBody(req)
        const ct = req.headers["content-type"] as string | undefined
        const pid = req.headers["producer-id"] as string | undefined
        const pep = req.headers["producer-epoch"] as string | undefined
        const psq = req.headers["producer-seq"] as string | undefined
        const closed = ((req.headers["stream-closed"] as string | undefined) ?? "").toLowerCase() === "true"
        const producer =
          pid !== undefined && pep !== undefined && psq !== undefined
            ? {
                producerId: trustProducerId(pid),
                epoch: trustEpoch(Number(pep)),
                seq: trustSeq(Number(psq)),
              }
            : undefined
        const out = await withWire((wire) =>
          wire.post({
            streamId,
            body,
            ...(ct !== undefined ? { contentType: trustContentType(ct) } : {}),
            ...(producer !== undefined ? { producer } : {}),
            ...(closed ? { streamClosed: true } : {}),
          }),
        )
        return buildPostResponse(
          res,
          {
            nextOffset: out.nextOffset as string,
            duplicate: out.duplicate,
            closed: out.closed,
          },
          producer !== undefined && pid !== undefined && pep !== undefined && psq !== undefined
            ? { producerId: pid, epoch: pep, seq: psq }
            : undefined,
        )
      }
      case "GET": {
        const offsetParam = fullUrl.searchParams.get("offset") ?? "-1"
        const limitParam = fullUrl.searchParams.get("limit")
        const liveParam = fullUrl.searchParams.get("live")
        const timeoutParam = fullUrl.searchParams.get("timeout")
        const cursorParam = fullUrl.searchParams.get("cursor")
        const liveMode =
          liveParam === "long-poll" || liveParam === "sse" ? liveParam : undefined
        // Need stream's content-type for response framing (raw vs JSON,
        // and for SSE we also need it to choose base64 vs JSON-array data).
        const meta = await withWire((wire) => wire.head({ streamId })).catch(
          () => ({
            contentType: undefined,
            nextOffset: undefined,
            closed: false,
          }),
        )
        const out = await withWire((wire) =>
          Effect.scoped(
            wire.get({
              streamId,
              position: offsetParam as never, // ReadPosition
              ...(limitParam !== null ? { limit: Number(limitParam) } : {}),
              ...(liveMode !== undefined ? { live: liveMode } : {}),
              ...(timeoutParam !== null ? { timeout: Number(timeoutParam) } : {}),
              ...(cursorParam !== null ? { cursor: cursorParam } : {}),
            }),
          ),
        )
        return await buildGetResponse(
          res,
          {
            body: out.body,
            ...(out.nextOffset !== undefined
              ? { nextOffset: out.nextOffset as string }
              : {}),
            upToDate: out.upToDate,
            closed: out.closed,
            ...(out.cursor !== undefined ? { cursor: out.cursor } : {}),
          },
          {
            ...(meta.contentType !== undefined
              ? { streamContentType: meta.contentType as string }
              : {}),
            ...(liveMode !== undefined ? { live: liveMode } : {}),
          },
        )
      }
      case "HEAD": {
        const out = await withWire((wire) => wire.head({ streamId }))
        return buildHeadResponse(res, {
          ...(out.contentType !== undefined
            ? { contentType: out.contentType as string }
            : {}),
          ...(out.nextOffset !== undefined
            ? { nextOffset: out.nextOffset as string }
            : {}),
          closed: out.closed,
        })
      }
      case "DELETE": {
        const out = await withWire((wire) => wire.delete({ streamId }))
        return writeResponse(res, out.deleted ? 204 : 404, {})
      }
      default:
        return errorResponse(res, 405, "method not allowed")
    }
  } catch (e) {
    const tag = (e as { _tag?: string })._tag
    // Per spec: 409 responses must carry discriminator headers so the client
    // can distinguish stream-closed vs sequence-gap vs config-mismatch.
    switch (tag) {
      case "StreamNotFoundError":
        return errorResponse(res, 404, "stream not found")
      case "StreamClosedError": {
        const last = (e as { lastOffset?: string }).lastOffset
        const headers: Record<string, string> = { "Stream-Closed": "true" }
        if (last !== undefined) headers["Stream-Next-Offset"] = last
        return writeResponse(res, 409, headers)
      }
      case "StreamConfigMismatchError": {
        const expected = (e as { expectedContentType?: string }).expectedContentType
        const headers: Record<string, string> = {}
        if (expected !== undefined)
          headers["Stream-Expected-Content-Type"] = expected
        return writeResponse(res, 409, headers)
      }
      case "StaleEpochError": {
        const serverEpoch = (e as { serverEpoch?: number }).serverEpoch
        const headers: Record<string, string> = {}
        if (serverEpoch !== undefined)
          headers["Producer-Epoch"] = String(serverEpoch)
        return writeResponse(res, 403, headers)
      }
      case "SequenceGapError": {
        const expectedSeq = (e as { expectedSeq?: number }).expectedSeq
        const receivedSeq = (e as { receivedSeq?: number }).receivedSeq
        const headers: Record<string, string> = {}
        if (expectedSeq !== undefined)
          headers["Producer-Expected-Seq"] = String(expectedSeq)
        if (receivedSeq !== undefined)
          headers["Producer-Received-Seq"] = String(receivedSeq)
        return writeResponse(res, 409, headers)
      }
      case "RetentionDroppedError":
        return errorResponse(res, 410, "gone")
      case "InvalidPayloadError":
        return errorResponse(res, 400, "invalid payload")
      default:
        return errorResponse(res, 500, `internal: ${String(e)}`)
    }
  }
}

// ─── Boot/teardown ──────────────────────────────────────────────────────────

export const startSpecServer = async (
  options: SpecServerOptions = {},
): Promise<SpecServerHandle> => {
  const paths = options.paths ?? defaultPaths
  const runtime = ManagedRuntime.make(InMemoryWire.layer satisfies Layer.Layer<Wire>)
  const server = createServer((req, res) => {
    handle(req, res, runtime, paths).catch((e) => {
      try {
        res.writeHead(500)
        res.end(`internal: ${String(e)}`)
      } catch {
        // Connection may already be closed.
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const addr = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    port: addr.port,
    server,
    runtime,
  }
}

export const stopSpecServer = async (handle: SpecServerHandle): Promise<void> => {
  await new Promise<void>((resolve) => handle.server.close(() => resolve()))
  await handle.runtime.dispose()
}
