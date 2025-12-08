/**
 * channelOutletAtom — Vitest Spec
 *
 * Tests the Channel Outlet → Atom bridge with ChannelService integration.
 * Uses @effect/vitest for Effect-native testing.
 */

import { describe, it, expect } from "@effect/vitest"
import { Effect, Stream, Layer } from "effect"
import {
  outletToAtom,
  channelOutletAtom,
  channelOutletAtomArray,
  channelOutletAtomLatest,
} from "../channelOutletAtom"
import type { ChannelId, OutletId } from "../../constructs/Channel"
import { ChannelService, ChannelServiceLive } from "../../constructs/ChannelService"
import { ChannelBuilder } from "../../constructs/ChannelBuilder"

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

// Create branded IDs for testing
const testChannelId = "test-channel" as ChannelId
const testOutletId = "test-outlet" as OutletId

describe("outletToAtom (pure)", () => {
  describe("basic functionality", () => {
    it("accumulates stream values into atom", async () => {
      const stream = Stream.fromIterable([1, 2, 3, 4, 5])

      let completedWith: readonly number[] | null = null

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        onComplete: (final) => {
          completedWith = final
        },
      })

      handle.start()

      await waitFor(() => completedWith !== null)

      expect(completedWith).toEqual([1, 2, 3, 4, 5])
    })

    it("starts idle before first start", () => {
      const stream = Stream.never as Stream.Stream<number>

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
      })

      const status = handle._registry.get(handle.statusAtom)
      expect(status).toBe("idle")
    })

    it("exposes channelId and outletId", () => {
      const stream = Stream.never as Stream.Stream<number>

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
      })

      expect(handle.channelId).toBe(testChannelId)
      expect(handle.outletId).toBe(testOutletId)
    })
  })

  describe("lifecycle", () => {
    it("transitions to running on start", async () => {
      // Use Stream.never - known to work from other tests
      const stream = Stream.never as Stream.Stream<number>

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
      })

      handle.start()

      // Use waitFor like the passing "idempotent" test
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      // Call start() again like the passing test does - maybe this triggers atom propagation?
      handle.start()

      expect(handle._registry.get(handle.statusAtom)).toBe("running")

      handle.stop()
    })

    it("transitions to idle on stop", async () => {
      // Use a stream with interval for cooperative scheduling
      const stream = Stream.repeat(Stream.make(1), { times: 1000 }).pipe(
        Stream.schedule({ spaced: 1 })
      )

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
      })

      handle.start()
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      handle.stop()
      await waitFor(() => handle._registry.get(handle.statusAtom) === "idle")

      expect(handle._registry.get(handle.statusAtom)).toBe("idle")
    })

    it("start is idempotent when already running", async () => {
      const stream = Stream.never as Stream.Stream<number>

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
      })

      handle.start()
      await waitFor(() => handle._registry.get(handle.statusAtom) === "running")

      // Second start should not throw or change state
      handle.start()

      expect(handle._registry.get(handle.statusAtom)).toBe("running")

      handle.stop()
    })

    it("stop is idempotent when not running", () => {
      const stream = Stream.never as Stream.Stream<number>

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
      })

      // Stop before start should not throw
      handle.stop()

      expect(handle._registry.get(handle.statusAtom)).toBe("idle")
    })
  })

  describe("maxItems cap", () => {
    it("caps accumulated array length", async () => {
      const stream = Stream.fromIterable([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

      let completedWith: readonly number[] | null = null

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [] as readonly number[],
        accumulate: (prev, next) => [...prev, next],
        maxItems: 5,
        onComplete: (final) => {
          completedWith = final
        },
      })

      handle.start()

      await waitFor(() => completedWith !== null)

      expect(completedWith).toHaveLength(5)
      expect(completedWith).toEqual([6, 7, 8, 9, 10])
    })
  })

  describe("error handling", () => {
    it("calls onError on stream failure", async () => {
      let caughtError: unknown = null
      let errorStatus: string | null = null

      // Stream.fail immediately fails the stream
      const stream = Stream.fail("test error")

      const handle = outletToAtom(stream, testChannelId, testOutletId, {
        initialValue: [],
        accumulate: (prev, next) => [...prev, next],
        onError: (err) => {
          caughtError = err
          errorStatus = handle._registry.get(handle.statusAtom)
        },
      })

      handle.start()

      // Wait for error callback - should happen very quickly
      await waitFor(() => caughtError !== null, { timeout: 500 })

      expect(caughtError).toBe("test error")
      // Status should be "error" when onError was called
      expect(errorStatus).toBe("error")
    })
  })
})

describe("channelOutletAtom (ChannelService)", () => {
  // Create a test channel builder
  const createTestChannel = () =>
    ChannelBuilder.create("test-channel")
      .name("Test Channel")
      .inlet("input", {})
      .outlet("output", { broadcast: true, maxLag: 100 })
      .wire("input", "output")

  it.effect("gets outlet stream from ChannelService", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Register and open channel
      const builder = createTestChannel()
      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // Outlet ID format: ${channelId}:outlet:${localId}
      const outletId = `${channelId}:outlet:output` as OutletId

      // Create outlet atom
      const handle = yield* channelOutletAtom(
        channelId,
        outletId,
        {
          initialValue: [] as readonly unknown[],
          accumulate: (prev, next) => [...prev, next],
        }
      )

      // Verify handle was created
      expect(handle.channelId).toBe(channelId)
      expect(handle.outletId).toBe(outletId)

      // Cleanup
      yield* service.close(channelId)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("channelOutletAtomArray creates array accumulator", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = createTestChannel()
      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // Outlet ID format: ${channelId}:outlet:${localId}
      const outletId = `${channelId}:outlet:output` as OutletId

      const handle = yield* channelOutletAtomArray<number>(
        channelId,
        outletId,
        { maxItems: 100 }
      )

      // Initial value should be empty array
      const initialValue = handle._registry.get(handle.atom)
      expect(initialValue).toEqual([])

      yield* service.close(channelId)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("channelOutletAtomLatest creates latest-value accumulator", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = createTestChannel()
      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // Outlet ID format: ${channelId}:outlet:${localId}
      const outletId = `${channelId}:outlet:output` as OutletId

      const handle = yield* channelOutletAtomLatest<number>(
        channelId,
        outletId
      )

      // Initial value should be null
      const initialValue = handle._registry.get(handle.atom)
      expect(initialValue).toBeNull()

      yield* service.close(channelId)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("fails with CHANNEL_NOT_FOUND for missing channel", () =>
    Effect.gen(function* () {
      const result = yield* channelOutletAtom(
        "nonexistent" as ChannelId,
        "output" as OutletId,
        {
          initialValue: [],
          accumulate: (prev, next) => [...prev, next],
        }
      ).pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("CHANNEL_NOT_FOUND")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("fails with OUTLET_NOT_FOUND for missing outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = createTestChannel()
      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const result = yield* channelOutletAtom(
        channelId,
        "nonexistent" as OutletId,
        {
          initialValue: [],
          accumulate: (prev, next) => [...prev, next],
        }
      ).pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("OUTLET_NOT_FOUND")
      }

      yield* service.close(channelId)
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})
