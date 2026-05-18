/**
 * NatsBridgeWire skeleton tests.
 *
 * The bridge is exported and selectable, but remains guarded until the MSH
 * JetStream/KV implementation lands. These tests lock that contract: the layer
 * provides `Wire`, and every method fails clearly instead of pretending to work.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { NatsBridgeWire } from "../../../src/services/wire/nats-bridge/NatsBridgeWire.js"

describe("NatsBridgeWire skeleton", () => {
  it("exports a guarded Wire layer with explicit not-implemented failures", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const wire = yield* Wire
        return yield* wire.put({
          streamId: trustStreamId("nats-bridge-test"),
          contentType: trustContentType("text/plain"),
        }).pipe(Effect.result)
      }).pipe(
        Effect.provide(
          NatsBridgeWire.layer({
            subjectRoot: "_test.lnk.stream",
            metadataBucket: "TEST_LNK_META",
          }),
        ),
      ),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure._tag).toBe("FetchError")
      expect(result.failure.status).toBe(501)
      expect(result.failure.message).toContain("NatsBridgeWire.put is not implemented yet")
      expect(result.failure.message).toContain("subjectRoot=_test.lnk.stream")
      expect(result.failure.message).toContain("metadataBucket=TEST_LNK_META")
    }
  })
})
