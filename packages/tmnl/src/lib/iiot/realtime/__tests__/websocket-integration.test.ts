/**
 * WebSocket Integration Tests — RPC Client/Server Roundtrip
 *
 * Tests the full RPC pipeline using RpcTest.makeClient for in-memory testing:
 *   Client -> RpcTest -> RealtimeRpcGroupHandlersLayer -> RealtimeRpcHandlers -> EventDistribution
 *
 * This exercises the same code path as a real WebSocket connection but
 * without requiring an HTTP server or actual WebSocket upgrade.
 *
 * Test scenarios:
 *   1. Client subscribes to readings, receives streamed events
 *   2. Client subscribes to alarms with filter, only matching events received
 *   3. Multiple concurrent subscriptions on different channels
 *   4. Glob pattern filtering on invalidation subscription
 *   5. Equipment state type filtering
 *
 * Uses plain vitest `it()` + `Effect.runPromise` to avoid fiber scheduling
 * conflicts with PubSub-backed EventDistribution.
 *
 * Requires a running NATS server (HolonetBridge backed by real NATS).
 * Set NATS_SKIP_INTEGRATION=1 to skip when NATS is unavailable.
 *
 * @module
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Chunk, Duration, Fiber, pipe } from 'effect'
import * as RpcTest from '@effect/rpc/RpcTest'
import { RpcSerialization } from '@effect/rpc'
import {
  RealtimeRpcs,
  SubscribeReadings,
  SubscribeAlarms,
  SubscribeEquipmentState,
  SubscribeInvalidations,
} from '../../rpc/RealtimeRpcs'
import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent as DistAlarmEvent,
  EquipmentStateChange as DistEquipmentStateChange,
  CacheInvalidation as DistCacheInvalidation,
} from '../event-distribution'
import { RealtimeRpcHandlersLayer } from '../realtime-handlers'
import { RealtimeRpcGroupHandlersLayer } from '../websocket-server'
import {
  HolonetBridgeTestLayer,
  SKIP_INTEGRATION,
  NATS_SERVERS,
  checkNatsHealth,
} from './nats-test-layer'

// =============================================================================
// Test Layer
// =============================================================================

/**
 * Integration test layer.
 *
 * Provides:
 * - EventDistribution (shared PubSub hub for both publishing and subscribing)
 * - RealtimeRpcHandlers (handler service)
 * - RealtimeRpcGroupHandlersLayer (RpcGroup.toLayer bridge for RpcTest.makeClient)
 * - RpcSerialization.layerJson (required by RpcTest for encode/decode)
 */
const TestLayer = pipe(
  RealtimeRpcGroupHandlersLayer,
  Layer.provide(RealtimeRpcHandlersLayer),
  Layer.provide(EventDistributionLive),
  Layer.provide(HolonetBridgeTestLayer),
  Layer.provideMerge(EventDistributionLive.pipe(Layer.provide(HolonetBridgeTestLayer))),
  Layer.provideMerge(RpcSerialization.layerJson),
)

const yieldForSubscription = Effect.sleep(Duration.millis(10))

// =============================================================================
// Test Data Factories
// =============================================================================

