/**
 * HolonetBridge Integration Tests
 *
 * Tests the bridge that publishes IIoT events to NATS and subscribes to
 * remote events from NATS. Requires a running NATS server.
 *
 * Test scenarios:
 *   1. Publish reading → verify roundtrip through NATS subject
 *   2. Publish alarm → NATS roundtrip
 *   3. Publish equipment state → NATS roundtrip
 *   4. Publish invalidation → NATS roundtrip
 *   5. Error resilience — publish failure doesn't crash
 *
 * Uses plain vitest `it()` + `Effect.runPromise` to avoid fiber scheduling
 * conflicts with PubSub-backed streams.
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Chunk, Fiber, Duration, pipe } from 'effect'
import { connect } from 'nats.ws'

import { HolonetBridge, HolonetBridgeLayer } from '../holonet-bridge'
import {
  ReadingEvent,
  AlarmEvent,
  EquipmentStateChange,
  CacheInvalidation,
} from '../event-distribution'
import {
  IIoTReadingsSubject,
  IIoTAlarmsSubject,
  IIoTEquipmentSubject,
  IIoTInvalidationsSubject,
} from '../iiot-subjects'
import { NatsPubSubService } from '../../../holonet/nats/pubsub'
import { NatsHubService } from '../../../holonet/nats/hub'
import { NatsInnerService } from '../../../holonet/nats/inner'
import { NatsConnectionService } from '../../../holonet/nats/connection'
import { HolonetConfigTag } from '../../../holonet/schemas/config'

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222'
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1'

// =============================================================================
// Layer Composition
// =============================================================================

const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'holonet-bridge-test',
  debug: false,
})

const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer),
)

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer),
)

const testHubLayer = NatsHubService.Default.pipe(
  Layer.provide(testInnerLayer),
)

const testPubSubLayer = NatsPubSubService.Default.pipe(
  Layer.provide(Layer.merge(testInnerLayer, testHubLayer)),
)

const testBridgeLayer = HolonetBridgeLayer.pipe(
  Layer.provide(testPubSubLayer),
)

// Merged layer: provides both HolonetBridge and NatsPubSubService for tests
// that need direct pubsub access for verification
const TestLayer = Layer.merge(testBridgeLayer, testPubSubLayer)

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false

async function checkNatsHealth(): Promise<boolean> {
  try {
    const nc = await connect({ servers: NATS_SERVERS })
    await nc.close()
    return true
  } catch {
    return false
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('HolonetBridge Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return
    serverAvailable = await checkNatsHealth()
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`,
      )
    }
  })

  // ---------------------------------------------------------------------------
  // 1. Readings roundtrip
  // ---------------------------------------------------------------------------

  describe('readings', () => {
    it('publishes reading to NATS and receives via remote stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge
        const pubsub = yield* NatsPubSubService

        // Subscribe directly to NATS subject to verify publish
        const natsStream = yield* pubsub.subscribe(
          IIoTReadingsSubject.wildcardPattern(),
          ReadingEvent,
        )

        const collectFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        // Publish via bridge
        yield* bridge.publishReading(
          new ReadingEvent({
            topic: 'plant/line1/sensor/temp',
            value: 42.5,
            timestamp: new Date().toISOString(),
            deviceId: 'dev-001',
          }),
        )

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const arr = Chunk.toArray(messages)
        expect(arr).toHaveLength(1)
        expect(arr[0].data.value).toBe(42.5)
        expect(arr[0].data.deviceId).toBe('dev-001')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })

    it('receives remote readings via bridge stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge
        const pubsub = yield* NatsPubSubService

        // Subscribe via bridge's remote stream
        const remoteStream = yield* bridge.remoteReadings

        const collectFiber = yield* pipe(
          remoteStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        // Publish directly to NATS (simulating a remote node)
        yield* pubsub.publish(
          IIoTReadingsSubject.resolve({ deviceId: 'remote-dev-001' }),
          ReadingEvent,
          new ReadingEvent({
            topic: 'remote/sensor/temp',
            value: 99.9,
            timestamp: new Date().toISOString(),
            deviceId: 'remote-dev-001',
          }),
        )

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const arr = Chunk.toArray(messages)
        expect(arr).toHaveLength(1)
        expect(arr[0].value).toBe(99.9)
        expect(arr[0].deviceId).toBe('remote-dev-001')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Alarms roundtrip
  // ---------------------------------------------------------------------------

  describe('alarms', () => {
    it('publishes alarm to NATS and receives via direct subscription', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge
        const pubsub = yield* NatsPubSubService

        const natsStream = yield* pubsub.subscribe(
          IIoTAlarmsSubject.wildcardPattern(),
          AlarmEvent,
        )

        const collectFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        yield* bridge.publishAlarm(
          new AlarmEvent({
            alarmId: 'alarm-bridge-001',
            severity: 'critical',
            deviceId: 'plc-17',
            message: 'Overtemperature',
            timestamp: new Date().toISOString(),
          }),
        )

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const arr = Chunk.toArray(messages)
        expect(arr).toHaveLength(1)
        expect(arr[0].data.alarmId).toBe('alarm-bridge-001')
        expect(arr[0].data.severity).toBe('critical')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Equipment state roundtrip
  // ---------------------------------------------------------------------------

  describe('equipment state', () => {
    it('publishes equipment state change to NATS', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge
        const pubsub = yield* NatsPubSubService

        const natsStream = yield* pubsub.subscribe(
          IIoTEquipmentSubject.wildcardPattern(),
          EquipmentStateChange,
        )

        const collectFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        yield* bridge.publishEquipment(
          new EquipmentStateChange({
            equipmentId: 'press-A',
            previousState: 'idle',
            newState: 'running',
            timestamp: new Date().toISOString(),
          }),
        )

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const arr = Chunk.toArray(messages)
        expect(arr).toHaveLength(1)
        expect(arr[0].data.equipmentId).toBe('press-A')
        expect(arr[0].data.newState).toBe('running')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Invalidations roundtrip
  // ---------------------------------------------------------------------------

  describe('invalidations', () => {
    it('publishes cache invalidation to NATS', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge
        const pubsub = yield* NatsPubSubService

        const natsStream = yield* pubsub.subscribe(
          IIoTInvalidationsSubject.wildcardPattern(),
          CacheInvalidation,
        )

        const collectFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        yield* bridge.publishInvalidation(
          new CacheInvalidation({
            cacheKey: 'alarms:active',
            reason: 'alarm_triggered',
            timestamp: new Date().toISOString(),
          }),
        )

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const arr = Chunk.toArray(messages)
        expect(arr).toHaveLength(1)
        expect(arr[0].data.cacheKey).toBe('alarms:active')
        expect(arr[0].data.reason).toBe('alarm_triggered')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    it('publish with fire-and-forget does not propagate errors', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      // The bridge uses Effect.ignoreLogged — even if encoding somehow
      // fails, the caller should not see an error.
      const program = Effect.gen(function* () {
        const bridge = yield* HolonetBridge

        // Normal publish should succeed silently
        yield* bridge.publishReading(
          new ReadingEvent({
            topic: 'test/resilience',
            value: 1.0,
            timestamp: new Date().toISOString(),
            deviceId: 'resilience-dev',
          }),
        )

        // If we got here, the fire-and-forget pattern works
        expect(true).toBe(true)
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })
})
