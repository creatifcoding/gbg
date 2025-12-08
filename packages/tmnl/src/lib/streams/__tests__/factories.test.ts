/**
 * Stream Factories — Vitest Spec
 *
 * Uses @effect/vitest for Effect-native testing.
 * These tests validate the factories AND serve as executable documentation.
 */

import { describe, it, expect } from "@effect/vitest"
import { Effect, Stream, Chunk, TestClock, Fiber, Duration } from "effect"
import { ticker, pulse, counter, heartbeat } from "../factories"

describe("Stream Factories", () => {
  describe("ticker", () => {
    it.effect("emits timestamps at specified interval", () =>
      Effect.gen(function* () {
        const fiber = yield* ticker("1 second").pipe(
          Stream.take(3),
          Stream.runCollect,
          Effect.fork
        )

        // Advance clock by 3 seconds (first is immediate, then 2 intervals)
        yield* TestClock.adjust("2 seconds")

        const result = yield* Fiber.join(fiber)

        expect(Chunk.size(result)).toBe(3)
        // All timestamps should be numbers
        for (const ts of result) {
          expect(typeof ts).toBe("number")
        }
      })
    )

    it.effect("immediate: true emits first value without delay", () =>
      Effect.gen(function* () {
        const fiber = yield* ticker("1 second", { immediate: true }).pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        )

        // Don't advance clock — should still get first value
        yield* TestClock.adjust("0 millis")

        const result = yield* Fiber.join(fiber)
        expect(Chunk.size(result)).toBe(1)
      })
    )

    it.effect("immediate: false waits for first interval", () =>
      Effect.gen(function* () {
        const fiber = yield* ticker("1 second", { immediate: false }).pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        )

        // At 0ms, should have nothing
        yield* TestClock.adjust("500 millis")
        // Still not ready...

        // At 1s, should have first value
        yield* TestClock.adjust("500 millis")
        const result = yield* Fiber.join(fiber)
        expect(Chunk.size(result)).toBe(1)
      })
    )
  })

  describe("pulse", () => {
    it.effect("runs effect at each interval", () =>
      Effect.gen(function* () {
        let callCount = 0
        const countingEffect = Effect.sync(() => {
          callCount++
          return callCount
        })

        const fiber = yield* pulse(countingEffect, "1 second").pipe(
          Stream.take(3),
          Stream.runCollect,
          Effect.fork
        )

        yield* TestClock.adjust("2 seconds")

        const result = yield* Fiber.join(fiber)

        expect(Chunk.toReadonlyArray(result)).toEqual([1, 2, 3])
      })
    )

    it.effect("propagates effect errors", () =>
      Effect.gen(function* () {
        const failingEffect = Effect.fail("boom")

        const result = yield* pulse(failingEffect, "1 second").pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.either
        )

        expect(result._tag).toBe("Left")
        if (result._tag === "Left") {
          expect(result.left).toBe("boom")
        }
      })
    )

    it.effect("preserves effect context requirements", () =>
      Effect.gen(function* () {
        // This test validates that R is properly threaded through
        interface MyService {
          readonly getValue: () => Effect.Effect<number>
        }
        const MyService = Effect.Tag<MyService>()

        const serviceEffect = Effect.gen(function* () {
          const service = yield* MyService
          return yield* service.getValue()
        })

        const stream = pulse(serviceEffect, "1 second")

        // Type check: stream should require MyService
        // If this compiles, the types are correct
        const _typeCheck: Stream.Stream<number, never, MyService> = stream
      })
    )
  })

  describe("counter", () => {
    it.effect("emits incrementing integers", () =>
      Effect.gen(function* () {
        const fiber = yield* counter("100 millis").pipe(
          Stream.take(5),
          Stream.runCollect,
          Effect.fork
        )

        yield* TestClock.adjust("400 millis")

        const result = yield* Fiber.join(fiber)

        // counter uses scan starting at 0, incrementing each tick
        // scan emits initial value first, then accumulator results
        // 0 (initial), then +1 for each tick: 0, 1, 2, 3, 4
        expect(Chunk.toReadonlyArray(result)).toEqual([0, 1, 2, 3, 4])
      })
    )
  })

  describe("heartbeat", () => {
    it.effect("is a 1-second ticker", () =>
      Effect.gen(function* () {
        const fiber = yield* heartbeat.pipe(
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        )

        yield* TestClock.adjust("1 second")

        const result = yield* Fiber.join(fiber)
        expect(Chunk.size(result)).toBe(2)
      })
    )
  })
})

// ============================================================================
// CHALLENGE VALIDATION TESTS
// ============================================================================

describe("Challenge 1: The Heartbeat", () => {
  it.effect("solution emits timestamps every second", () =>
    Effect.gen(function* () {
      const { heartbeat: solution } = yield* Effect.promise(() =>
        import("../challenges/01-heartbeat")
      )

      const fiber = yield* solution.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.fork
      )

      yield* TestClock.adjust("2 seconds")

      const result = yield* Fiber.join(fiber)
      expect(Chunk.size(result)).toBe(3)

      // Verify all values are numbers (timestamps)
      for (const ts of result) {
        expect(typeof ts).toBe("number")
      }
    })
  )

  it.effect("timestamps are evaluated lazily (not at stream creation)", () =>
    Effect.gen(function* () {
      const { heartbeat: solution } = yield* Effect.promise(() =>
        import("../challenges/01-heartbeat")
      )

      const fiber = yield* solution.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.fork
      )

      yield* TestClock.adjust("1 second")

      const result = yield* Fiber.join(fiber)
      const [first, second] = Chunk.toReadonlyArray(result)

      // Second timestamp should be later than first
      expect(second).toBeGreaterThan(first!)
    })
  )
})
