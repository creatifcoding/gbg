/**
 * @vitest-environment node
 *
 * HttpWire — runs the shared conformance suite against a node:http-hosted
 * spec server.
 *
 * Per-file environment override: this test makes real cross-origin HTTP
 * requests via `FetchHttpClient`, which `happy-dom`'s same-origin policy
 * blocks. The `node` environment uses real `fetch` without that restriction.
 *
 * Setup per test file (NOT per test) — uses Vitest beforeAll/afterAll to
 * spin up a single node:http server backed by an InMemoryWire, then runs
 * the conformance suite against `http://127.0.0.1:<port>`.
 *
 * The server lives in `./_spec-server.ts` (a thin Bun.serve adapter that
 * fronts an InMemoryWire — the inverse of HttpWire). HttpWire (client) +
 * the spec server (server) close the loop: client and server both
 * implement the same wire protocol against the same `Wire` interface.
 *
 * @module @tmnl/lnk/test/services/wire/http/HttpWire.test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

import { HttpWire } from "../../../../src/services/wire/http/index.js"
import { InMemoryWire } from "../../../../src/services/wire/in-memory/index.js"
import { Wire } from "../../../../src/services/wire/index.js"
import { runConformance } from "../conformance.js"
import { startSpecServer, stopSpecServer, type SpecServerHandle } from "./_spec-server.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"

let server: SpecServerHandle

beforeAll(async () => {
  // Spin up a Bun.serve()-hosted spec server backed by InMemoryWire.
  server = await startSpecServer()
})

afterAll(async () => {
  await stopSpecServer(server)
})

// HttpWire layer requires baseUrl from the booted server. Construct lazily
// so it picks up the actual port chosen at boot time.
const httpWireLayer = (): Layer.Layer<Wire> =>
  HttpWire.layer({ baseUrl: server.baseUrl }).pipe(
    Layer.provide(FetchHttpClient.layer),
  )

describe("HttpWire", () => {
  it("connects to the spec server (smoke)", async () => {
    const sid = trustStreamId(`http-smoke-${Date.now()}`)
    const program = Effect.gen(function* () {
      const wire = yield* Wire
      yield* wire.put({
        streamId: sid,
        contentType: trustContentType("text/plain"),
      })
      const meta = yield* wire.head({ streamId: sid })
      return meta
    })
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(httpWireLayer())) as Effect.Effect<
        Awaited<ReturnType<typeof Effect.runPromise>>,
        unknown,
        never
      >,
    )
    expect(result.contentType).toBe("text/plain")
    expect(result.closed).toBe(false)
  })
})

// ─── Run the shared conformance suite against HttpWire ─────────────────────
//
// The same suite that runs against InMemoryWire now runs over the HTTP wire
// + the spec server (which is itself backed by an InMemoryWire). This
// validates that the wire protocol round-trip (Wire op → HTTP request →
// server-side Wire op → response → HTTP response → client-side parsing)
// preserves spec semantics end-to-end.

// `Layer.suspend` defers Layer construction until first use — so the
// `httpWireLayer()` call (which reads `server.baseUrl`) happens after the
// `beforeAll` hook runs. `runConformance` registers tests synchronously
// at import time; deferral happens in the Layer construction, not in the
// registration.
const lazyLayer = Layer.suspend(() => httpWireLayer())
runConformance({ wireLayer: lazyLayer })
