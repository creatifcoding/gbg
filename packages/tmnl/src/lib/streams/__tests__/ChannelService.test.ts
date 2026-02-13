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
  Ref,
  PubSub,
  pipe,
  Schema,
} from "effect"
import {
  ChannelService,
  ChannelServiceLive,
  ChannelServiceError,
  outletHandle,
  subscribeOutletHandle,
  getOutletStreamHandle,
} from "../constructs/ChannelService"
import { ChannelBuilder } from "../constructs/ChannelBuilder"
import { Feed } from "../constructs/Feed"
import { ResetCircuitBreaker } from "../constructs/Channel"
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

  it.effect("connectStream() enforces inlet schema and routes typed payloads", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = ChannelBuilder.create("typed-inlet")
        .inlet("typed", {
          schema: Schema.Struct({
            value: Schema.Number,
          }),
        })
        .outlet("out")
        .wire("typed", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:typed` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId
      const outletStream = yield* service.getOutletStream<{ readonly value: number }>(
        channelId,
        outletId
      )

      const payloadFiber = yield* pipe(
        outletStream,
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      )

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([{ value: 42 }])
      )

      const payloads = yield* Fiber.join(payloadFiber)
      expect(Chunk.toReadonlyArray(payloads)).toEqual([{ value: 42 }])
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("connectStream() increments errors on inlet schema validation failure", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = ChannelBuilder.create("typed-inlet-invalid")
        .inlet("typed", {
          schema: Schema.Struct({
            value: Schema.Number,
          }),
        })
        .outlet("out")
        .wire("typed", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:typed` as InletId
      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([{ value: "nope" }])
      )

      yield* TestClock.adjust("50 millis")

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.errors).toBeGreaterThan(0)
        expect(metrics.value.messagesIn).toBe(0)
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

  it.effect("outlet schema decodes payload before publish", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("typed-outlet")
        .inlet("in")
        .outlet("out", {
          broadcast: true,
          schema: Schema.Struct({
            at: Schema.DateFromString,
          }),
        })
        .wire("in", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId
      const queue = yield* service.subscribeOutlet<{ at: Date }>(channelId, outletId)

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([{ at: "2026-02-09T00:00:00.000Z" }])
      )

      const maybeDecoded = yield* pipe(
        Queue.take(queue),
        Effect.timeout("1 second"),
        Effect.option
      )

      expect(Option.isSome(maybeDecoded)).toBe(true)
      if (Option.isSome(maybeDecoded)) {
        expect(maybeDecoded.value.at).toBeInstanceOf(Date)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("outlet schema validation failure increments errors and suppresses publish", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("typed-outlet-invalid")
        .inlet("in")
        .outlet("out", {
          broadcast: true,
          schema: Schema.Struct({
            value: Schema.Number,
          }),
        })
        .wire("in", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId
      const queue = yield* service.subscribeOutlet(channelId, outletId)
      const eventQueue = yield* service.subscribeEvents()

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([{ nope: true }])
      )

      yield* TestClock.adjust("20 millis")

      const maybePublished = yield* Queue.poll(queue)
      expect(Option.isNone(maybePublished)).toBe(true)

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.errors).toBeGreaterThanOrEqual(1)
      }

      const seenTags: string[] = []
      for (let i = 0; i < 40; i++) {
        const maybeEvent = yield* Queue.poll(eventQueue)
        if (Option.isSome(maybeEvent)) {
          seenTags.push(maybeEvent.value._tag)
        }
        yield* Effect.yieldNow()
      }

      expect(seenTags).toContain("ChannelFaulted")
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("subscribeOutletHandle infers output type from schema handle", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const OutletSchema = Schema.Struct({ at: Schema.DateFromString })

      const builder = ChannelBuilder.create("typed-outlet-handle")
        .inlet("in")
        .outlet("out", {
          broadcast: true,
          schema: OutletSchema,
        })
        .wire("in", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId
      const handle = outletHandle(channelId, outletId, OutletSchema)
      const queue = yield* subscribeOutletHandle(handle)

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([{ at: "2026-02-09T00:00:00.000Z" }])
      )

      const maybeValue = yield* pipe(
        Queue.take(queue),
        Effect.timeout("1 second"),
        Effect.option
      )
      expect(Option.isSome(maybeValue)).toBe(true)
      if (Option.isSome(maybeValue)) {
        expect(maybeValue.value.at).toBeInstanceOf(Date)
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("typed outlet handle fails fast on schema mismatch", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const ConfiguredSchema = Schema.Struct({ value: Schema.Number })
      const MismatchSchema = Schema.Struct({ value: Schema.String })

      const builder = ChannelBuilder.create("typed-outlet-handle-mismatch")
        .inlet("in")
        .outlet("out", {
          broadcast: true,
          schema: ConfiguredSchema,
        })
        .wire("in", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const outletId = `${channelId}:outlet:out` as OutletId
      const handle = outletHandle(channelId, outletId, MismatchSchema)

      const result = yield* subscribeOutletHandle(handle).pipe(Effect.either)
      expect(result._tag).toBe("Left")
      if (result._tag === "Left") {
        expect(result.left.code).toBe("BUILD_FAILED")
      }

      const mismatchStreamResult = yield* getOutletStreamHandle(handle).pipe(Effect.either)
      expect(mismatchStreamResult._tag).toBe("Left")
      if (mismatchStreamResult._tag === "Left") {
        expect(mismatchStreamResult.left.code).toBe("BUILD_FAILED")
      }
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )
})

// ============================================================================
// DATA FLOW
// ============================================================================

describe("ChannelService Data Flow", () => {
  it.effect("data flows from inlet to outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId
      const outletId = `${channelId}:outlet:out1` as OutletId

      // Subscribe first so we don't miss early publications.
      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(3),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()

      // Connect a stream that emits 3 values
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

      const collected = yield* Fiber.join(collectorFiber)

      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        expect(Chunk.toReadonlyArray(collected.value)).toEqual([1, 2, 3])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("multiple inlets merge to single outlet", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = multiInletBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const tempInletId = `${channelId}:inlet:temp` as InletId
      const pressInletId = `${channelId}:inlet:press` as InletId
      const outletId = `${channelId}:outlet:combined` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<string, never, never>,
        Stream.take(4),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()

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

      const collected = yield* Fiber.join(collectorFiber)

      expect(Option.isSome(collected)).toBe(true)
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

  it.effect("merge junction fan-in preserves all upstream payloads", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-merge-fanin")
        .inlet("a")
        .inlet("b")
        .junction("j", {
          kind: "merge",
        })
        .outlet("out", { broadcast: true })
        .wire("a", "j")
        .wire("b", "j")
        .wire("j", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletA = `${channelId}:inlet:a` as InletId
      const inletB = `${channelId}:inlet:b` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<string, never, never>,
        Stream.take(4),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletA, Stream.fromIterable(["A1", "A2"]))
      yield* service.connectStream(channelId, inletB, Stream.fromIterable(["B1", "B2"]))

      const collected = yield* Fiber.join(collectorFiber)
      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        const values = Chunk.toReadonlyArray(collected.value)
        expect(values).toHaveLength(4)
        expect(values).toContain("A1")
        expect(values).toContain("A2")
        expect(values).toContain("B1")
        expect(values).toContain("B2")
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("broadcast junction fans out to multiple outlets", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-broadcast-fanout")
        .inlet("in")
        .junction("j", {
          kind: "broadcast",
        })
        .outlet("outA", { broadcast: true })
        .outlet("outB", { broadcast: true })
        .wire("in", "j")
        .wire("j", "outA")
        .wire("j", "outB")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outAId = `${channelId}:outlet:outA` as OutletId
      const outBId = `${channelId}:outlet:outB` as OutletId

      const outAStream = yield* service.getOutletStream(channelId, outAId)
      const outBStream = yield* service.getOutletStream(channelId, outBId)

      const collectorAFiber = yield* pipe(
        outAStream as Stream.Stream<number, never, never>,
        Stream.take(2),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      const collectorBFiber = yield* pipe(
        outBStream as Stream.Stream<number, never, never>,
        Stream.take(2),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2]))

      const outACollected = yield* Fiber.join(collectorAFiber)
      const outBCollected = yield* Fiber.join(collectorBFiber)

      expect(Option.isSome(outACollected)).toBe(true)
      expect(Option.isSome(outBCollected)).toBe(true)
      if (Option.isSome(outACollected) && Option.isSome(outBCollected)) {
        expect(Chunk.toReadonlyArray(outACollected.value)).toEqual([1, 2])
        expect(Chunk.toReadonlyArray(outBCollected.value)).toEqual([1, 2])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("map junction applies transform config", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-map")
        .inlet("in")
        .junction("j", {
          kind: "map",
          config: {
            map: (value: unknown) => Number(value) * 2,
          },
        })
        .outlet("out", { broadcast: true })
        .wire("in", "j")
        .wire("j", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(3),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

      const collected = yield* Fiber.join(collectorFiber)

      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        expect(Chunk.toReadonlyArray(collected.value)).toEqual([2, 4, 6])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("filter junction applies predicate config", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-filter")
        .inlet("in")
        .junction("j", {
          kind: "filter",
          config: {
            predicate: (value: unknown) => Number(value) % 2 === 1,
          },
        })
        .outlet("out", { broadcast: true })
        .wire("in", "j")
        .wire("j", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(2),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

      const collected = yield* Fiber.join(collectorFiber)

      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        expect(Chunk.toReadonlyArray(collected.value)).toEqual([1, 3])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("partition junction emits annotated branch payloads", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-partition")
        .inlet("in")
        .junction("j", {
          kind: "partition",
          config: {
            predicate: (value: unknown) => Number(value) % 2 === 0,
            leftLabel: "even",
            rightLabel: "odd",
          },
        })
        .outlet("out", { broadcast: true })
        .wire("in", "j")
        .wire("j", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<
          { readonly _tag: string; readonly branch: string; readonly value: number },
          never,
          never
        >,
        Stream.take(3),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

      const collected = yield* Fiber.join(collectorFiber)
      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        const values = Chunk.toReadonlyArray(collected.value)
        expect(values.map((v) => v._tag)).toEqual([
          "Partitioned",
          "Partitioned",
          "Partitioned",
        ])
        expect(values.map((v) => v.branch)).toEqual(["odd", "even", "odd"])
        expect(values.map((v) => v.value)).toEqual([1, 2, 3])
      }
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it(
    "partition junction without predicate faults and increments errors",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-partition-invalid")
          .inlet("in")
          .junction("j", {
            kind: "partition",
            config: {},
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId

        yield* service.connectStream(channelId, inletId, Stream.fromIterable([1]))
        yield* Effect.sleep("5 millis")

        const metrics = yield* service.getMetrics(channelId)
        expect(Option.isSome(metrics)).toBe(true)
        if (Option.isSome(metrics)) {
          expect(metrics.value.errors).toBeGreaterThanOrEqual(1)
          expect(metrics.value.messagesOut).toBe(0)
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )

  it.effect("throttle junction enforces interval", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("junction-throttle")
        .inlet("in")
        .junction("j", {
          kind: "throttle",
          config: {
            intervalMs: 100,
          },
        })
        .outlet("out", { broadcast: true })
        .wire("in", "j")
        .wire("j", "out")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(1),
        Stream.runCollect,
        Effect.fork
      )

      yield* Effect.yieldNow()
      yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

      const collected = yield* Fiber.join(collectorFiber)
      expect(Chunk.toReadonlyArray(collected)).toEqual([1])
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it(
    "debounce junction emits trailing value",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-debounce")
          .inlet("in")
          .junction("j", {
            kind: "debounce",
            config: {
              waitMs: 40,
            },
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId
        const outletId = `${channelId}:outlet:out` as OutletId

        const outletStream = yield* service.getOutletStream(channelId, outletId)
        const collectorFiber = yield* pipe(
          outletStream as Stream.Stream<number, never, never>,
          Stream.take(1),
          Stream.runCollect,
          Effect.timeout("2 seconds"),
          Effect.option,
          Effect.fork
        )

        yield* Effect.sleep("1 millis")
        yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

        const collected = yield* Fiber.join(collectorFiber)
        expect(Option.isSome(collected)).toBe(true)
        if (Option.isSome(collected)) {
          expect(Chunk.toReadonlyArray(collected.value)).toEqual([3])
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )

  it(
    "buffer junction applies drop-oldest with flush interval",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-buffer")
          .inlet("in")
          .junction("j", {
            kind: "buffer",
            config: {
              capacity: 2,
              strategy: "drop-oldest",
              flushMs: 80,
            },
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId
        const outletId = `${channelId}:outlet:out` as OutletId

        const outletStream = yield* service.getOutletStream(channelId, outletId)
        const collectorFiber = yield* pipe(
          outletStream as Stream.Stream<number, never, never>,
          Stream.take(2),
          Stream.runCollect,
          Effect.timeout("2 seconds"),
          Effect.option,
          Effect.fork
        )

        yield* Effect.sleep("1 millis")
        yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3, 4]))

        const collected = yield* Fiber.join(collectorFiber)
        expect(Option.isSome(collected)).toBe(true)
        if (Option.isSome(collected)) {
          expect(Chunk.toReadonlyArray(collected.value)).toEqual([3, 4])
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )

  it(
    "buffer junction error strategy faults and counts overflow",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-buffer-error")
          .inlet("in")
          .junction("j", {
            kind: "buffer",
            config: {
              capacity: 1,
              strategy: "error",
              flushMs: 80,
            },
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId
        const outletId = `${channelId}:outlet:out` as OutletId

        const outletStream = yield* service.getOutletStream(channelId, outletId)
        const collectorFiber = yield* pipe(
          outletStream as Stream.Stream<number, never, never>,
          Stream.take(1),
          Stream.runCollect,
          Effect.timeout("2 seconds"),
          Effect.option,
          Effect.fork
        )

        yield* Effect.sleep("1 millis")
        yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

        const collected = yield* Fiber.join(collectorFiber)
        expect(Option.isSome(collected)).toBe(true)
        if (Option.isSome(collected)) {
          expect(Chunk.toReadonlyArray(collected.value)).toEqual([1])
        }

        const metrics = yield* service.getMetrics(channelId)
        expect(Option.isSome(metrics)).toBe(true)
        if (Option.isSome(metrics)) {
          expect(metrics.value.errors).toBeGreaterThanOrEqual(1)
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )

  it(
    "buffer junction block strategy backpressures instead of dropping",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-buffer-block")
          .inlet("in")
          .junction("j", {
            kind: "buffer",
            config: {
              capacity: 1,
              strategy: "block",
              flushMs: 30,
            },
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId
        const outletId = `${channelId}:outlet:out` as OutletId

        const outletStream = yield* service.getOutletStream(channelId, outletId)
        const collectorFiber = yield* pipe(
          outletStream as Stream.Stream<number, never, never>,
          Stream.take(3),
          Stream.runCollect,
          Effect.timeout("2 seconds"),
          Effect.option,
          Effect.fork
        )

        yield* Effect.sleep("1 millis")
        yield* service.connectStream(channelId, inletId, Stream.fromIterable([1, 2, 3]))

        const collected = yield* Fiber.join(collectorFiber)
        expect(Option.isSome(collected)).toBe(true)
        if (Option.isSome(collected)) {
          expect(Chunk.toReadonlyArray(collected.value)).toEqual([1, 2, 3])
        }

        const metrics = yield* service.getMetrics(channelId)
        expect(Option.isSome(metrics)).toBe(true)
        if (Option.isSome(metrics)) {
          expect(metrics.value.errors).toBe(0)
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )

  it(
    "timeout junction fail behavior increments errors",
    async () => {
      const program = Effect.gen(function* () {
        const service = yield* ChannelService

        const builder = ChannelBuilder.create("junction-timeout")
          .inlet("in")
          .junction("j", {
            kind: "timeout",
            config: {
              timeoutMs: 1,
              behavior: "fail",
            },
          })
          .outlet("out", { broadcast: true })
          .wire("in", "j")
          .wire("j", "out")

        const channelId = yield* service.register(builder)
        yield* service.open(channelId)

        const inletId = `${channelId}:inlet:in` as InletId

        const stalePayload = {
          value: 1,
          timestamp: Date.now() - 1_000,
        }

        yield* service.connectStream(channelId, inletId, Stream.fromIterable([stalePayload]))
        yield* Effect.sleep("5 millis")

        const metrics = yield* service.getMetrics(channelId)
        expect(Option.isSome(metrics)).toBe(true)
        if (Option.isSome(metrics)) {
          expect(metrics.value.errors).toBeGreaterThanOrEqual(1)
        }
      }).pipe(Effect.provide(ChannelServiceLive))

      await Effect.runPromise(program)
    },
    15_000
  )
})

// ============================================================================
// PROTOCOL RUNTIME ENFORCEMENT
// ============================================================================

describe("ChannelService Protocol Runtime", () => {
  it.effect("retry protocol retries failing inlet stream and eventually delivers", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const attemptsRef = yield* Ref.make(0)

      const builder = ChannelBuilder.create("protocol-retry")
        .inlet("in")
        .outlet("out", { broadcast: true })
        .wire("in", "out")
        .retry(1, "fixed", "1 millis")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId

      const flakyStream = Stream.unwrap(
        pipe(
          Ref.updateAndGet(attemptsRef, (n) => n + 1),
          Effect.map((attempt) =>
            attempt === 1
              ? Stream.fail(new Error("flaky-source"))
              : Stream.fromIterable([11, 12])
          )
        )
      )

      const outletStream = yield* service.getOutletStream<number>(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream,
        Stream.take(2),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* service.connectStream(channelId, inletId, flakyStream)
      yield* TestClock.adjust("50 millis")

      const collected = yield* Fiber.join(collectorFiber)
      expect(Option.isSome(collected)).toBe(true)
      if (Option.isSome(collected)) {
        expect(Chunk.toReadonlyArray(collected.value)).toEqual([11, 12])
      }

      const attempts = yield* Ref.get(attemptsRef)
      expect(attempts).toBe(2)
    }).pipe(Effect.provide(ChannelServiceLive))
  )

  it.effect("command ResetCircuitBreaker resets an open circuit after trip", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("protocol-circuit-command")
        .inlet("in")
        .outlet("out", { broadcast: true })
        .wire("in", "out")
        .timeout("1 millis", "fail")
        .circuitBreaker(1, "50 millis")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const eventQueue = yield* service.subscribeEvents()

      const stalePayload = {
        value: 1,
        timestamp: Date.now() - 5_000,
      }

      yield* service.connectStream(channelId, inletId, Stream.fromIterable([stalePayload]))

      const seenTags: string[] = []
      for (let i = 0; i < 40; i++) {
        const maybeEvent = yield* Queue.poll(eventQueue)
        if (Option.isSome(maybeEvent)) {
          seenTags.push(maybeEvent.value._tag)
        }
        yield* Effect.yieldNow()
      }

      expect(seenTags).toContain("TimeoutOccurred")
      expect(seenTags).toContain("CircuitBreakerTripped")

      const stateBeforeReset = yield* service.getState(channelId)
      expect(Option.isSome(stateBeforeReset)).toBe(true)
      if (Option.isSome(stateBeforeReset)) {
        expect(stateBeforeReset.value.protocol.circuitBreaker?.state).toBe("open")
      }

      yield* PubSub.publish(service.commands, new ResetCircuitBreaker({ channelId }))

      const postResetTags: string[] = []
      for (let i = 0; i < 40; i++) {
        const maybeEvent = yield* Queue.poll(eventQueue)
        if (Option.isSome(maybeEvent)) {
          postResetTags.push(maybeEvent.value._tag)
        }
        yield* Effect.yieldNow()
      }

      const stateAfterReset = yield* service.getState(channelId)
      expect(Option.isSome(stateAfterReset)).toBe(true)
      if (Option.isSome(stateAfterReset)) {
        const circuit = stateAfterReset.value.protocol.circuitBreaker
        expect(circuit?.state).toBe("closed")
        expect(circuit?.failureCount).toBe(0)
      }

      expect(postResetTags).toContain("CircuitBreakerReset")
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
  )

  it.effect("channel-level timeout fail behavior faults stale payloads", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService

      const builder = ChannelBuilder.create("protocol-timeout")
        .inlet("in")
        .outlet("out", { broadcast: true })
        .wire("in", "out")
        .timeout("1 millis", "fail")

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in` as InletId
      const outletId = `${channelId}:outlet:out` as OutletId
      const eventQueue = yield* service.subscribeEvents()
      const outletQueue = yield* service.subscribeOutlet(channelId, outletId)

      const stalePayload = {
        value: 1,
        timestamp: Date.now() - 5_000,
      }

      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([stalePayload])
      )

      yield* TestClock.adjust("10 millis")

      const metrics = yield* service.getMetrics(channelId)
      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.errors).toBeGreaterThanOrEqual(1)
        expect(metrics.value.messagesOut).toBe(0)
      }

      const maybeOutput = yield* Queue.poll(outletQueue)
      expect(Option.isNone(maybeOutput)).toBe(true)

      const events = yield* Queue.takeUpTo(eventQueue, 20)
      const tags = Chunk.toReadonlyArray(events).map((event) => event._tag)
      expect(tags).toContain("TimeoutOccurred")
    }).pipe(Effect.scoped, Effect.provide(ChannelServiceLive))
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

  it.effect("messagesIn increments on data flow", () =>
    Effect.gen(function* () {
      const service = yield* ChannelService
      const builder = testBuilder()

      const channelId = yield* service.register(builder)
      yield* service.open(channelId)

      const inletId = `${channelId}:inlet:in1` as InletId
      const outletId = `${channelId}:outlet:out1` as OutletId

      // Subscribe before connect to keep the routing path active.
      const outletStream = yield* service.getOutletStream(channelId, outletId)
      const collectorFiber = yield* pipe(
        outletStream as Stream.Stream<number, never, never>,
        Stream.take(5),
        Stream.runCollect,
        Effect.timeout("1 second"),
        Effect.option,
        Effect.fork
      )

      yield* Effect.yieldNow()

      // Connect stream with 5 items
      yield* service.connectStream(
        channelId,
        inletId,
        Stream.fromIterable([1, 2, 3, 4, 5])
      )

      const collected = yield* Fiber.join(collectorFiber)
      expect(Option.isSome(collected)).toBe(true)

      const metrics = yield* service.getMetrics(channelId)

      expect(Option.isSome(metrics)).toBe(true)
      if (Option.isSome(metrics)) {
        expect(metrics.value.messagesIn).toBeGreaterThanOrEqual(5)
        expect(metrics.value.messagesOut).toBeGreaterThanOrEqual(5)
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
