/**
 * feedToAtom — Vitest Spec
 *
 * Tests the Feed → Atom bridge with lifecycle management.
 */

import { describe, it, expect } from "@effect/vitest"
import { Effect, Stream, Schedule } from "effect"
import { Feed } from "../../constructs/Feed"
import { feedToAtom, feedToAtomArray, feedToAtomLatest } from "../feedToAtom"

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

// Create a simple test feed that emits a sequence
// NOTE: interval is required for cooperative scheduling - without it,
// Stream.repeatEffect runs in a tight loop that starves the event loop
const createTestFeed = (values: number[]) => {
  let index = 0
  return Feed.make({
    id: `test-feed-${Date.now()}`,
    name: "Test Feed",
    interval: 1, // 1ms as number - Duration.DurationInput accepts numbers
    producer: Effect.sync(() => {
      if (index >= values.length) {
        // Return last value when exhausted (feed is infinite by default)
        return values[values.length - 1]!
      }
      return values[index++]!
    }),
  })
}

// Create a feed that errors after N emissions
// NOTE: Uses Effect.try (not Effect.sync) because it can fail
// Effect.sync is for non-failing operations - throws inside it don't become Effect errors
const createFiniteFeed = (values: number[]) => {
  let index = 0
  return Feed.make({
    id: `finite-feed-${Date.now()}`,
    name: "Finite Feed",
    interval: 1, // 1ms as number
    producer: Effect.try(() => {
      const val = values[index++]
      if (val === undefined) {
        throw new Error("Feed exhausted")
      }
      return val
    }),
  })
}

describe("feedToAtom", () => {
  describe("basic functionality", () => {
    it("accumulates feed values via onComplete", async () => {
      const feed = createFiniteFeed([1, 2, 3, 4, 5])

      let completedWith: readonly number[] | null = null

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: false,
        onComplete: (final) => {
          completedWith = final
        },
        onError: () => {
          // Feed "completes" by throwing when exhausted
          completedWith = handle._registry.get(handle.atom) as readonly number[]
        },
      })

      // Manual start
      handle.start()

      // Wait for feed to process (will error when exhausted, triggering onError)
      await waitFor(() => completedWith !== null, { timeout: 2000 })

      expect(completedWith).toEqual([1, 2, 3, 4, 5])
    })

    it("starts idle before first start", () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: false,
      })

      const status = handle._registry.get(handle.statusAtom)
      expect(status).toBe("idle")
    })
  })

  describe("auto-start/auto-stop", () => {
    it("auto-starts on first subscription when autoStart is true", async () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: true,
        autoStop: false,
      })

      // Status should be idle initially
      expect(handle._registry.get(handle.statusAtom)).toBe("idle")

      // Subscribe triggers auto-start
      const unsub = handle.subscribe(() => {})

      // Give it time to start
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      expect(handle._registry.get(handle.statusAtom)).toBe("running")

      // Cleanup
      unsub()
      handle.stop()
    })

    it("auto-stops when last subscriber leaves when autoStop is true", async () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: true,
        autoStop: true,
      })

      // Subscribe triggers auto-start
      const unsub = handle.subscribe(() => {})

      // Wait for running
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      // Unsubscribe triggers auto-stop
      unsub()

      // Give it time to stop
      await waitFor(() => handle._registry.get(handle.statusAtom) === "idle")

      expect(handle._registry.get(handle.statusAtom)).toBe("idle")
    })

    it("does not auto-start when autoStart is false", () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: false,
      })

      // Subscribe should NOT auto-start
      const unsub = handle.subscribe(() => {})

      // Status should still be idle
      expect(handle._registry.get(handle.statusAtom)).toBe("idle")

      unsub()
    })
  })

  describe("manual lifecycle", () => {
    it("start() starts the feed", async () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: false,
      })

      handle.start()

      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      expect(handle._registry.get(handle.statusAtom)).toBe("running")

      handle.stop()
    })

    it("stop() stops the feed", async () => {
      const feed = createTestFeed([1, 2, 3])

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        autoStart: false,
      })

      handle.start()
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      handle.stop()
      await waitFor(() => handle._registry.get(handle.statusAtom) === "idle")

      expect(handle._registry.get(handle.statusAtom)).toBe("idle")
    })
  })

  describe("maxItems cap", () => {
    it("caps accumulated array length", async () => {
      const feed = createFiniteFeed([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      let finalValue: readonly number[] | null = null

      const handle = feedToAtom(feed, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        maxItems: 5,
        autoStart: false,
        onError: () => {
          // Feed errors when exhausted
          finalValue = handle._registry.get(handle.atom) as readonly number[]
        },
      })

      handle.start()

      await waitFor(() => finalValue !== null, { timeout: 2000 })

      expect(finalValue).toHaveLength(5)
      expect(finalValue).toEqual([6, 7, 8, 9, 10])
    })
  })
})

describe("feedToAtomArray", () => {
  it("creates array accumulator by default", async () => {
    const feed = createFiniteFeed([1, 2, 3])

    let finalValue: readonly number[] | null = null

    const handle = feedToAtomArray(feed, {
      autoStart: false,
      onError: () => {
        finalValue = handle._registry.get(handle.atom) as readonly number[]
      },
    })

    handle.start()

    await waitFor(() => finalValue !== null, { timeout: 2000 })

    expect(finalValue).toEqual([1, 2, 3])
  })
})

describe("feedToAtomLatest", () => {
  it("keeps only the latest value", async () => {
    const feed = createFiniteFeed([1, 2, 3, 4, 5])

    let finalValue: number | null = null
    let seenNull = false

    const handle = feedToAtomLatest(feed, {
      autoStart: false,
      onError: () => {
        finalValue = handle._registry.get(handle.atom) as number | null
      },
    })

    // Initial value is null
    const initialValue = handle._registry.get(handle.atom)
    expect(initialValue).toBeNull()

    handle.start()

    await waitFor(() => finalValue !== null, { timeout: 2000 })

    // Final value should be the last emitted
    expect(finalValue).toBe(5)
  })
})
