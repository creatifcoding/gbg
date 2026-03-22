/**
 * Adapter Pipeline Stress Tests
 *
 * Tests pipeline components under high load, scale, and concurrency.
 * Verifies throughput, memory stability, and backpressure handling.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/stress/pipeline-stress
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Chunk, DateTime, Duration, Effect, HashMap, Layer, Ref, Stream } from 'effect'
import { IngestedReading, IngestionAdapter } from '../../ingestion'
import { MockAdapterLive } from '../../mock-adapter'
import { TopicRouter, TopicRouterLive, type TopicRoute } from '../../device-routing'
import {
  ReadingProcessor,
  ReadingProcessorLive,
} from '../../reading-processor'
import {
  AlarmDetector,
  AlarmDetectorLive,
  type SensorThresholds,
} from '../../alarm-detection'

// =============================================================================
// Helpers
// =============================================================================

const makeReading = (topic: string, value: number): IngestedReading =>
  new IngestedReading({
    topic,
    value,
    sourceTimestamp: DateTime.unsafeNow(),
  })

const makeThresholds = (
  deviceId: string,
  overrides: Partial<Omit<SensorThresholds, 'deviceId'>> = {},
): SensorThresholds => ({
  deviceId,
  thresholdHigh: overrides.thresholdHigh,
  thresholdCritical: overrides.thresholdCritical,
  thresholdLow: overrides.thresholdLow,
  thresholdCriticalLow: overrides.thresholdCriticalLow,
})

/**
 * Simple topic router that routes anything with the given prefix.
 */
const prefixRouter = (prefix: string) =>
  Layer.succeed(TopicRouter, {
    resolve: (topic: string) =>
      Effect.succeed(topic.startsWith(prefix) ? `DEV-${topic}` : null),
    register: () => Effect.void,
    registerBatch: () => Effect.void,
  })

// =============================================================================
// Stress Tests
// =============================================================================