const makeReading = (overrides?: Partial<{
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

const makeAlarm = (overrides?: Partial<{
  alarmId: string
  severity: string
  deviceId: string
}>) =>
  new DistAlarmEvent({
    alarmId: overrides?.alarmId ?? 'alarm-001',
    severity: overrides?.severity ?? 'critical',
    deviceId: overrides?.deviceId ?? 'device-001',
    message: 'Test alarm',
    timestamp: new Date().toISOString(),
  })

const makeEquipmentStateChange = (overrides?: Partial<{
  equipmentId: string
  previousState: string
  newState: string
}>) =>
  new DistEquipmentStateChange({
    equipmentId: overrides?.equipmentId ?? 'Machine:mch-001',
    previousState: overrides?.previousState ?? 'idle',
    newState: overrides?.newState ?? 'running',
    timestamp: new Date().toISOString(),
  })

const makeInvalidation = (overrides?: Partial<{
  cacheKey: string
  reason: string
}>) =>
  new DistCacheInvalidation({
    cacheKey: overrides?.cacheKey ?? 'alarms:active',
    reason: overrides?.reason ?? 'alarm triggered',
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
// Tests
// =============================================================================

describe('WebSocket Integration Tests (RpcTest.makeClient)', () => {
  // ---------------------------------------------------------------------------
  // 1. Readings Subscription
  // ---------------------------------------------------------------------------

  describe('SubscribeReadings', () => {
    it('client subscribes and receives streamed readings', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        // Subscribe via RPC client (no filter)
        const stream = client.Realtime.SubscribeReadings({})

        // Fork consumer to collect 2 events
        const fiber = yield* stream.pipe(
          Stream.take(2),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish readings to EventDistribution
        yield* dist.publishReading(makeReading({ value: 10.0, deviceId: 'dev-001' }))
        yield* dist.publishReading(makeReading({ value: 20.0, deviceId: 'dev-002' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(2)
        expect(arr[0].value).toBe(10.0)
        expect(arr[1].value).toBe(20.0)
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })

    it('client subscribes with deviceId filter', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeReadings({
          deviceId: 'dev-002' as any,
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // dev-001 should be filtered out
        yield* dist.publishReading(makeReading({ value: 1.0, deviceId: 'dev-001' }))
        // dev-002 should pass through
        yield* dist.publishReading(makeReading({ value: 2.0, deviceId: 'dev-002' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
        expect(arr[0].value).toBe(2.0)
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Alarms Subscription
  // ---------------------------------------------------------------------------

  describe('SubscribeAlarms', () => {
    it('client subscribes and receives alarm events', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeAlarms({})

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'critical' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
        expect(arr[0].eventType).toBe('triggered')
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })

    it('client subscribes with minSeverity filter', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeAlarms({
          minSeverity: 'warning' as any,
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // info severity (below warning) should be filtered
        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'info', alarmId: 'alarm-info' }))
        // critical (above warning) should pass
        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'critical', alarmId: 'alarm-crit' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Equipment State Subscription
  // ---------------------------------------------------------------------------

  describe('SubscribeEquipmentState', () => {
    it('client subscribes and receives equipment state changes', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeEquipmentState({})

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishEquipmentStateChange(
          makeEquipmentStateChange({ equipmentId: 'Machine:mch-001' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
        expect(arr[0].entityType).toBe('Machine')
        expect(arr[0].entityId).toBe('mch-001')
        expect(arr[0].previousState).toBe('idle')
        expect(arr[0].currentState).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })

    it('client subscribes with entityType filter', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeEquipmentState({
          entityType: 'Sensor' as any,
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Machine (wrong type) should be filtered
        yield* dist.publishEquipmentStateChange(
          makeEquipmentStateChange({ equipmentId: 'Machine:mch-001' })
        )
        // Sensor should pass
        yield* dist.publishEquipmentStateChange(
          makeEquipmentStateChange({ equipmentId: 'Sensor:sns-001' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
        expect(arr[0].entityType).toBe('Sensor')
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Invalidations Subscription
  // ---------------------------------------------------------------------------

  describe('SubscribeInvalidations', () => {
    it('client subscribes with glob pattern', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        const stream = client.Realtime.SubscribeInvalidations({
          patterns: ['alarms:*'],
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // readings:* should be filtered out
        yield* dist.publishInvalidation(
          makeInvalidation({ cacheKey: 'readings:device-001' })
        )
        // alarms:* should match
        yield* dist.publishInvalidation(
          makeInvalidation({ cacheKey: 'alarms:active' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)

        expect(arr).toHaveLength(1)
        expect(arr[0].cacheKey).toBe('alarms:active')
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Multiple Concurrent Subscriptions
  // ---------------------------------------------------------------------------

  describe('concurrent subscriptions', () => {
    it('client subscribes to readings and alarms simultaneously', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const client = yield* RpcTest.makeClient(RealtimeRpcs)

        // Subscribe to both channels
        const readingsStream = client.Realtime.SubscribeReadings({})
        const alarmsStream = client.Realtime.SubscribeAlarms({})

        // Fork both consumers
        const readingsFiber = yield* readingsStream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        const alarmsFiber = yield* alarmsStream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish to both channels
        yield* dist.publishReading(makeReading({ value: 99.0 }))
        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'emergency' }))

        // Both should receive independently
        const readings = Chunk.toArray(yield* Fiber.join(readingsFiber))
        const alarms = Chunk.toArray(yield* Fiber.join(alarmsFiber))

        expect(readings).toHaveLength(1)
        expect(readings[0].value).toBe(99.0)

        expect(alarms).toHaveLength(1)
        expect(alarms[0].eventType).toBe('triggered')
      }).pipe(
        Effect.scoped,
        Effect.provide(TestLayer),
      )

      await Effect.runPromise(program)
    })
  })
})
