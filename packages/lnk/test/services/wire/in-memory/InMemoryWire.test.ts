/**
 * InMemoryWire — runs the shared conformance suite.
 *
 * Adds in-memory-specific tests beyond the shared suite (e.g. snapshot
 * inspection of internal state) where appropriate.
 *
 * @module @tmnl/lnk/test/services/wire/in-memory/InMemoryWire.test
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect-v4/Effect"

import { InMemoryWire } from "../../../../src/services/wire/in-memory/index.js"
import { runConformance } from "../conformance.js"
import { DurableStreamWire } from "../../../../src/services/wire/index.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"

// Run the shared conformance suite against InMemoryWire.
runConformance({
  wireLayer: InMemoryWire.layer,
})

// In-memory-specific extras.
describe("InMemoryWire — impl-specific", () => {
  it("layer is self-contained (no external service deps required)", async () => {
    // The layer should provide DurableStreamWire without needing any other
    // service to be in context.
    const program = Effect.gen(function* () {
      const wire = yield* DurableStreamWire
      const sid = trustStreamId("self-contained-test")
      yield* wire.put({
        streamId: sid,
        contentType: trustContentType("text/plain"),
      })
      const meta = yield* wire.head({ streamId: sid })
      return meta
    })
    const result = await Effect.runPromise(
      program.pipe(Effect.provide(InMemoryWire.layer)),
    )
    expect(result.contentType).toBe("text/plain")
  })
})
