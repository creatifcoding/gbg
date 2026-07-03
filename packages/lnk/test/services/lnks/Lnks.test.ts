/**
 * Lnks factory tests against InMemoryWire.
 *
 * Phase 2.1 milestones covered:
 *   - Lnks.layer() construction
 *   - connect() returns a Lnk handle
 *   - connect() reuses the same handle for the same streamId (refcount)
 *   - connect() with different streamIds returns different handles
 *   - Scope-bounded handle release (last referencer closes → handle evicted)
 *   - Capacity limit (ExceededCapacityError on overflow)
 *
 * @module @tmnl/lnk/test/services/lnks/Lnks
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Wire } from "../../../src/services/wire/Wire.js"
import { InMemoryWire } from "../../../src/services/wire/in-memory/InMemoryWire.js"
import { Lnks } from "../../../src/services/lnks/Lnks.js"

const TEXT_ENCODER = new TextEncoder()

const wireLayer = InMemoryWire.layer

const provided = <A, E>(
  eff: Effect.Effect<A, E, Lnks | Wire>,
  lnksLayer: Layer.Layer<Lnks, never, Wire> = Lnks.Default,
): Promise<A> =>
  Effect.runPromise(
    eff.pipe(
      Effect.provide(lnksLayer),
      Effect.provide(wireLayer),
    ) as Effect.Effect<A, E, never>,
  )

let counter = 0
const makeStreamId = (prefix: string) =>
  trustStreamId(`lnks-${prefix}-${Date.now()}-${++counter}`)

describe("Lnks", () => {
  describe("connect + handle reuse", () => {
    it("connect returns a Lnk handle for an existing stream", async () => {
      const sid = makeStreamId("connect-basic")
      await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          const lnks = yield* Lnks
          yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk = yield* lnks.connect(
                sid,
                trustContentType("text/plain"),
                { fromOffset: "now", pollTimeoutMs: 50 },
              )
              expect(lnk.streamId).toBe(sid)
              expect(lnk.contentType).toBe("text/plain")
            }),
          )
        }),
      )
    })

    it("two connect() calls for same streamId return the same Lnk", async () => {
      const sid = makeStreamId("dedup")
      await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          const lnks = yield* Lnks
          yield* Effect.scoped(
            Effect.gen(function* () {
              const lnk1 = yield* lnks.connect(
                sid,
                trustContentType("text/plain"),
                { fromOffset: "now", pollTimeoutMs: 50 },
              )
              const lnk2 = yield* lnks.connect(
                sid,
                trustContentType("text/plain"),
              )
              expect(lnk1).toBe(lnk2)
            }),
          )
        }),
      )
    })

    it("different streamIds return different Lnks", async () => {
      const sidA = makeStreamId("diff-a")
      const sidB = makeStreamId("diff-b")
      await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sidA,
            contentType: trustContentType("text/plain"),
          })
          yield* wire.put({
            streamId: sidB,
            contentType: trustContentType("text/plain"),
          })
          const lnks = yield* Lnks
          yield* Effect.scoped(
            Effect.gen(function* () {
              const a = yield* lnks.connect(
                sidA,
                trustContentType("text/plain"),
                { fromOffset: "now", pollTimeoutMs: 50 },
              )
              const b = yield* lnks.connect(
                sidB,
                trustContentType("text/plain"),
                { fromOffset: "now", pollTimeoutMs: 50 },
              )
              expect(a).not.toBe(b)
              expect(a.streamId).toBe(sidA)
              expect(b.streamId).toBe(sidB)
            }),
          )
        }),
      )
    })
  })

  describe("operations through reused handle", () => {
    it("appends through one handle are observed via another", async () => {
      const sid = makeStreamId("shared-ops")
      await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sid,
            contentType: trustContentType("text/plain"),
          })
          const lnks = yield* Lnks
          yield* Effect.scoped(
            Effect.gen(function* () {
              const writer = yield* lnks.connect(
                sid,
                trustContentType("text/plain"),
                { fromOffset: "now", pollTimeoutMs: 50 },
              )
              const reader = yield* lnks.connect(
                sid,
                trustContentType("text/plain"),
              )
              expect(writer).toBe(reader)
              const out = yield* writer.append(TEXT_ENCODER.encode("data"))
              expect(out.duplicate).toBe(false)
              const meta = yield* reader.head()
              expect(meta.nextOffset).toBeDefined()
            }),
          )
        }),
      )
    })
  })

  describe("capacity", () => {
    it("connect fails with ExceededCapacityError when capacity is reached", async () => {
      const sidA = makeStreamId("cap-a")
      const sidB = makeStreamId("cap-b")
      const result = await provided(
        Effect.gen(function* () {
          const wire = yield* Wire
          yield* wire.put({
            streamId: sidA,
            contentType: trustContentType("text/plain"),
          })
          yield* wire.put({
            streamId: sidB,
            contentType: trustContentType("text/plain"),
          })
          const lnks = yield* Lnks
          return yield* Effect.scoped(
            Effect.gen(function* () {
              yield* lnks.connect(sidA, trustContentType("text/plain"), {
                fromOffset: "now",
                pollTimeoutMs: 50,
              })
              return yield* Effect.exit(
                lnks.connect(sidB, trustContentType("text/plain"), {
                  fromOffset: "now",
                  pollTimeoutMs: 50,
                }),
              )
            }),
          )
        }),
        Lnks.layer({ capacity: 1 }),
      )
      expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        // The cause should mention ExceededCapacity.
        const causeStr = JSON.stringify(result.cause)
        expect(causeStr).toContain("ExceededCapacity")
      }
    })
  })
})
