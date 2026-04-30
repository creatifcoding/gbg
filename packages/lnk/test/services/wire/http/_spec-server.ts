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

const STREAM_PATH_RE = /^\/streams\/([^/?]+)$/

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

const buildPutResponse = (res: ServerResponse, out: { created: boolean }): void =>
  writeResponse(res, out.created ? 201 : 200, {})

const buildPostResponse = (
  res: ServerResponse,
  out: { nextOffset: string; duplicate: boolean },
): void =>
  writeResponse(
    res,
    out.duplicate ? 204 : 201,
    { "Stream-Next-Offset": out.nextOffset },
  )

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
  contentType?: string,
): Promise<void> => {
  const headers: Record<string, string> = {}
  if (out.nextOffset !== undefined) headers["Stream-Next-Offset"] = out.nextOffset
  if (out.upToDate) headers["Stream-Up-To-Date"] = "true"
  if (out.closed) headers["Stream-Closed"] = "true"
  if (out.cursor !== undefined) headers["Stream-Cursor"] = out.cursor
  if (contentType) headers["Content-Type"] = contentType
  // Realize body stream (sufficient for tests).
  const chunks = await Effect.runPromise(
    Stream.runCollect(out.body) as Effect.Effect<Iterable<Uint8Array>, unknown, never>,
  )
  let total = 0
  const arr: Uint8Array[] = []
  for (const c of chunks) {
    arr.push(c)
    total += c.length
  }
  if (total === 0) {
    // 204 No Content — long-poll timeout, or empty range.
    writeResponse(res, 204, headers)
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
): Promise<void> => {
  const fullUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const m = fullUrl.pathname.match(STREAM_PATH_RE)
  if (!m) return errorResponse(res, 404, "not a stream path")
  const streamId = trustStreamId(decodeURIComponent(m[1]!))

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
        const out = await withWire((wire) =>
          wire.put({
            streamId,
            contentType: trustContentType(ct),
            ...(ttl !== undefined ? { streamTtl: Number(ttl) } : {}),
            ...(expires !== undefined ? { streamExpiresAt: String(expires) } : {}),
          }),
        )
        return buildPutResponse(res, out)
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
        return buildPostResponse(res, {
          nextOffset: out.nextOffset as string,
          duplicate: out.duplicate,
        })
      }
      case "GET": {
        const offsetParam = fullUrl.searchParams.get("offset") ?? "-1"
        const limitParam = fullUrl.searchParams.get("limit")
        const liveParam = fullUrl.searchParams.get("live")
        const timeoutParam = fullUrl.searchParams.get("timeout")
        const cursorParam = fullUrl.searchParams.get("cursor")
        const out = await withWire((wire) =>
          Effect.scoped(
            wire.get({
              streamId,
              position: offsetParam as never, // ReadPosition
              ...(limitParam !== null ? { limit: Number(limitParam) } : {}),
              ...(liveParam === "long-poll" || liveParam === "sse"
                ? { live: liveParam }
                : {}),
              ...(timeoutParam !== null ? { timeout: Number(timeoutParam) } : {}),
              ...(cursorParam !== null ? { cursor: cursorParam } : {}),
            }),
          ),
        )
        return await buildGetResponse(res, {
          body: out.body,
          ...(out.nextOffset !== undefined ? { nextOffset: out.nextOffset as string } : {}),
          upToDate: out.upToDate,
          closed: out.closed,
          ...(out.cursor !== undefined ? { cursor: out.cursor } : {}),
        })
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

export const startSpecServer = async (): Promise<SpecServerHandle> => {
  const runtime = ManagedRuntime.make(InMemoryWire.layer satisfies Layer.Layer<Wire>)
  const server = createServer((req, res) => {
    handle(req, res, runtime).catch((e) => {
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
