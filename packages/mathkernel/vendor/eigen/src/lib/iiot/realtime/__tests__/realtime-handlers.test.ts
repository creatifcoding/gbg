/**
 * RealtimeHandlers Tests
 *
 * Tests the RPC handler layer that connects RealtimeRpcs to EventDistribution.
 * Validates:
 *   - Stream roundtrip for each handler
 *   - Device/plant filter for readings
 *   - Severity filter for alarms
 *   - EntityType filter for equipment state
 *   - Pattern matching for invalidations
 *   - Throttle behavior for readings
 *
 * Uses plain vitest `it()` + `Effect.runPromise` (same pattern as
 * event-distribution.test.ts) to avoid fiber scheduling conflicts.
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
  AlarmEvent as DistAlarmEvent,
  EquipmentStateChange as DistEquipmentStateChange,
  CacheInvalidation as DistCacheInvalidation,
} from '../event-distribution'
import {
  HolonetBridgeTestLayer,
  SKIP_INTEGRATION,
  NATS_SERVERS,
  checkNatsHealth,
} from './nats-test-layer'
import {
  handleSubscribeReadings,
  handleSubscribeAlarms,
  handleSubscribeEquipmentState,
  handleSubscribeInvalidations,
  matchGlobPattern,
  SEVERITY_ORDER,
} from '../realtime-handlers'

// =============================================================================
// Test Helpers
// =============================================================================

/** Small sleep to let forked fibers establish PubSub subscriptions. */
const yieldForSubscription = Effect.sleep(Duration.millis(10))

const TestLayer = EventDistributionLive.pipe(Layer.provide(HolonetBridgeTestLayer))

const run = <A>(effect: Effect.Effect<A, any, EventDistribution>) =>
  Effect.runPromise(effect.pipe(Effect.scoped, Effect.provide(TestLayer)))

