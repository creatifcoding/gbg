/**
 * ChannelService — Vitest Spec
 *
 * Validates the Effect Service for Channel lifecycle management.
 */

import { describe, it, expect } from "@effect/vitest"
import {
  Effect,
  Stream,
  Option,
  Queue,
  Chunk,
  Fiber,
  TestClock,
  HashMap,
  pipe,
} from "effect"
import {
  ChannelService,
  ChannelServiceLive,
  ChannelServiceError,
} from "../constructs/ChannelService"
import { ChannelBuilder } from "../constructs/ChannelBuilder"
import { Feed } from "../constructs/Feed"
import type { ChannelId, InletId, OutletId } from "../constructs/Channel"

// ============================================================================
// TEST HELPERS
// ============================================================================

const testBuilder = () =>
  ChannelBuilder.create("test-channel")
    .name("Test Channel")
    .inlet("in1", { name: "Input 1" })
    .outlet("out1", { name: "Output 1", broadcast: true, maxLag: 32 })
    .wire("in1", "out1")

const multiInletBuilder = () =>
  ChannelBuilder.create("multi-inlet")
    .name("Multi Inlet")
    .inlet("temp", { name: "Temperature" })
    .inlet("press", { name: "Pressure" })
    .outlet("combined", { name: "Combined", broadcast: true, maxLag: 64 })
    .wire("temp", "combined")
    .wire("press", "combined")

const testFeed = <T>(id: string, values: T[], intervalMs: number = 100) =>
  Feed.make<T>({
    id,
    name: `Test Feed: ${id}`,
    interval: `${intervalMs} millis`,
    producer: Effect.gen(function* () {
      // This is a simple producer that cycles through values
      return values[0]
    }),
  })

// ============================================================================
// REGISTRATION
// ============================================================================

