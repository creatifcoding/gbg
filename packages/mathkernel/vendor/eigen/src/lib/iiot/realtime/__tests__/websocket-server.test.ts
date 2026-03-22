/**
 * WebSocket Server Tests
 *
 * Tests the WebSocket server layer composition and handler wiring.
 *
 * What is tested:
 *   1. Layer composition — RpcServer + handler bridge compose
 *   2. Handler bridge — RealtimeRpcHandlersBridge maps service methods to RpcGroup tags
 *   3. Stream.unwrap — Verifies streaming handlers produce Stream (not Effect<Stream>)
 *   4. All 4 channels — readings, alarms, equipment state, invalidations
 *
 * These are structural/composition tests. End-to-end WebSocket roundtrip
 * tests (client connect, WS upgrade, RPC call) live in ws-integration.test.ts.
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
import { Effect, Layer, Stream, Chunk, Duration, Fiber } from 'effect'
import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent as DistAlarmEvent,
  EquipmentStateChange as DistEquipmentStateChange,
  CacheInvalidation as DistCacheInvalidation,
} from '../event-distribution'
import {
  RealtimeRpcHandlers,
  RealtimeRpcHandlersLayer,
} from '../realtime-handlers'
import {
  RealtimeRpcGroupHandlersLayer,
} from '../websocket-server'
import {
  HolonetBridgeTestLayer,
  SKIP_INTEGRATION,
  NATS_SERVERS,
  checkNatsHealth,
} from './nats-test-layer'

// =============================================================================
// Test Helpers
// =============================================================================

const yieldForSubscription = Effect.sleep(Duration.millis(10))

/**
 * Shared test layer: EventDistribution + RealtimeRpcHandlers.
 *
 * Both the test code (for publishing) and the handlers (for subscribing)
 * share the same EventDistribution instance.
 */
const EventDistributionTestLayer = EventDistributionLive.pipe(Layer.provide(HolonetBridgeTestLayer))

const TestLayer = Layer.mergeAll(
  EventDistributionTestLayer,
  RealtimeRpcHandlersLayer.pipe(Layer.provide(EventDistributionTestLayer)),
)

const run = <A>(effect: Effect.Effect<A, any, EventDistribution | RealtimeRpcHandlers>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestLayer)))

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

describe('WebSocket Server Layer', () => {
  // ---------------------------------------------------------------------------
  // 1. Layer Composition
  // ---------------------------------------------------------------------------

  describe('layer composition', () => {
    it('RealtimeRpcGroupHandlersLayer composes with handler service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        return 'composed'
      }).pipe(
        Effect.provide(RealtimeRpcGroupHandlersLayer),
        Effect.provide(
          RealtimeRpcHandlersLayer.pipe(Layer.provide(EventDistributionTestLayer))
        ),
      )

      const result = await Effect.runPromise(program)
      expect(result).toBe('composed')
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Handler Bridge — Readings
  // ---------------------------------------------------------------------------

  describe('handler bridge: readings', () => {
    it('routes readings through handler service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const readingsStream = yield* handlers.subscribeReadings({})

        const fiber = yield* readingsStream.pipe(
          Stream.take(2),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishReading(makeReading({ value: 10.0 }))
        yield* dist.publishReading(makeReading({ value: 20.0 }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(2)
        expect(arr[0].value).toBe(10.0)
        expect(arr[1].value).toBe(20.0)
      }))
    })

    it('filters readings by deviceId', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeReadings({
          deviceId: 'device-002' as any,
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish readings for different devices
        yield* dist.publishReading(makeReading({ deviceId: 'device-001', value: 1.0 }))
        yield* dist.publishReading(makeReading({ deviceId: 'device-002', value: 2.0 }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
        expect(arr[0].value).toBe(2.0)
      }))
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Handler Bridge — Alarms
  // ---------------------------------------------------------------------------

  describe('handler bridge: alarms', () => {
    it('routes alarm events through handler service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const alarmsStream = yield* handlers.subscribeAlarms({})

        const fiber = yield* alarmsStream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'warning' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
        expect(arr[0].eventType).toBe('triggered')
      }))
    })

    it('filters alarms by minSeverity', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeAlarms({
          minSeverity: 'critical' as any,
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish low severity (should be filtered out)
        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'info' }))
        // Publish critical (should pass)
        yield* dist.publishAlarmEvent(makeAlarm({ severity: 'critical', alarmId: 'alarm-crit' }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
      }))
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Handler Bridge — Equipment State
  // ---------------------------------------------------------------------------

  describe('handler bridge: equipment state', () => {
    it('routes equipment state changes through handler service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeEquipmentState({})

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
      }))
    })

    it('filters equipment state by entityType', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeEquipmentState({
          entityType: 'Device',
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Machine type (should be filtered out)
        yield* dist.publishEquipmentStateChange(
          makeEquipmentStateChange({ equipmentId: 'Machine:mch-001' })
        )
        // Device type (should pass)
        yield* dist.publishEquipmentStateChange(
          makeEquipmentStateChange({ equipmentId: 'Device:dev-001' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
        expect(arr[0].entityType).toBe('Device')
      }))
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Handler Bridge — Invalidations
  // ---------------------------------------------------------------------------

  describe('handler bridge: invalidations', () => {
    it('routes cache invalidations through handler service', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeInvalidations({
          patterns: ['alarms:*'],
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishInvalidation(
          makeInvalidation({ cacheKey: 'alarms:active' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
        expect(arr[0].cacheKey).toBe('alarms:active')
      }))
    })

    it('filters by glob pattern', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        const stream = yield* handlers.subscribeInvalidations({
          patterns: ['readings:*'],
        })

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Should be filtered out (alarms: pattern doesn't match readings:*)
        yield* dist.publishInvalidation(
          makeInvalidation({ cacheKey: 'alarms:active' })
        )
        // Should pass
        yield* dist.publishInvalidation(
          makeInvalidation({ cacheKey: 'readings:device-001' })
        )

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr).toHaveLength(1)
        expect(arr[0].cacheKey).toBe('readings:device-001')
      }))
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Stream.unwrap Bridge
  // ---------------------------------------------------------------------------

  describe('Stream.unwrap bridge', () => {
    it('Stream.unwrap transforms Effect<Stream<A>> to Stream<A>', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return
      await run(Effect.gen(function* () {
        const dist = yield* EventDistribution
        const handlers = yield* RealtimeRpcHandlers

        // The handler returns Effect<Stream<SensorReading>>
        const effectStream = handlers.subscribeReadings({})

        // Stream.unwrap converts it to Stream<SensorReading>
        const stream = Stream.unwrap(effectStream)

        const fiber = yield* stream.pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription
        yield* dist.publishReading(makeReading({ value: 42.0 }))

        const collected = yield* Fiber.join(fiber)
        const arr = Chunk.toArray(collected)
        expect(arr[0].value).toBe(42.0)
      }))
    })
  })
})