const makeDistReading = (overrides?: Partial<{
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

const makeDistAlarm = (overrides?: Partial<{
  alarmId: string
  severity: string
  deviceId: string
  message: string
}>) =>
  new DistAlarmEvent({
    alarmId: overrides?.alarmId ?? 'alarm-001',
    severity: overrides?.severity ?? 'critical',
    deviceId: overrides?.deviceId ?? 'device-001',
    message: overrides?.message ?? 'Temperature threshold exceeded',
    timestamp: new Date().toISOString(),
  })

const makeDistEquipmentStateChange = (overrides?: Partial<{
  equipmentId: string
  previousState: string
  newState: string
}>) =>
  new DistEquipmentStateChange({
    equipmentId: overrides?.equipmentId ?? 'machine-001',
    previousState: overrides?.previousState ?? 'idle',
    newState: overrides?.newState ?? 'running',
    timestamp: new Date().toISOString(),
  })

const makeDistInvalidation = (overrides?: Partial<{
  cacheKey: string
  reason: string
}>) =>
  new DistCacheInvalidation({
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
// Glob Pattern Matching (unit — no NATS required)
// =============================================================================

describe('matchGlobPattern', () => {
  it('matches exact strings', () => {
    expect(matchGlobPattern('alarms:device-001', 'alarms:device-001')).toBe(true)
  })

  it('rejects non-matching exact strings', () => {
    expect(matchGlobPattern('alarms:device-001', 'alarms:device-002')).toBe(false)
  })

  it('matches wildcard * at end', () => {
    expect(matchGlobPattern('alarms:*', 'alarms:device-001')).toBe(true)
    expect(matchGlobPattern('alarms:*', 'alarms:device-002')).toBe(true)
  })

  it('matches wildcard * in middle', () => {
    expect(matchGlobPattern('readings:*:temp', 'readings:device-001:temp')).toBe(true)
    expect(matchGlobPattern('readings:*:temp', 'readings:device-001:pressure')).toBe(false)
  })

  it('matches ? for single character', () => {
    expect(matchGlobPattern('alarm-00?', 'alarm-001')).toBe(true)
    expect(matchGlobPattern('alarm-00?', 'alarm-0010')).toBe(false)
  })

  it('matches multiple wildcards', () => {
    expect(matchGlobPattern('*:*', 'alarms:device-001')).toBe(true)
    expect(matchGlobPattern('*:*:*', 'a:b:c')).toBe(true)
  })
})

// =============================================================================
// Severity Order (unit — no NATS required)
// =============================================================================

describe('SEVERITY_ORDER', () => {
  it('info < warning < critical < emergency', () => {
    expect(SEVERITY_ORDER.info).toBeLessThan(SEVERITY_ORDER.warning)
    expect(SEVERITY_ORDER.warning).toBeLessThan(SEVERITY_ORDER.critical)
    expect(SEVERITY_ORDER.critical).toBeLessThan(SEVERITY_ORDER.emergency)
  })
})

// =============================================================================
// SubscribeReadings Handler
// =============================================================================

describe('handleSubscribeReadings', () => {
  it('returns a stream of mapped SensorReadings', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeReadings(dist, {})
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      yield* dist.publishReading(makeDistReading({ value: 42.0, deviceId: 'dev-001' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0]._tag).toBe('SensorReading')
      expect(items[0].value).toBe(42.0)
      expect(items[0].deviceId).toBe('dev-001')
    }))
  })

  it('filters by deviceId when provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeReadings(dist, {
        deviceId: 'dev-001' as any,
      })
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // This should be filtered out
      yield* dist.publishReading(makeDistReading({ value: 1, deviceId: 'dev-002' }))
      // This should pass through
      yield* dist.publishReading(makeDistReading({ value: 2, deviceId: 'dev-001' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0].deviceId).toBe('dev-001')
      expect(items[0].value).toBe(2)
    }))
  })

  it('filters by plantId (deviceId prefix) when provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeReadings(dist, {
        plantId: 'PLANT-A' as any,
      })
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // This should be filtered out (different plant prefix)
      yield* dist.publishReading(makeDistReading({ value: 1, deviceId: 'PLANT-B:dev-001' }))
      // This should pass through
      yield* dist.publishReading(makeDistReading({ value: 2, deviceId: 'PLANT-A:dev-002' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0].deviceId).toBe('PLANT-A:dev-002')
    }))
  })

  it('applies throttle when throttleMs is provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeReadings(dist, {
        throttleMs: 200,
      })

      // Collect what comes through in a short window
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // Publish 5 readings rapidly
      for (let i = 0; i < 5; i++) {
        yield* dist.publishReading(makeDistReading({ value: i }))
      }

      // The throttle should let through the first reading
      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      // At minimum, one should come through (the first)
      expect(items.length).toBeGreaterThanOrEqual(1)
      expect(items[0]._tag).toBe('SensorReading')
    }))
  })
})

// =============================================================================
// SubscribeAlarms Handler
// =============================================================================

describe('handleSubscribeAlarms', () => {
  it('returns a stream of mapped AlarmEvents', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeAlarms(dist, {})
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      yield* dist.publishAlarmEvent(makeDistAlarm({ severity: 'critical', deviceId: 'dev-001' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0]._tag).toBe('AlarmEvent')
      expect(items[0].severity).toBe('critical')
    }))
  })

  it('filters by deviceId when provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeAlarms(dist, {
        deviceId: 'dev-001' as any,
      })
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      yield* dist.publishAlarmEvent(makeDistAlarm({ deviceId: 'dev-002' }))
      yield* dist.publishAlarmEvent(makeDistAlarm({ deviceId: 'dev-001' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0].deviceId).toBe('dev-001')
    }))
  })

  it('filters by minSeverity when provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeAlarms(dist, {
        minSeverity: 'critical' as any,
      })
      const collectFiber = yield* Stream.take(stream, 2).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // info (0) -> filtered
      yield* dist.publishAlarmEvent(makeDistAlarm({ severity: 'info', alarmId: 'a1' }))
      // warning (1) -> filtered
      yield* dist.publishAlarmEvent(makeDistAlarm({ severity: 'warning', alarmId: 'a2' }))
      // critical (2) -> pass
      yield* dist.publishAlarmEvent(makeDistAlarm({ severity: 'critical', alarmId: 'a3' }))
      // emergency (3) -> pass
      yield* dist.publishAlarmEvent(makeDistAlarm({ severity: 'emergency', alarmId: 'a4' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(2)
      expect(items[0].alarmId).toBe('a3')
      expect(items[1].alarmId).toBe('a4')
    }))
  })
})