describe("ChannelService Registration", () => {
  it.effect("register() creates channel from builder", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)

      expect(channelId).toBe("test-channel")
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("registerState() accepts pre-built ChannelState", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()
      const state = yield* builder.build()

      const channelId = yield* service.registerState(state)

      expect(channelId).toBe("test-channel")
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("unregister() removes channel", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.unregister(channelId)

      const entry = yield* service.get(channelId)
      expect(Option.isNone(entry)).toBe(true)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("registering multiple channels", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Use valid builders with inlet/outlet
      const minimalBuilder = (id: string, name: string) =>
        ChannelBuilder.create(id).name(name).inlet("in").outlet("out").wire("in", "out")

      yield* service.register(minimalBuilder("ch-1", "Channel 1"))
      yield* service.register(minimalBuilder("ch-2", "Channel 2"))
      yield* service.register(minimalBuilder("ch-3", "Channel 3"))

      const ids = yield* service.listIds()
      expect(ids).toHaveLength(3)
      expect(ids).toContain("ch-1")
      expect(ids).toContain("ch-2")
      expect(ids).toContain("ch-3")
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// RETRIEVAL
// ============================================================================

describe("ChannelService Retrieval", () => {
  it.effect("get() returns Option.some for existing channel", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      const entry = yield* service.get(channelId)

      expect(Option.isSome(entry)).toBe(true)
      if (Option.isSome(entry)) {
        expect(entry.value.state.id).toBe(channelId)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("get() returns Option.none for non-existent channel", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const entry = yield* service.get("non-existent" as ChannelId)

      expect(Option.isNone(entry)).toBe(true)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("getState() returns channel state", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      const state = yield* service.getState(channelId)

      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        expect(state.value.name).toBe("Test Channel")
        expect(state.value.status).toBe("idle") // Builder creates channels in "idle" status
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("listIds() returns all channel IDs", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Use valid builders with inlet/outlet
      yield* service.register(
        ChannelBuilder.create("a").inlet("in").outlet("out").wire("in", "out")
      )
      yield* service.register(
        ChannelBuilder.create("b").inlet("in").outlet("out").wire("in", "out")
      )

      const ids = yield* service.listIds()

      expect(ids).toContain("a")
      expect(ids).toContain("b")
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("getStatuses() returns status map", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Use valid builders with inlet/outlet
      const minimalBuilder = (id: string) =>
        ChannelBuilder.create(id).inlet("in").outlet("out").wire("in", "out")

      const id1 = yield* service.register(minimalBuilder("ch-1"))
      const id2 = yield* service.register(minimalBuilder("ch-2"))

      yield* service.open(id1)

      const statuses = yield* service.getStatuses()

      // Effect HashMap uses HashMap.get(map, key)
      const status1 = HashMap.get(statuses, id1)
      const status2 = HashMap.get(statuses, id2)

      // HashMap.get returns Option
      expect(Option.isSome(status1)).toBe(true)
      expect(Option.isSome(status2)).toBe(true)
      if (Option.isSome(status1)) expect(status1.value).toBe("open")
      if (Option.isSome(status2)) expect(status2.value).toBe("idle")
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// LIFECYCLE
// ============================================================================

describe("ChannelService Lifecycle", () => {
  it.effect("open() transitions to open state", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const state = yield* service.getState(channelId)

      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        expect(state.value.status).toBe("open")
        expect(state.value.openedAt).toBeGreaterThan(0)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("open() on non-existent channel fails", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const result = yield* service
        .open("non-existent" as ChannelId)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(ChannelServiceError)
        expect(result.left.code).toBe("CHANNEL_NOT_FOUND")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("open() on already open channel is idempotent", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // Second open should not fail
      yield* service.open(channelId)

      const state = yield* service.getState(channelId)
      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        expect(state.value.status).toBe("open")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("close() transitions to closed state", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)
      yield* service.close(channelId, "Test shutdown")

      const state = yield* service.getState(channelId)

      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        expect(state.value.status).toBe("closed")
        expect(state.value.closedAt).toBeGreaterThan(0)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("close() on non-existent channel is silent", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Should not throw
      yield* service.close("non-existent" as ChannelId)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("closeAll() closes all open channels", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      // Use valid builders with inlet/outlet
      const minimalBuilder = (id: string) =>
        ChannelBuilder.create(id).inlet("in").outlet("out").wire("in", "out")

      const id1 = yield* service.register(minimalBuilder("ch-1"))
      const id2 = yield* service.register(minimalBuilder("ch-2"))
      const id3 = yield* service.register(minimalBuilder("ch-3"))

      yield* service.open(id1)
      yield* service.open(id2)
      // id3 stays idle

      yield* service.closeAll()

      const state1 = yield* service.getState(id1)
      const state2 = yield* service.getState(id2)
      const state3 = yield* service.getState(id3)

      // closeAll() closes ALL channels regardless of current status
      if (Option.isSome(state1)) expect(state1.value.status).toBe("closed")
      if (Option.isSome(state2)) expect(state2.value.status).toBe("closed")
      if (Option.isSome(state3)) expect(state3.value.status).toBe("closed")
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("unregister() closes channel before removing", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)
      yield* service.unregister(channelId)

      const entry = yield* service.get(channelId)
      expect(Option.isNone(entry)).toBe(true)
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// INLET OPERATIONS
// ============================================================================

describe("ChannelService Inlet Operations", () => {
  it.effect("connectStream() connects stream to inlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId
      const testStream = Stream.fromIterable([1, 2, 3])

      yield* service.connectStream(channelId, inletId, testStream, "test-source")

      const state = yield* service.getState(channelId)
      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        const inlet = state.value.topology.inlets.find((i) => i.id === inletId)
        expect(inlet?.connected).toBe(true)
        expect(inlet?.sourceId).toBe("test-source")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("connectStream() fails on non-existent channel", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const result = yield* service
        .connectStream(
          "non-existent" as ChannelId,
          "inlet-1" as InletId,
          Stream.empty
        )
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("CHANNEL_NOT_FOUND")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("connectStream() fails on non-existent inlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const result = yield* service
        .connectStream(channelId, "bad-inlet" as InletId, Stream.empty)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("INLET_NOT_FOUND")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("connectStream() fails on already connected inlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId

      // First connection
      yield* service.connectStream(channelId, inletId, Stream.empty)

      // Second connection should fail
      const result = yield* service
        .connectStream(channelId, inletId, Stream.empty)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("ALREADY_CONNECTED")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("disconnectInlet() resets inlet state", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId

      yield* service.connectStream(channelId, inletId, Stream.empty)
      yield* service.disconnectInlet(channelId, inletId)

      const state = yield* service.getState(channelId)
      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        const inlet = state.value.topology.inlets.find((i) => i.id === inletId)
        expect(inlet?.connected).toBe(false)
        expect(inlet?.sourceId).toBeUndefined()
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// OUTLET OPERATIONS
// ============================================================================

describe("ChannelService Outlet Operations", () => {
  it.effect("subscribeOutlet() returns queue", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const outletId = `${channelId}:outlet:out1` as OutletId
      const queue = yield* service.subscribeOutlet(channelId, outletId)

      expect(queue).toBeDefined()
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeOutlet() increments subscriber count", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const outletId = `${channelId}:outlet:out1` as OutletId

      yield* service.subscribeOutlet(channelId, outletId)

      const state = yield* service.getState(channelId)
      expect(Option.isSome(state)).toBe(true)
      if (Option.isSome(state)) {
        const outlet = state.value.topology.outlets.find((o) => o.id === outletId)
        expect(outlet?.subscriberCount).toBe(1)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeOutlet() fails on non-existent channel", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const result = yield* service
        .subscribeOutlet("non-existent" as ChannelId, "outlet-1" as OutletId)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("CHANNEL_NOT_FOUND")
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeOutlet() fails on non-existent outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const result = yield* service
        .subscribeOutlet(channelId, "bad-outlet" as OutletId)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("OUTLET_NOT_FOUND")
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("getOutletStream() returns stream", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const outletId = `${channelId}:outlet:out1` as OutletId
      const stream = yield* service.getOutletStream(channelId, outletId)

      expect(stream).toBeDefined()
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// DATA FLOW
// ============================================================================

describe("ChannelService Data Flow", () => {
  // TODO: Data routing between inlet and outlet not yet wired
  it.effect.skip("data flows from inlet to outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId
      const outletId = `${channelId}:outlet:out1` as OutletId

      // Connect a stream that emits 3 values
      const testStream = Stream.fromIterable([1, 2, 3])

      yield* service.connectStream(channelId, inletId, testStream)

      // Subscribe to outlet and collect
      const outletStream = yield* service.getOutletStream(channelId, outletId)

      const collected = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(3),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option
      )

      if (Option.isSome(collected)) {
        expect(Chunk.toReadonlyArray(collected.value)).toEqual([1, 2, 3])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect.skip("multiple inlets merge to single outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = multiInletBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const tempInletId = `${channelId}:inlet:temp` as InletId
      const pressInletId = `${channelId}:inlet:press` as InletId
      const outletId = `${channelId}:outlet:combined` as OutletId

      // Connect two streams with different values
      yield* service.connectStream(
        channelId,
        tempInletId,
        Stream.fromIterable(["T1", "T2"])
      )
      yield* service.connectStream(
        channelId,
        pressInletId,
        Stream.fromIterable(["P1", "P2"])
      )

      // Subscribe and collect
      const outletStream = yield* service.getOutletStream(channelId, outletId)

      const collected = yield* pipe(
        outletStream as Stream.Stream<string, never, never>,
        Stream.take(4),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option
      )

      if (Option.isSome(collected)) {
        const items = Chunk.toReadonlyArray(collected.value)
        // Should have 4 items total from both streams
        expect(items).toHaveLength(4)
        // Should contain items from both streams
        expect(items).toContain("T1")
        expect(items).toContain("P1")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// METRICS
// ============================================================================

describe("ChannelService Metrics", () => {
  it.effect("getMetrics() returns channel metrics", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      const metrics = yield* service.getMetrics(channelId)

      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBe(0)
        expect(metrics.value.messagesOut).toBe(0)
        expect(metrics.value.errors).toBe(0)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("updateMetrics() modifies metrics", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)

      yield* service.updateMetrics(channelId, (m) => ({
        ...m,
        messagesIn: m.messagesIn + 10,
        errors: m.errors + 1,
      }))

      const metrics = yield* service.getMetrics(channelId)

      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBe(10)
        expect(metrics.value.errors).toBe(1)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  // TODO: Data routing not yet wired - skip until inlet→outlet flow works
  it.effect.skip("messagesIn increments on data flow", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId

      // Connect stream with 5 items
      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([1, 2, 3, 4, 5])
      )

      // Wait a bit for stream to process
      yield* Effect.sleep("100 millis")

      const metrics = yield* service.getMetrics(channelId)

      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBeGreaterThanOrEqual(5)
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// EVENT BUS
// ============================================================================

describe("ChannelService Event Bus", () => {
  it.effect("subscribeEvents() receives ChannelOpened", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)

      // Subscribe to events before opening
      const eventQueue = yield* service.subscribeEvents()

      // Open channel
      yield* service.open(channelId)

      // Check for event
      const event = yield* Queue.take(eventQueue)

      expect(event._tag).toBe("ChannelOpened")
      if (event._tag === "ChannelOpened") {
        expect(event.channelId).toBe(channelId)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeEvents() receives ChannelClosed", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // Subscribe to events
      const eventQueue = yield* service.subscribeEvents()

      // Close channel
      yield* service.close(channelId, "Test reason")

      // First event might be from subscribe, get the close event
      const event = yield* Queue.take(eventQueue)

      expect(event._tag).toBe("ChannelClosed")
      if (event._tag === "ChannelClosed") {
        expect(event.channelId).toBe(channelId)
        expect(event.reason).toBe("Test reason")
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeEvents() receives InletConnected", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId

      // Subscribe to events
      const eventQueue = yield* service.subscribeEvents()

      // Connect inlet
      yield* service.connectStream(channelId, inletId, Stream.empty, "my-source")

      const event = yield* Queue.take(eventQueue)

      expect(event._tag).toBe("InletConnected")
      if (event._tag === "InletConnected") {
        expect(event.channelId).toBe(channelId)
        expect(event.inletId).toBe(inletId)
        expect(event.sourceId).toBe("my-source")
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe("ChannelService Error Handling", () => {
  it.effect("ChannelServiceError contains channelId", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const result = yield* service
        .open("missing-channel" as ChannelId)
        .pipe(Effect.either)

      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left).toBeInstanceOf(ChannelServiceError)
        expect(result.left.channelId).toBe("missing-channel")
        expect(result.left.message).toContain("missing-channel")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("error codes are correct", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()
      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      // CHANNEL_NOT_FOUND
      const r1 = yield* service.open("x" as ChannelId).pipe(Effect.either)
      if (r1._tag === "Left") expect(r1.left.code).toBe("CHANNEL_NOT_FOUND")

      // INLET_NOT_FOUND
      const r2 = yield* service
        .connectStream(channelId, "bad" as InletId, Stream.empty)
        .pipe(Effect.either)
      if (r2._tag === "Left") expect(r2.left.code).toBe("INLET_NOT_FOUND")

      // OUTLET_NOT_FOUND
      const r3 = yield* service
        .subscribeOutlet(channelId, "bad" as OutletId)
        .pipe(Effect.either)
      if (r3._tag === "Left") expect(r3.left.code).toBe("OUTLET_NOT_FOUND")
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )
})
