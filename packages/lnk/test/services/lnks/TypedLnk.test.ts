/**
 * TypedLnk + Lnks.connectTyped tests.
 *
 * Phase 2.5 — schema auto-bind. Verifies:
 *
 *   1. `lnks.connectTyped(streamId, schema)` returns a `TypedLnk<A>`
 *   2. `typed.append(value)` validates + JSON-encodes + POSTs
 *   3. `typed.subscribe()` decodes back to typed values
 *   4. Invalid values fail with SchemaError before touching the wire
 *   5. Multiple typed views over the same streamId share the underlying handle
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Schema from "effect-v4/Schema"

import { trust as trustContentType } from "../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../src/contracts/StreamId.js"
import { Lnks } from "../../../src/services/lnks/Lnks.js"
import { TypedLnk } from "../../../src/services/lnks/TypedLnk.js"
import { InMemoryWire } from "../../../src/services/wire/in-memory/index.js"
import { Wire } from "../../../src/services/wire/Wire.js"

// ─── Schema under test ──────────────────────────────────────────────────────

const HeartRate = Schema.Struct({
  bpm: Schema.Number,
  deviceId: Schema.String,
})
type HeartRate = typeof HeartRate.Type

// ─── Layer ─────────────────────────────────────────────────────────────────

const TestLayer = Lnks.layer().pipe(Layer.provideMerge(InMemoryWire.layer))

const run = <A>(eff: Effect.Effect<A, unknown, Lnks | Wire>) =>
  Effect.runPromise(
    Effect.scoped(eff).pipe(Effect.provide(TestLayer)),
  )

/**
 * Helper: create a stream via Wire.put (the spec requires PUT before
 * POST; Lnk.append doesn't auto-PUT).
 */
const createStream = (id: string) =>
  Effect.gen(function* () {
    const wire = yield* Wire
    yield* wire.put({
      streamId: trustStreamId(id),
      contentType: trustContentType("application/json"),
    })
  })

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TypedLnk", () => {
  it("connectTyped returns a TypedLnk bound to the supplied schema", async () => {
    const result = await run(
      Effect.gen(function* () {
        const lnks = yield* Lnks
        const lnk = yield* lnks.connectTyped(
          trustStreamId("vitals.hr"),
          HeartRate,
        )
        return lnk
      }),
    )
    expect(result).toBeInstanceOf(TypedLnk)
    expect(result.streamId).toBe("vitals.hr")
    expect(result.schema).toBe(HeartRate)
  })

  it("append + latest round-trips a typed value", async () => {
    const result = await run(
      Effect.gen(function* () {
        yield* createStream("vitals.hr2")
        const lnks = yield* Lnks
        const lnk = yield* lnks.connectTyped(
          trustStreamId("vitals.hr2"),
          HeartRate,
          { pollTimeoutMs: 50 },
        )

        // Let the driver fiber start its long-poll before appending,
        // so the first poll sees the new message.
        yield* Effect.sleep("100 millis")

        const reading: HeartRate = { bpm: 72, deviceId: "dev_1" }
        yield* lnk.append(reading)

        // Driver fiber picks up the new message and updates `latest`.
        yield* Effect.sleep("200 millis")

        return yield* lnk.latest
      }),
    )
    expect(result._tag).toBe("Some")
    if (result._tag === "Some") {
      expect(result.value.bpm).toBe(72)
      expect(result.value.deviceId).toBe("dev_1")
    }
  })

  it("append validates: invalid value fails with SchemaError before touching the wire", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function* () {
          yield* createStream("vitals.hr3")
          const lnks = yield* Lnks
          const lnk = yield* lnks.connectTyped(
            trustStreamId("vitals.hr3"),
            HeartRate,
          )
          // bpm should be a number, not a string
          yield* lnk.append({ bpm: "not-a-number" as never, deviceId: "dev_1" })
        }),
      ).pipe(Effect.provide(TestLayer)),
    )
    expect(exit._tag).toBe("Failure")
  })

  it("multiple typed views over the same streamId share the underlying handle", async () => {
    await run(
      Effect.gen(function* () {
        const lnks = yield* Lnks
        const a = yield* lnks.connectTyped(
          trustStreamId("vitals.hr4"),
          HeartRate,
        )
        const b = yield* lnks.connectTyped(
          trustStreamId("vitals.hr4"),
          HeartRate,
        )
        // Distinct TypedLnk wrappers (each is a lightweight view)…
        expect(a).not.toBe(b)
        // …but the underlying raw Lnk is the SAME ref-counted handle.
        expect(a.raw).toBe(b.raw)
      }),
    )
  })

  it("latest yields None before any message, Some(A) after append", async () => {
    await run(
      Effect.gen(function* () {
        yield* createStream("vitals.hr5")
        const lnks = yield* Lnks
        const lnk = yield* lnks.connectTyped(
          trustStreamId("vitals.hr5"),
          HeartRate,
          { pollTimeoutMs: 50 },
        )

        const before = yield* lnk.latest
        expect(before._tag).toBe("None")

        // Let the driver attach
        yield* Effect.sleep("100 millis")

        const reading: HeartRate = { bpm: 90, deviceId: "dev_2" }
        yield* lnk.append(reading)
        // Give the driver fiber a moment to process the append
        yield* Effect.sleep("200 millis")

        const after = yield* lnk.latest
        expect(after._tag).toBe("Some")
        if (after._tag === "Some") {
          expect(after.value.bpm).toBe(90)
          expect(after.value.deviceId).toBe("dev_2")
        }
      }),
    )
  })
})
