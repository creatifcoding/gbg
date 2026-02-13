/**
 * ReactivityBridge Service Tests
 *
 * Tests the thin adapter layer that entity handlers call to publish
 * domain events into the EventDistribution PubSub hub.
 *
 * Each bridge method accepts a domain-shaped input (handler-friendly)
 * and produces the corresponding EventDistribution event type,
 * publishing it to the appropriate channel.
 *
 * NOTE: Uses plain vitest `it()` with `Effect.runPromise` instead of
 * `@effect/vitest` `it.effect()` because the latter's fiber scheduling
 * conflicts with PubSub + Stream.fromPubSub + Effect.fork patterns.
 *
 * Requires a running NATS server (HolonetBridge backed by real NATS).
 * Set NATS_SKIP_INTEGRATION=1 to skip when NATS is unavailable.
 *
 * @module
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Chunk, Fiber, Duration } from 'effect'
import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent,
  EquipmentStateChange,
  CacheInvalidation,
} from '../event-distribution'
import {
  ReactivityBridge,
  ReactivityBridgeLive,
} from '../reactivity-bridge'
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

const EventDistributionTestLayer = EventDistributionLive.pipe(Layer.provide(HolonetBridgeTestLayer))

const run = <A>(effect: Effect.Effect<A, any, ReactivityBridge | EventDistribution>) =>
  Effect.runPromise(effect.pipe(
    Effect.scoped,
    Effect.provide(ReactivityBridgeLive),
    Effect.provide(EventDistributionTestLayer),
  ))

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
// Tests
// =============================================================================

describe('ReactivityBridge', () => {
  // ===========================================================================
  // Alarm Events
  // ===========================================================================

  describe('onAlarmEvent', () => {
    it('publishes to alarm channel via EventDistribution', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const bridge = yield* ReactivityBridge
        const eventDist = yield* EventDistribution

        // Subscribe to alarms
        const stream = yield* eventDist.subscribeAlarms
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Trigger alarm via bridge
        yield* bridge.onAlarmEvent({
          eventType: 'triggered',
          alarmId: 'alarm-001',
          deviceId: 'device-001',
          severity: 'critical',
          message: 'Temperature exceeded threshold',
        })

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        const event = items[0] as AlarmEvent
        expect(event._tag).toBe('AlarmEvent')
        expect(event.alarmId).toBe('alarm-001')
        expect(event.deviceId).toBe('device-001')
        expect(event.severity).toBe('critical')
        expect(event.message).toBe('Temperature exceeded threshold')
        expect(typeof event.timestamp).toBe('string')
        expect(event.timestamp.length).toBeGreaterThan(0)
      }))
    })
  })

  // ===========================================================================
  // Equipment State Changes
  // ===========================================================================

  describe('onEquipmentStateChange', () => {
    it('publishes to equipment channel via EventDistribution', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const bridge = yield* ReactivityBridge
        const eventDist = yield* EventDistribution

        // Subscribe to equipment state
        const stream = yield* eventDist.subscribeEquipmentState
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Trigger equipment state change via bridge
        yield* bridge.onEquipmentStateChange({
          equipmentId: 'machine-001',
          previousState: 'running',
          newState: 'faulted',
        })

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        const change = items[0] as EquipmentStateChange
        expect(change._tag).toBe('EquipmentStateChange')
        expect(change.equipmentId).toBe('machine-001')
        expect(change.previousState).toBe('running')
        expect(change.newState).toBe('faulted')
        expect(typeof change.timestamp).toBe('string')
        expect(change.timestamp.length).toBeGreaterThan(0)
      }))
    })
  })

  // ===========================================================================
  // Sensor Readings
  // ===========================================================================

  describe('onReading', () => {
    it('publishes to readings channel via EventDistribution', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const bridge = yield* ReactivityBridge
        const eventDist = yield* EventDistribution

        // Subscribe to readings
        const stream = yield* eventDist.subscribeReadings
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Trigger reading via bridge
        yield* bridge.onReading({
          topic: 'plant/line1/sensor/temp',
          value: 42.5,
          deviceId: 'device-002',
        })

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        const reading = items[0] as ReadingEvent
        expect(reading._tag).toBe('ReadingEvent')
        expect(reading.topic).toBe('plant/line1/sensor/temp')
        expect(reading.value).toBe(42.5)
        expect(reading.deviceId).toBe('device-002')
        expect(typeof reading.timestamp).toBe('string')
        expect(reading.timestamp.length).toBeGreaterThan(0)
      }))
    })
  })

  // ===========================================================================
  // Cache Invalidation
  // ===========================================================================

  describe('onCacheInvalidation', () => {
    it('publishes to invalidation channel via EventDistribution', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const bridge = yield* ReactivityBridge
        const eventDist = yield* EventDistribution

        // Subscribe to invalidations
        const stream = yield* eventDist.subscribeInvalidations
        const collectFiber = yield* Stream.take(stream, 1).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Trigger invalidation via bridge
        yield* bridge.onCacheInvalidation({
          cacheKey: 'alarms:active',
          reason: 'alarm_triggered',
        })

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(1)
        const inv = items[0] as CacheInvalidation
        expect(inv._tag).toBe('CacheInvalidation')
        expect(inv.cacheKey).toBe('alarms:active')
        expect(inv.reason).toBe('alarm_triggered')
        expect(typeof inv.timestamp).toBe('string')
        expect(inv.timestamp.length).toBeGreaterThan(0)
      }))
    })
  })

  // ===========================================================================
  // Ordering
  // ===========================================================================

  describe('Event Ordering', () => {
    it('multiple events are delivered in order', () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      return run(Effect.gen(function* () {
        const bridge = yield* ReactivityBridge
        const eventDist = yield* EventDistribution

        // Subscribe to alarms
        const stream = yield* eventDist.subscribeAlarms
        const collectFiber = yield* Stream.take(stream, 3).pipe(
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish 3 alarm events in order
        yield* bridge.onAlarmEvent({
          eventType: 'triggered',
          alarmId: 'alarm-001',
          deviceId: 'device-001',
          severity: 'critical',
          message: 'First alarm',
        })
        yield* bridge.onAlarmEvent({
          eventType: 'acknowledged',
          alarmId: 'alarm-002',
          deviceId: 'device-002',
          severity: 'warning',
          message: 'Second alarm',
        })
        yield* bridge.onAlarmEvent({
          eventType: 'cleared',
          alarmId: 'alarm-003',
          deviceId: 'device-003',
          severity: 'info',
          message: 'Third alarm',
        })

        const result = yield* Fiber.join(collectFiber)
        const items = Chunk.toReadonlyArray(result)

        expect(items).toHaveLength(3)
        expect((items[0] as AlarmEvent).alarmId).toBe('alarm-001')
        expect((items[0] as AlarmEvent).message).toBe('First alarm')
        expect((items[1] as AlarmEvent).alarmId).toBe('alarm-002')
        expect((items[1] as AlarmEvent).message).toBe('Second alarm')
        expect((items[2] as AlarmEvent).alarmId).toBe('alarm-003')
        expect((items[2] as AlarmEvent).message).toBe('Third alarm')
      }))
    })
  })
})