describe('Adapter Stress Tests', () => {
  it.effect(
    'sustained throughput: 10,000 readings through TopicRouter + ReadingProcessor',
    () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        const readings = Array.from({ length: 10_000 }, (_, i) =>
          makeReading(`routed/sensor-${i % 100}`, Math.random() * 100),
        )
        const source = Stream.fromIterable(readings)
        const batched = processor.process(source)

        const start = Date.now()
        const result = yield* batched.pipe(Stream.runCollect)
        const elapsed = Date.now() - start

        const batches = Chunk.toArray(result)
        const totalReadings = batches.reduce(
          (sum, batch) => sum + Chunk.size(batch),
          0,
        )

        // All 10,000 readings should be processed
        expect(totalReadings).toBe(10_000)

        // Batches should respect max size
        for (const batch of batches) {
          expect(Chunk.size(batch)).toBeLessThanOrEqual(500)
        }

        // Should complete in reasonable time (< 10s for 10k readings)
        expect(elapsed).toBeLessThan(10_000)
      }).pipe(
        Effect.provide(
          ReadingProcessorLive({ maxBatchSize: 500, maxBatchWindowMs: 60_000 }).pipe(
            Layer.provide(prefixRouter('routed/')),
          ),
        ),
      ),
    { timeout: 30_000 },
  )

  it.effect(
    'AlarmDetector memory: 1000 registered devices, 10,000 readings, no memory leak',
    () =>
      Effect.gen(function* () {
        const detector = yield* AlarmDetector

        // Register 1000 devices with thresholds
        for (let i = 0; i < 1000; i++) {
          yield* detector.registerThresholds(
            makeThresholds(`DEV-${i}`, {
              thresholdHigh: 80,
              thresholdCritical: 95,
              thresholdLow: 10,
              thresholdCriticalLow: 5,
            }),
          )
        }

        const now = DateTime.unsafeNow()
        let alarmCount = 0

        // Send 10,000 readings across those 1000 devices
        for (let i = 0; i < 10_000; i++) {
          const deviceId = `DEV-${i % 1000}`
          // Alternate between normal and alarm values
          const value = i % 3 === 0 ? 85 : 50
          const violation = yield* detector.checkReading(deviceId, value, now)
          if (violation !== null) alarmCount++
        }

        // Some alarms should have fired (every 3rd reading for each device)
        expect(alarmCount).toBeGreaterThan(0)

        // Memory check: We can't directly measure heap, but the fact that
        // we completed 10k operations without OOM is the test.
        // Alarms are only tracked per-device (1000 max), not per-reading.
      }).pipe(Effect.provide(AlarmDetectorLive)),
    { timeout: 30_000 },
  )

  it.effect(
    'TopicRouter scale: 500 exact routes, verify sub-ms resolution',
    () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter

        // Register 500 exact routes
        const routes: TopicRoute[] = Array.from({ length: 500 }, (_, i) => ({
          topicPattern: `factory/line-${i}/sensor/temp`,
          deviceId: `DEV-${i}`,
        }))
        yield* router.registerBatch(routes)

        // Resolve each route and measure timing
        const start = Date.now()
        for (const route of routes) {
          const result = yield* router.resolve(route.topicPattern)
          expect(result).toBe(route.deviceId)
        }
        const elapsed = Date.now() - start

        // 500 HashMap lookups should be very fast (< 500ms total)
        expect(elapsed).toBeLessThan(500)

        // Average per-lookup should be well under 1ms
        const avgMs = elapsed / routes.length
        expect(avgMs).toBeLessThan(1)
      }).pipe(Effect.provide(TopicRouterLive)),
    { timeout: 10_000 },
  )

  it.effect(
    'ReadingProcessor backpressure: fast producer, verify all readings captured',
    () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        // Create a large stream of readings
        const count = 5_000
        const readings = Array.from({ length: count }, (_, i) =>
          makeReading(`routed/fast-sensor-${i % 50}`, i * 0.1),
        )

        const source = Stream.fromIterable(readings)
        const batched = processor.process(source)

        const result = yield* batched.pipe(Stream.runCollect)
        const batches = Chunk.toArray(result)
        const totalReadings = batches.reduce(
          (sum, batch) => sum + Chunk.size(batch),
          0,
        )

        // No readings should be lost despite fast production
        expect(totalReadings).toBe(count)
      }).pipe(
        Effect.provide(
          ReadingProcessorLive({ maxBatchSize: 100, maxBatchWindowMs: 60_000 }).pipe(
            Layer.provide(prefixRouter('routed/')),
          ),
        ),
      ),
    { timeout: 30_000 },
  )

  it.effect(
    'concurrent streams: 3 MockAdapters merged, verify isolation',
    () =>
      Effect.gen(function* () {
        // Create 3 separate adapters with distinct topic sets
        const topics1 = ['adapter-1/temp', 'adapter-1/pressure']
        const topics2 = ['adapter-2/vibration', 'adapter-2/flow']
        const topics3 = ['adapter-3/humidity', 'adapter-3/speed']

        // Get streams from each adapter independently
        const stream1 = yield* Effect.provide(
          Effect.gen(function* () {
            const a = yield* IngestionAdapter
            return yield* a.subscribe
          }),
          MockAdapterLive({ deviceTopics: topics1 }),
        )

        const stream2 = yield* Effect.provide(
          Effect.gen(function* () {
            const a = yield* IngestionAdapter
            return yield* a.subscribe
          }),
          MockAdapterLive({ deviceTopics: topics2 }),
        )

        const stream3 = yield* Effect.provide(
          Effect.gen(function* () {
            const a = yield* IngestionAdapter
            return yield* a.subscribe
          }),
          MockAdapterLive({ deviceTopics: topics3 }),
        )

        // Take 100 from each and merge
        const merged = Stream.merge(
          Stream.merge(
            stream1.pipe(Stream.take(100)),
            stream2.pipe(Stream.take(100)),
          ),
          stream3.pipe(Stream.take(100)),
        )

        const result = yield* merged.pipe(Stream.runCollect)
        const readings = Chunk.toArray(result)

        // Should have 300 total readings
        expect(readings).toHaveLength(300)

        // Verify isolation: each reading's topic should belong to exactly one adapter
        const allTopics = [...topics1, ...topics2, ...topics3]
        for (const reading of readings) {
          expect(allTopics).toContain(reading.topic)
        }

        // Count topics by adapter prefix
        const adapter1Count = readings.filter((r) =>
          r.topic.startsWith('adapter-1/'),
        ).length
        const adapter2Count = readings.filter((r) =>
          r.topic.startsWith('adapter-2/'),
        ).length
        const adapter3Count = readings.filter((r) =>
          r.topic.startsWith('adapter-3/'),
        ).length

        expect(adapter1Count).toBe(100)
        expect(adapter2Count).toBe(100)
        expect(adapter3Count).toBe(100)
      }),
    { timeout: 30_000 },
  )

  it.effect(
    'TopicRouter glob scale: 50 glob routes + 10,000 lookups',
    () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter

        // Register 50 glob routes
        const globRoutes: TopicRoute[] = Array.from({ length: 50 }, (_, i) => ({
          topicPattern: `factory/line-${i}/*/temp`,
          deviceId: `DEV-glob-${i}`,
        }))
        yield* router.registerBatch(globRoutes)

        const start = Date.now()
        let resolvedCount = 0

        // 10,000 lookups against glob routes
        for (let i = 0; i < 10_000; i++) {
          const lineIdx = i % 50
          const topic = `factory/line-${lineIdx}/machine-${i % 20}/temp`
          const result = yield* router.resolve(topic)
          if (result !== null) resolvedCount++
        }
        const elapsed = Date.now() - start

        // All should resolve (each matches a glob pattern)
        expect(resolvedCount).toBe(10_000)

        // Should complete within reasonable time (< 5s for glob scan)
        expect(elapsed).toBeLessThan(5_000)
      }).pipe(Effect.provide(TopicRouterLive)),
    { timeout: 15_000 },
  )

  it.effect(
    'AlarmDetector rapid state transitions: alarm -> normal -> alarm cycle',
    () =>
      Effect.gen(function* () {
        const detector = yield* AlarmDetector

        yield* detector.registerThresholds(
          makeThresholds('DEV-rapid', { thresholdHigh: 80 }),
        )

        const now = DateTime.unsafeNow()
        let alarmFires = 0

        // Rapid cycle 1000 times: value alternates between normal and alarm
        for (let i = 0; i < 1000; i++) {
          const value = i % 2 === 0 ? 85 : 50 // even=alarm, odd=normal
          const result = yield* detector.checkReading('DEV-rapid', value, now)
          if (result !== null) alarmFires++
        }

        // Every transition from normal->alarm should fire
        // 0=alarm(fire), 1=normal(clear), 2=alarm(fire), 3=normal(clear)...
        // So 500 alarm fires expected
        expect(alarmFires).toBe(500)
      }).pipe(Effect.provide(AlarmDetectorLive)),
    { timeout: 10_000 },
  )
})
