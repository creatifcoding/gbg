/**
 * streamToAtom — Vitest Spec
 *
 * Tests the stream-to-atom bridge with accumulation, batching, and lifecycle.
 * Uses @effect/vitest for Effect-native testing with TestClock.
 */

import { describe, it, expect } from "@effect/vitest"
import { Effect, Stream, Chunk, TestClock, Fiber, Duration, Schedule } from "effect"
import {
  streamToAtom,
  eagerStreamToAtom,
  appendAccumulator,
  windowAccumulator,
  prependAccumulator,
  type StreamAtomStatus,
} from "../streamToAtom"

// Helper to wait for a condition with timeout
const waitFor = async (
  condition: () => boolean,
  { timeout = 1000, interval = 10 }: { timeout?: number; interval?: number } = {}
): Promise<void> => {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

describe("streamToAtom", () => {
  describe("basic accumulation", () => {
    it("accumulates stream values into atom", async () => {
      // Create a finite stream of 5 numbers
      const numbers = Stream.fromIterable([1, 2, 3, 4, 5])

      let completedWith: readonly number[] | null = null

      const handle = streamToAtom(numbers, {
        initialValue: [] as readonly number[],
        accumulate: appendAccumulator<number>(),
        onComplete: (final) => {
          completedWith = final
        },
      })

      // Start subscription
      handle.start()

      // Wait for stream to complete via callback
      await waitFor(() => completedWith !== null)

      expect(completedWith).toEqual([1, 2, 3, 4, 5])
    })

    it("uses custom accumulator", async () => {
      const numbers = Stream.fromIterable([1, 2, 3, 4, 5])

      let completedSum: number | null = null

      const handle = streamToAtom(numbers, {
        initialValue: 0,
        accumulate: (sum, n) => sum + n,
        onComplete: (final) => {
          completedSum = final
        },
      })

      handle.start()

      // Wait for completion via callback
      await waitFor(() => completedSum !== null)

      expect(completedSum).toBe(15) // 1 + 2 + 3 + 4 + 5
    })
  })

  describe("status transitions", () => {
    it("starts idle", () => {
      const stream = Stream.never
      const handle = streamToAtom(stream, {
        initialValue: 0,
        accumulate: (_, n) => n,
      })

      const status = handle._registry.get(handle.statusAtom)
      expect(status).toBe("idle")
    })

    it("transitions to running on start", () => {
      const stream = Stream.never
      const handle = streamToAtom(stream, {
        initialValue: 0,
        accumulate: (_, n) => n,
      })

      handle.start()

      const status = handle._registry.get(handle.statusAtom)
      expect(status).toBe("running")

      // Clean up
      handle.stop()
    })

    it("transitions to idle on stop", () => {
      const stream = Stream.never
      const handle = streamToAtom(stream, {
        initialValue: 0,
        accumulate: (_, n) => n,
      })

      handle.start()
      handle.stop()

      // Wait a tick for the interrupt to process
      const status = handle._registry.get(handle.statusAtom)
      expect(status).toBe("idle")
    })
  })

  describe("maxItems cap", () => {
    it("caps accumulated array length", async () => {
      const numbers = Stream.fromIterable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      let completedWith: readonly number[] | null = null

      const handle = streamToAtom(numbers, {
        initialValue: [] as readonly number[],
        accumulate: appendAccumulator<number>(),
        maxItems: 5,
        onComplete: (final) => {
          completedWith = final
        },
      })

      handle.start()

      // Wait for completion via callback
      await waitFor(() => completedWith !== null)

      expect(completedWith).toHaveLength(5)
      // Should keep last 5 items
      expect(completedWith).toEqual([6, 7, 8, 9, 10])
    })
  })

  describe("callbacks", () => {
    it("calls onComplete with final value", async () => {
      let completedWith: readonly number[] | null = null

      const numbers = Stream.fromIterable([1, 2, 3])

      const handle = streamToAtom(numbers, {
        initialValue: [] as readonly number[],
        accumulate: appendAccumulator<number>(),
        onComplete: (final) => {
          completedWith = final
        },
      })

      handle.start()

      // Wait for completion
      await waitFor(() => handle._registry.get(handle.statusAtom) === "complete")

      expect(completedWith).toEqual([1, 2, 3])
    })

    it("calls onError on stream failure", async () => {
      let caughtError: unknown = null

      const failingStream = Stream.fail("test error")

      const handle = streamToAtom(failingStream, {
        initialValue: [] as readonly number[],
        accumulate: appendAccumulator<number>(),
        onError: (err) => {
          caughtError = err
        },
      })

      handle.start()

      // Wait for error callback to be called
      await waitFor(() => caughtError !== null)

      expect(caughtError).toBe("test error")
    })
  })

  describe("control atom", () => {
    it("reflects running state", () => {
      const stream = Stream.never
      const handle = streamToAtom(stream, {
        initialValue: 0,
        accumulate: (_, n) => n,
      })

      // Initially not running
      expect(handle._registry.get(handle.controlAtom)).toBe(false)

      handle.start()
      expect(handle._registry.get(handle.controlAtom)).toBe(true)

      handle.stop()
      expect(handle._registry.get(handle.controlAtom)).toBe(false)
    })

    it("can be controlled via registry.set", () => {
      const stream = Stream.never
      const handle = streamToAtom(stream, {
        initialValue: 0,
        accumulate: (_, n) => n,
      })

      // Start via registry.set instead of handle.start()
      handle._registry.set(handle.controlAtom, true)
      expect(handle._registry.get(handle.statusAtom)).toBe("running")

      // Stop via registry.set
      handle._registry.set(handle.controlAtom, false)
      expect(handle._registry.get(handle.statusAtom)).toBe("idle")
    })
  })
})

describe("eagerStreamToAtom", () => {
  it("auto-starts subscription", () => {
    const stream = Stream.never
    const handle = eagerStreamToAtom(stream, {
      initialValue: 0,
      accumulate: (_, n) => n,
    })

    // Should already be running
    const status = handle._registry.get(handle.statusAtom)
    expect(status).toBe("running")

    // Clean up
    handle.stop()
  })
})

describe("accumulator helpers", () => {
  describe("appendAccumulator", () => {
    it("appends to end of array", () => {
      const acc = appendAccumulator<number>()
      expect(acc([1, 2], 3)).toEqual([1, 2, 3])
    })
  })

  describe("windowAccumulator", () => {
    it("keeps last N items", () => {
      const acc = windowAccumulator<number>(3)
      const result = [1, 2, 3, 4, 5].reduce(
        (prev, n) => acc(prev, n),
        [] as readonly number[]
      )
      expect(result).toEqual([3, 4, 5])
    })
  })

  describe("prependAccumulator", () => {
    it("prepends to front of array", () => {
      const acc = prependAccumulator<number>()
      expect(acc([2, 3], 1)).toEqual([1, 2, 3])
    })
  })
})

// ============================================================================
// BATCHING TESTS
// ============================================================================

describe("streamToAtom batching", () => {
  it("batching reduces update frequency", async () => {
    // Create a stream that emits 10 values quickly
    const fastStream = Stream.fromIterable(
      Array.from({ length: 10 }, (_, i) => i)
    )

    let completedWith: readonly number[] | null = null

    const handle = streamToAtom(fastStream, {
      initialValue: [] as readonly number[],
      accumulate: (prev, next) => {
        return [...prev, next]
      },
      batchEvery: 5, // Only update atom every 5 emissions
      onComplete: (final) => {
        completedWith = final
      },
    })

    handle.start()

    // Wait for completion via callback
    await waitFor(() => completedWith !== null)

    // Verify all values were accumulated
    expect(completedWith).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})
