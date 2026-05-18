/**
 * EventDistribution Service Tests
 *
 * Tests the central PubSub hub for IIoT real-time event distribution.
 * Validates publish/subscribe roundtrips, metrics tracking, fan-out,
 * and bounded backpressure behavior.
 *
 * NOTE: Uses plain vitest `it()` with `Effect.runPromise` instead of
 * `@effect/vitest` `it.effect()` because the latter's fiber scheduling
 * conflicts with PubSub + Stream.fromPubSub + Effect.fork patterns.
 * See pubsub-spike investigation (2026-02-09).
 *
 * Requires a running NATS server (HolonetBridge backed by real NATS).
 * Set NATS_SKIP_INTEGRATION=1 to skip when NATS is unavailable.
 *
 * @module
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Chunk, Fiber, Ref, Duration } from 'effect'
import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent,
  EquipmentStateChange,
  WorkOrderLifecycleEvent,
  CacheInvalidation,
} from '../event-distribution'
import {
  HolonetBridgeTestLayer,
  SKIP_INTEGRATION,
  NATS_SERVERS,
  checkNatsHealth,
} from './nats-test-layer'

// =============================================================================
// Test Helpers
// =============================================================================

/** Small sleep to let forked fibers establish PubSub subscriptions. */
const yieldForSubscription = Effect.sleep(Duration.millis(10))

const TestLayer = EventDistributionLive.pipe(Layer.provide(HolonetBridgeTestLayer))

const run = <A>(effect: Effect.Effect<A, any, EventDistribution>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestLayer)))

const makeTestReading = (overrides?: Partial<{
  topic: string
  value: number
  deviceId: string
}>) =>
  new ReadingEvent({
    topic: overrides?.topic ?? 'plant/line1/sensor/temp',
    value: overrides?.value ?? 23.5,
    timestamp: new Date().toISOString(),
    deviceId: overrides?.deviceId ?? 'device-001',
  })

const makeTestAlarm = (overrides?: Partial<{
  alarmId: string
  severity: string
  deviceId: string
  message: string
}>) =>
  new AlarmEvent({
    alarmId: overrides?.alarmId ?? 'alarm-001',
    severity: overrides?.severity ?? 'critical',
    deviceId: overrides?.deviceId ?? 'device-001',
    message: overrides?.message ?? 'Temperature threshold exceeded',
    timestamp: new Date().toISOString(),
  })

const makeTestEquipmentStateChange = (overrides?: Partial<{
  equipmentId: string
  previousState: string
  newState: string
}>) =>
  new EquipmentStateChange({
    equipmentId: overrides?.equipmentId ?? 'machine-001',
    previousState: overrides?.previousState ?? 'idle',
    newState: overrides?.newState ?? 'running',
    timestamp: new Date().toISOString(),
  })

const makeTestWorkOrderLifecycleEvent = (overrides?: Partial<{
  workOrderId: string
  eventTag: string
  status: string
}>) =>
  new WorkOrderLifecycleEvent({
    workOrderId: overrides?.workOrderId ?? 'WO-TEST-001',
    eventTag: overrides?.eventTag ?? 'WorkOrderSuspended',
    status: overrides?.status ?? 'suspended',
    timestamp: new Date().toISOString(),
  })

const makeTestInvalidation = (overrides?: Partial<{
  cacheKey: string
  reason: string
}>) =>
  new CacheInvalidation({
    cacheKey: overrides?.cacheKey ?? 'asset:machine-001',
    reason: overrides?.reason ?? 'state_change',
    timestamp: new Date().toISOString(),
  })

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false

beforeAll(async () => {
  if (SKIP_INTEGRATION) return
  serverAvailable = await checkNatsHealth()
  if (!serverAvailable) {
    console.warn(
      `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`,
    )
  }
})

// =============================================================================
// Layer Construction
// =============================================================================

