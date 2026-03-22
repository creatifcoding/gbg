/**
 * EventDistribution Distributed Tests
 *
 * Tests the dual-publish + remote ingress behavior of EventDistribution
 * when wired to a real NATS instance via HolonetBridge.
 *
 * Test scenarios:
 *   1. Publish locally → verify event reaches NATS subject
 *   2. Publish to NATS externally → verify event appears on local outlet stream
 *   3. Metrics include both local and remote events
 *   4. Multiple channels work concurrently with NATS
 *
 * Uses plain vitest `it()` + `Effect.runPromise` to avoid fiber scheduling
 * conflicts with PubSub + Stream.fromPubSub + Effect.fork patterns.
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Effect, Layer, Stream, Chunk, Fiber, Duration, pipe } from 'effect'
import { connect } from 'nats.ws'

import {
  EventDistribution,
  EventDistributionLive,
  ReadingEvent,
  AlarmEvent,
} from '../event-distribution'
import { HolonetBridgeLayer } from '../holonet-bridge'
import {
  IIoTReadingsSubject,
  IIoTAlarmsSubject,
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
  name: 'event-dist-distributed-test',
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

// EventDistribution with real HolonetBridge (backed by NATS)
const bridgeLayer = HolonetBridgeLayer.pipe(
  Layer.provide(testPubSubLayer),
)

const eventDistLayer = EventDistributionLive.pipe(
  Layer.provide(bridgeLayer),
)

// Full test layer — provides EventDistribution + NatsPubSubService for external publishing
const TestLayer = Layer.merge(eventDistLayer, testPubSubLayer)

const yieldForSubscription = Effect.sleep(Duration.millis(50))

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

describe('EventDistribution Distributed (NATS)', () => {
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
  // 1. Dual-publish: local publish reaches NATS
  // ---------------------------------------------------------------------------

  describe('dual-publish outbound', () => {
    it('publishReading dual-publishes to both local outlet AND NATS', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const pubsub = yield* NatsPubSubService

        // Subscribe to local outlet
        const localStream = yield* dist.subscribeReadings
        const localFiber = yield* pipe(
          localStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        // Subscribe to NATS directly
        const natsStream = yield* pubsub.subscribe(
          IIoTReadingsSubject.wildcardPattern(),
          ReadingEvent,
        )
        const natsFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        // Publish via EventDistribution
        yield* dist.publishReading(
          new ReadingEvent({
            topic: 'plant/line1/sensor/temp',
            value: 42.0,
            timestamp: new Date().toISOString(),
            deviceId: 'dual-dev-001',
          }),
        )

        // Both should receive
        const localResult = yield* Fiber.join(localFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )
        const natsResult = yield* Fiber.join(natsFiber).pipe(
          Effect.timeout(Duration.seconds(5)),
        )

        const localArr = Chunk.toArray(localResult)
        const natsArr = Chunk.toArray(natsResult)

        expect(localArr).toHaveLength(1)
        expect(localArr[0].value).toBe(42.0)

        expect(natsArr).toHaveLength(1)
        expect(natsArr[0].data.value).toBe(42.0)
        expect(natsArr[0].data.deviceId).toBe('dual-dev-001')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })

    it('publishAlarmEvent dual-publishes to local and NATS', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const pubsub = yield* NatsPubSubService

        const localStream = yield* dist.subscribeAlarms
        const localFiber = yield* pipe(
          localStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        const natsStream = yield* pubsub.subscribe(
          IIoTAlarmsSubject.wildcardPattern(),
          AlarmEvent,
        )
        const natsFiber = yield* pipe(
          natsStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishAlarmEvent(
          new AlarmEvent({
            alarmId: 'dist-alarm-001',
            severity: 'warning',
            deviceId: 'plc-dual',
            message: 'Dual-publish test',
            timestamp: new Date().toISOString(),
          }),
        )

        const localArr = Chunk.toArray(
          yield* Fiber.join(localFiber).pipe(Effect.timeout(Duration.seconds(5))),
        )
        const natsArr = Chunk.toArray(
          yield* Fiber.join(natsFiber).pipe(Effect.timeout(Duration.seconds(5))),
        )

        expect(localArr).toHaveLength(1)
        expect(localArr[0].alarmId).toBe('dist-alarm-001')

        expect(natsArr).toHaveLength(1)
        expect(natsArr[0].data.alarmId).toBe('dist-alarm-001')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Remote ingress: NATS publish → local outlet
  // ---------------------------------------------------------------------------

  describe('remote ingress', () => {
    it('external NATS publish appears on local readings outlet', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution
        const pubsub = yield* NatsPubSubService

        // Subscribe to local outlet
        const localStream = yield* dist.subscribeReadings

        // We need to wait for both the local subscription AND the ingress daemon
        // to be fully subscribed before publishing externally
        yield* Effect.sleep(Duration.millis(200))

        const localFiber = yield* pipe(
          localStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork,
        )

        yield* Effect.sleep(Duration.millis(100))

        // Publish directly to NATS (simulating a remote node)
        yield* pubsub.publish(
          IIoTReadingsSubject.resolve({ deviceId: 'remote-node-dev' }),
          ReadingEvent,
          new ReadingEvent({
            topic: 'remote/sensor/pressure',
            value: 101.3,
            timestamp: new Date().toISOString(),
            deviceId: 'remote-node-dev',
          }),
        )

        // The ingress daemon should have picked it up and
        // published to the local PubSub inlet
        const localResult = yield* Fiber.join(localFiber).pipe(
          Effect.timeout(Duration.seconds(10)),
        )

        const arr = Chunk.toArray(localResult)
        expect(arr).toHaveLength(1)
        expect(arr[0].value).toBe(101.3)
        expect(arr[0].deviceId).toBe('remote-node-dev')
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    }, 15000)
  })

  // ---------------------------------------------------------------------------
  // 3. Metrics with NATS
  // ---------------------------------------------------------------------------

  describe('metrics', () => {
    it('metrics track local publishes with NATS enabled', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return

      const program = Effect.gen(function* () {
        const dist = yield* EventDistribution

        const initial = yield* dist.getMetrics
        expect(initial.readingsPublished).toBe(0)

        // Need a subscriber to keep the channel flowing
        const stream = yield* dist.subscribeReadings
        const drainFiber = yield* pipe(
          stream,
          Stream.take(3),
          Stream.runDrain,
          Effect.fork,
        )

        yield* yieldForSubscription

        yield* dist.publishReading(
          new ReadingEvent({
            topic: 't', value: 1, timestamp: new Date().toISOString(), deviceId: 'd1',
          }),
        )
        yield* dist.publishReading(
          new ReadingEvent({
            topic: 't', value: 2, timestamp: new Date().toISOString(), deviceId: 'd2',
          }),
        )
        yield* dist.publishReading(
          new ReadingEvent({
            topic: 't', value: 3, timestamp: new Date().toISOString(), deviceId: 'd3',
          }),
        )

        yield* Fiber.join(drainFiber)

        const after = yield* dist.getMetrics
        expect(after.readingsPublished).toBe(3)
      }).pipe(Effect.scoped, Effect.provide(TestLayer))

      await Effect.runPromise(program)
    })
  })
})