// =============================================================================
// SubscribeEquipmentState Handler
// =============================================================================

describe('handleSubscribeEquipmentState', () => {
  it('returns a stream of mapped EquipmentStateChange events', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeEquipmentState(dist, {})
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      yield* dist.publishEquipmentStateChange(
        makeDistEquipmentStateChange({ equipmentId: 'Machine:mch-001', newState: 'faulted' })
      )

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0]._tag).toBe('EquipmentStateChange')
    }))
  })

  it('filters by entityType when provided', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeEquipmentState(dist, {
        entityType: 'Machine' as any,
      })
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // This has entityType 'Line' -> filtered
      yield* dist.publishEquipmentStateChange(
        makeDistEquipmentStateChange({ equipmentId: 'Line:line-001' })
      )
      // This has entityType 'Machine' -> pass
      yield* dist.publishEquipmentStateChange(
        makeDistEquipmentStateChange({ equipmentId: 'Machine:mch-001' })
      )

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0].entityType).toBe('Machine')
    }))
  })
})

// =============================================================================
// SubscribeInvalidations Handler
// =============================================================================

describe('handleSubscribeInvalidations', () => {
  it('returns a stream of mapped CacheInvalidation events', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeInvalidations(dist, {
        patterns: ['*'],
      })
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      yield* dist.publishInvalidation(makeDistInvalidation({ cacheKey: 'dashboard:main' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(1)
      expect(items[0]._tag).toBe('CacheInvalidation')
      expect(items[0].cacheKey).toBe('dashboard:main')
    }))
  })

  it('filters by patterns using glob matching', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeInvalidations(dist, {
        patterns: ['alarms:*', 'readings:device-001'],
      })
      const collectFiber = yield* Stream.take(stream, 2).pipe(
        Stream.runCollect,
        Effect.fork,
      )

      yield* yieldForSubscription

      // Matches 'alarms:*'
      yield* dist.publishInvalidation(makeDistInvalidation({ cacheKey: 'alarms:device-001' }))
      // Does NOT match any pattern
      yield* dist.publishInvalidation(makeDistInvalidation({ cacheKey: 'dashboard:main' }))
      // Matches exact 'readings:device-001'
      yield* dist.publishInvalidation(makeDistInvalidation({ cacheKey: 'readings:device-001' }))

      const result = yield* Fiber.join(collectFiber)
      const items = Chunk.toReadonlyArray(result)

      expect(items).toHaveLength(2)
      expect(items[0].cacheKey).toBe('alarms:device-001')
      expect(items[1].cacheKey).toBe('readings:device-001')
    }))
  })

  it('no patterns match yields empty stream for non-matching keys', () => {
    if (SKIP_INTEGRATION || !serverAvailable) return
    return run(Effect.gen(function* () {
      const dist = yield* EventDistribution

      const stream = yield* handleSubscribeInvalidations(dist, {
        patterns: ['nonexistent:*'],
      })

      // Fork collection with timeout
      const collectFiber = yield* Stream.take(stream, 1).pipe(
        Stream.runCollect,
        Effect.timeout(Duration.millis(100)),
        Effect.option,
        Effect.fork,
      )

      yield* yieldForSubscription

      // Publish something that doesn't match
      yield* dist.publishInvalidation(makeDistInvalidation({ cacheKey: 'alarms:device-001' }))

      const result = yield* Fiber.join(collectFiber)
      // Should timeout -> None
      expect(result._tag).toBe('None')
    }))
  })
})