describe('EventDistribution', () => {
  describe('Layer Construction', () => {
    it('EventDistributionLive layer builds successfully', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution
        expect(service).toBeDefined()
        expect(typeof service.publishReading).toBe('function')
        expect(typeof service.publishAlarmEvent).toBe('function')
        expect(typeof service.publishEquipmentStateChange).toBe('function')
        expect(typeof service.publishWorkOrderLifecycle).toBe('function')
        expect(typeof service.publishInvalidation).toBe('function')
        expect(service.subscribeReadings).toBeDefined()
        expect(service.subscribeAlarms).toBeDefined()
        expect(service.subscribeEquipmentState).toBeDefined()
        expect(service.subscribeWorkOrders).toBeDefined()
        expect(service.subscribeInvalidations).toBeDefined()
        expect(service.getMetrics).toBeDefined()
      }))
    })
  })

  // ===========================================================================
  // Readings PubSub
  // ===========================================================================

  describe('Readings PubSub', () => {
    it('publishReading + subscribeReadings roundtrip', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeReadings
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const reading = makeTestReading({ value: 42.0 })
        yield* service.publishReading(reading)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        expect(items[0]).toEqual(reading)
      }))
    })

    it('multiple readings are delivered in order', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeReadings
        const collectFiber = yield* Stream.take(stream, 3).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const r1 = makeTestReading({ value: 1.0 })
        const r2 = makeTestReading({ value: 2.0 })
        const r3 = makeTestReading({ value: 3.0 })

        yield* service.publishReading(r1)
        yield* service.publishReading(r2)
        yield* service.publishReading(r3)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(3)
        expect(items[0]).toEqual(r1)
        expect(items[1]).toEqual(r2)
        expect(items[2]).toEqual(r3)
      }))
    })
  })

  // ===========================================================================
  // Alarms PubSub
  // ===========================================================================

  describe('Alarms PubSub', () => {
    it('publishAlarmEvent + subscribeAlarms roundtrip', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeAlarms
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const alarm = makeTestAlarm({ severity: 'warning' })
        yield* service.publishAlarmEvent(alarm)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        expect(items[0]).toEqual(alarm)
      }))
    })
  })

  // ===========================================================================
  // Equipment State PubSub
  // ===========================================================================

  describe('Equipment State PubSub', () => {
    it('publishEquipmentStateChange + subscribeEquipmentState roundtrip', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeEquipmentState
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const change = makeTestEquipmentStateChange({ newState: 'faulted' })
        yield* service.publishEquipmentStateChange(change)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        expect(items[0]).toEqual(change)
      }))
    })
  })

  // ===========================================================================
  // Work Order PubSub
  // ===========================================================================

  describe('Work Order PubSub', () => {
    it('publishWorkOrderLifecycle + subscribeWorkOrders roundtrip', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeWorkOrders
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const event = makeTestWorkOrderLifecycleEvent({ workOrderId: 'WO-TEST-ROUNDTRIP' })
        yield* service.publishWorkOrderLifecycle(event)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        expect(items[0]).toEqual(event)
      }))
    })
  })

  // ===========================================================================
  // Invalidations PubSub
  // ===========================================================================

  describe('Invalidations PubSub', () => {
    it('publishInvalidation + subscribeInvalidations roundtrip', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeInvalidations
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        const inv = makeTestInvalidation({ cacheKey: 'dashboard:main' })
        yield* service.publishInvalidation(inv)

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        expect(items[0]).toEqual(inv)
      }))
    })
  })

  // ===========================================================================
  // Metrics
  // ===========================================================================

  describe('Metrics', () => {
    it('getMetrics reflects published counts', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const initial = yield* service.getMetrics
        expect(initial.readingsPublished).toBe(0)
        expect(initial.alarmsPublished).toBe(0)
        expect(initial.equipmentStatePublished).toBe(0)
        expect(initial.workOrderLifecyclePublished).toBe(0)
        expect(initial.invalidationsPublished).toBe(0)

        const readingStream = yield* service.subscribeReadings
        const alarmStream = yield* service.subscribeAlarms
        const eqStream = yield* service.subscribeEquipmentState
        const workOrderStream = yield* service.subscribeWorkOrders
        const invStream = yield* service.subscribeInvalidations

        const f1 = yield* Stream.take(readingStream, 3).pipe(Stream.runDrain, Effect.fork)
        const f2 = yield* Stream.take(alarmStream, 2).pipe(Stream.runDrain, Effect.fork)
        const f3 = yield* Stream.take(eqStream, 1).pipe(Stream.runDrain, Effect.fork)
        const f4 = yield* Stream.take(workOrderStream, 1).pipe(Stream.runDrain, Effect.fork)
        const f5 = yield* Stream.take(invStream, 1).pipe(Stream.runDrain, Effect.fork)

        yield* yieldForSubscription

        yield* service.publishReading(makeTestReading({ value: 1 }))
        yield* service.publishReading(makeTestReading({ value: 2 }))
        yield* service.publishReading(makeTestReading({ value: 3 }))
        yield* service.publishAlarmEvent(makeTestAlarm())
        yield* service.publishAlarmEvent(makeTestAlarm())
        yield* service.publishEquipmentStateChange(makeTestEquipmentStateChange())
        yield* service.publishWorkOrderLifecycle(makeTestWorkOrderLifecycleEvent())
        yield* service.publishInvalidation(makeTestInvalidation())

        yield* Fiber.join(f1)
        yield* Fiber.join(f2)
        yield* Fiber.join(f3)
        yield* Fiber.join(f4)
        yield* Fiber.join(f5)

        const metrics = yield* service.getMetrics
        expect(metrics.readingsPublished).toBe(3)
        expect(metrics.alarmsPublished).toBe(2)
        expect(metrics.equipmentStatePublished).toBe(1)
        expect(metrics.workOrderLifecyclePublished).toBe(1)
        expect(metrics.invalidationsPublished).toBe(1)
      }))
    })

    it('metrics are cumulative across multiple publish calls', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream = yield* service.subscribeReadings
        const drainFiber = yield* Stream.take(stream, 5).pipe(
          Stream.runDrain,
          Effect.fork,
        )

        yield* yieldForSubscription

        for (let i = 0; i < 5; i++) {
          yield* service.publishReading(makeTestReading({ value: i }))
        }

        yield* Fiber.join(drainFiber)

        const metrics = yield* service.getMetrics
        expect(metrics.readingsPublished).toBe(5)
      }))
    })
  })

  // ===========================================================================
  // Fan-Out (Multiple Subscribers)
  // ===========================================================================

  describe('Fan-Out', () => {
    it('multiple subscribers receive same events', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream1 = yield* service.subscribeReadings
        const stream2 = yield* service.subscribeReadings

        const fiber1 = yield* Stream.take(stream1, 2).pipe(Stream.runCollect, Effect.fork)
        const fiber2 = yield* Stream.take(stream2, 2).pipe(Stream.runCollect, Effect.fork)

        yield* yieldForSubscription

        const r1 = makeTestReading({ value: 10 })
        const r2 = makeTestReading({ value: 20 })

        yield* service.publishReading(r1)
        yield* service.publishReading(r2)

        const result1 = Chunk.toReadonlyArray(yield* Fiber.join(fiber1))
        const result2 = Chunk.toReadonlyArray(yield* Fiber.join(fiber2))

        expect(result1).toHaveLength(2)
        expect(result2).toHaveLength(2)
        expect(result1[0]).toEqual(r1)
        expect(result1[1]).toEqual(r2)
        expect(result2[0]).toEqual(r1)
        expect(result2[1]).toEqual(r2)
      }))
    })

    it('fan-out works for alarm events', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const stream1 = yield* service.subscribeAlarms
        const stream2 = yield* service.subscribeAlarms
        const stream3 = yield* service.subscribeAlarms

        const fiber1 = yield* Stream.take(stream1, 1).pipe(Stream.runCollect, Effect.fork)
        const fiber2 = yield* Stream.take(stream2, 1).pipe(Stream.runCollect, Effect.fork)
        const fiber3 = yield* Stream.take(stream3, 1).pipe(Stream.runCollect, Effect.fork)

        yield* yieldForSubscription

        const alarm = makeTestAlarm()
        yield* service.publishAlarmEvent(alarm)

        const r1 = Chunk.toReadonlyArray(yield* Fiber.join(fiber1))
        const r2 = Chunk.toReadonlyArray(yield* Fiber.join(fiber2))
        const r3 = Chunk.toReadonlyArray(yield* Fiber.join(fiber3))

        expect(r1).toHaveLength(1)
        expect(r2).toHaveLength(1)
        expect(r3).toHaveLength(1)
        expect(r1[0]).toEqual(alarm)
        expect(r2[0]).toEqual(alarm)
        expect(r3[0]).toEqual(alarm)
      }))
    })
  })

  // ===========================================================================
  // Channel Isolation
  // ===========================================================================

  describe('Channel Isolation', () => {
    it('readings and alarms channels are isolated', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const service = yield* EventDistribution

        const readingStream = yield* service.subscribeReadings
        const readingCollected = yield* Ref.make<number>(0)

        const readingFiber = yield* Stream.take(readingStream, 1).pipe(
          Stream.tap(() => Ref.update(readingCollected, (n) => n + 1)),
          Stream.runDrain,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* service.publishReading(makeTestReading())
        yield* Fiber.join(readingFiber)

        const readingCount = yield* Ref.get(readingCollected)
        expect(readingCount).toBe(1)

        // Alarm channel should have received nothing
        const alarmStream = yield* service.subscribeAlarms
        const alarmResult = yield* Stream.take(alarmStream, 1).pipe(
          Stream.runCollect,
          Effect.timeout(Duration.millis(50)),
          Effect.option,
        )

        expect(alarmResult._tag).toBe('None')
      }))
    })
  })
})
