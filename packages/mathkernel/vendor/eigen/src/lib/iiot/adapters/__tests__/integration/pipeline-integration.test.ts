/**
 * Pipeline Integration Tests (19.4.1)
 *
 * Deterministic end-to-end tests for the full ingestion pipeline:
 * IngestionAdapter → TopicRouter → ReadingProcessor → AlarmDetector → ProcessedBatch
 *
 * Unlike behavioral tests (which use MockAdapter with random data), these tests
 * inject a KNOWN sequence of readings and verify EXACT outcomes — total counts,
 * specific violations, batch boundaries, cross-batch state persistence.
 *
 * @see ingestion-service.ts (19.3.3)
 */

import { describe, it, expect } from 'vitest'
import { Chunk, DateTime, Effect, Layer, Stream } from 'effect'
import {
  IngestionService,
  IngestionServiceLive,
  setupPipeline,
} from '../../ingestion-service'
import {
  IngestionAdapter,
  IngestedReading,
  type IngestionHealth,
} from '../../ingestion'
import { TopicRouter, TopicRouterLive, type TopicRoute } from '../../device-routing'
import {
  ReadingProcessorLive,
  type BatchConfig,
} from '../../reading-processor'
import {
  AlarmDetector,
  AlarmDetectorLive,
  type SensorThresholds,
} from '../../alarm-detection'

// =============================================================================
// Test Helpers — Deterministic Adapter + Pipeline Layer
// =============================================================================

/** Create a reading with a known topic, value, and optional quality */
const r = (topic: string, value: number, quality?: string): IngestedReading =>
  new IngestedReading({
    topic,
    value,
    sourceTimestamp: DateTime.unsafeNow(),
    sourceQuality: quality,
  })

/** Custom adapter that emits a known, finite sequence of readings */
const TestAdapter = (readings: ReadonlyArray<IngestedReading>) =>
  Layer.succeed(IngestionAdapter, {
    protocol: 'test-deterministic',
    subscribe: Effect.succeed(Stream.fromIterable(readings)),
    healthCheck: Effect.succeed({
      protocol: 'test-deterministic',
      connected: true,
      errorCount: 0,
    } satisfies IngestionHealth),
  })

/** Build the full pipeline Layer from known config */
const TestPipeline = (config: {
  readings: ReadonlyArray<IngestedReading>
  routes: ReadonlyArray<TopicRoute>
  thresholds: ReadonlyArray<SensorThresholds>
  batch?: BatchConfig
}) => {
  const adapterLayer = TestAdapter(config.readings)
  const topicRouterLayer = TopicRouterLive
  const readingProcessorLayer = ReadingProcessorLive(config.batch).pipe(
    Layer.provide(topicRouterLayer),
  )
  const alarmDetectorLayer = AlarmDetectorLive
  const serviceLayer = IngestionServiceLive.pipe(
    Layer.provide(readingProcessorLayer),
    Layer.provide(alarmDetectorLayer),
    Layer.provide(adapterLayer),
  )
  return Layer.mergeAll(
    serviceLayer,
    topicRouterLayer,
    alarmDetectorLayer,
  )
}

/** Run a pipeline program with setup + deterministic config */
const runPipeline = <A>(
  config: {
    readings: ReadonlyArray<IngestedReading>
    routes: ReadonlyArray<TopicRoute>
    thresholds: ReadonlyArray<SensorThresholds>
    batch?: BatchConfig
  },
  program: Effect.Effect<A, any, IngestionService | TopicRouter | AlarmDetector>,
) =>
  Effect.gen(function* () {
    yield* setupPipeline({ routes: config.routes, thresholds: config.thresholds })
    return yield* program
  }).pipe(Effect.provide(TestPipeline(config)), Effect.runPromise)

/** Collect all batches from the pipeline */
const collectAll = Effect.gen(function* () {
  const service = yield* IngestionService
  const stream = yield* service.pipeline
  const chunks = yield* stream.pipe(Stream.runCollect)
  return Chunk.toReadonlyArray(chunks)
})

// =============================================================================
// Standard Test Fixtures
// =============================================================================

const ROUTES: TopicRoute[] = [
  { topicPattern: 'plant/line-1/temp', deviceId: 'DEV-TEMP' },
  { topicPattern: 'plant/line-1/pressure', deviceId: 'DEV-PRESS' },
  { topicPattern: 'plant/line-2/vibration', deviceId: 'DEV-VIB' },
]

const THRESHOLDS: SensorThresholds[] = [
  { deviceId: 'DEV-TEMP', thresholdHigh: 80, thresholdCritical: 95 },
  { deviceId: 'DEV-PRESS', thresholdHigh: 150 },
  { deviceId: 'DEV-VIB', thresholdHigh: 50, thresholdLow: 2 },
]

// =============================================================================
// Tests
// =============================================================================

describe('Pipeline Integration (19.4.1)', () => {
  // ===========================================================================
  // Data Flow Invariants
  // ===========================================================================

  describe('data flow invariants', () => {
    it('all routable readings appear in output batches', () => {
      const readings = [
        r('plant/line-1/temp', 25),
        r('plant/line-1/pressure', 100),
        r('plant/line-2/vibration', 30),
        r('plant/line-1/temp', 26),
        r('plant/line-1/pressure', 101),
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const total = batches.reduce((sum, b) => sum + Chunk.size(b.readings), 0)
          expect(total).toBe(5) // all 5 readings are routable
        }),
      )
    })

    it('unroutable readings are dropped silently', () => {
      const readings = [
        r('plant/line-1/temp', 25),       // routable
        r('unknown/sensor-x', 99),        // NOT routable
        r('plant/line-1/pressure', 100),  // routable
        r('other/device', 42),            // NOT routable
        r('plant/line-2/vibration', 30),  // routable
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const total = batches.reduce((sum, b) => sum + Chunk.size(b.readings), 0)
          expect(total).toBe(3) // only 3 routable
        }),
      )
    })

    it('readings are routed to correct device IDs', () => {
      const readings = [
        r('plant/line-1/temp', 25),
        r('plant/line-1/pressure', 100),
        r('plant/line-2/vibration', 30),
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const all = batches.flatMap((b) => Chunk.toReadonlyArray(b.readings))

          const byTopic = Object.fromEntries(
            all.map((rr) => [rr.reading.topic, rr.deviceId]),
          )
          expect(byTopic['plant/line-1/temp']).toBe('DEV-TEMP')
          expect(byTopic['plant/line-1/pressure']).toBe('DEV-PRESS')
          expect(byTopic['plant/line-2/vibration']).toBe('DEV-VIB')
        }),
      )
    })

    it('empty input stream produces no batches', () =>
      runPipeline(
        { readings: [], routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(0)
        }),
      ))

    it('all unroutable input produces no batches', () => {
      const readings = [
        r('unknown/a', 1),
        r('unknown/b', 2),
        r('unknown/c', 3),
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const total = batches.reduce((sum, b) => sum + Chunk.size(b.readings), 0)
          expect(total).toBe(0)
        }),
      )
    })
  })

  // ===========================================================================
  // Batch Boundaries
  // ===========================================================================

  describe('batch boundaries', () => {
    it('respects maxBatchSize — 15 readings with batchSize=5 yields [5, 5, 5]', () => {
      const readings = Array.from({ length: 15 }, (_, i) =>
        r('plant/line-1/temp', i),
      )

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 5, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(3)
          expect(Chunk.size(batches[0]!.readings)).toBe(5)
          expect(Chunk.size(batches[1]!.readings)).toBe(5)
          expect(Chunk.size(batches[2]!.readings)).toBe(5)
        }),
      )
    })

    it('partial final batch — 7 readings with batchSize=3 yields [3, 3, 1]', () => {
      const readings = Array.from({ length: 7 }, (_, i) =>
        r('plant/line-1/temp', i),
      )

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 3, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(3)
          expect(Chunk.size(batches[0]!.readings)).toBe(3)
          expect(Chunk.size(batches[1]!.readings)).toBe(3)
          expect(Chunk.size(batches[2]!.readings)).toBe(1)
        }),
      )
    })

    it('single reading yields single batch of size 1', () =>
      runPipeline(
        {
          readings: [r('plant/line-1/temp', 42)],
          routes: ROUTES,
          thresholds: [],
          batch: { maxBatchSize: 100 },
        },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(1)
          expect(Chunk.size(batches[0]!.readings)).toBe(1)
        }),
      ))
  })

  // ===========================================================================
  // Alarm Detection — Deterministic Threshold Crossing
  // ===========================================================================

  describe('alarm detection — deterministic', () => {
    it('reading above thresholdHigh triggers violation', () => {
      const readings = [r('plant/line-1/temp', 85)] // > 80 threshold

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(1)
          expect(batches[0]!.violations.length).toBe(1)
          expect(batches[0]!.violations[0]!._tag).toBe('ThresholdViolation')
          expect(batches[0]!.violations[0]!.deviceId).toBe('DEV-TEMP')
          expect(batches[0]!.violations[0]!.status).toBe('high')
          expect(batches[0]!.violations[0]!.value).toBe(85)
        }),
      )
    })

    it('reading above thresholdCritical triggers critical_high', () => {
      const readings = [r('plant/line-1/temp', 98)] // > 95 critical

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches[0]!.violations[0]!.status).toBe('critical_high')
        }),
      )
    })

    it('reading below thresholdLow triggers low violation', () => {
      const readings = [r('plant/line-2/vibration', 1)] // < 2 low threshold

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches[0]!.violations[0]!.status).toBe('low')
          expect(batches[0]!.violations[0]!.deviceId).toBe('DEV-VIB')
        }),
      )
    })

    it('reading within normal range produces no violations', () => {
      const readings = [
        r('plant/line-1/temp', 50),       // normal (< 80)
        r('plant/line-1/pressure', 100),  // normal (< 150)
        r('plant/line-2/vibration', 25),  // normal (> 2 and < 50)
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const totalViolations = batches.reduce((sum, b) => sum + b.violations.length, 0)
          expect(totalViolations).toBe(0)
        }),
      )
    })

    it('no registered thresholds produces no violations regardless of value', () => {
      const readings = [
        r('plant/line-1/temp', 999),  // extreme value
        r('plant/line-1/pressure', -999),
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const totalViolations = batches.reduce((sum, b) => sum + b.violations.length, 0)
          expect(totalViolations).toBe(0)
        }),
      )
    })
  })

  // ===========================================================================
  // Deadband — Cross-Batch State Persistence
  // ===========================================================================

  describe('deadband across batches', () => {
    it('alarm triggers in batch 1, suppressed in batch 2 (same device still above threshold)', () => {
      // 6 readings, batchSize=3 → 2 batches
      // DEV-TEMP threshold: 80
      const readings = [
        r('plant/line-1/temp', 85),  // batch 1: TRIGGER (normal → high)
        r('plant/line-1/temp', 87),  // batch 1: SUPPRESS (already high)
        r('plant/line-1/temp', 90),  // batch 1: SUPPRESS
        r('plant/line-1/temp', 88),  // batch 2: SUPPRESS (still high, deadband persists)
        r('plant/line-1/temp', 92),  // batch 2: SUPPRESS
        r('plant/line-1/temp', 86),  // batch 2: SUPPRESS
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 3, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(2)

          // Batch 1: first reading triggers, subsequent suppressed
          expect(batches[0]!.violations.length).toBe(1)
          expect(batches[0]!.violations[0]!.value).toBe(85)

          // Batch 2: all suppressed (deadband persists across batches)
          expect(batches[1]!.violations.length).toBe(0)
        }),
      )
    })

    it('alarm clears when reading returns to normal, re-triggers on next crossing', () => {
      // DEV-TEMP threshold: 80
      const readings = [
        r('plant/line-1/temp', 85),  // TRIGGER (normal → high)
        r('plant/line-1/temp', 50),  // CLEAR (high → normal)
        r('plant/line-1/temp', 90),  // RE-TRIGGER (normal → high again)
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const violations = batches.flatMap((b) => b.violations)
          expect(violations.length).toBe(2) // trigger + re-trigger
          expect(violations[0]!.value).toBe(85)
          expect(violations[1]!.value).toBe(90)
        }),
      )
    })

    it('multi-device alarm tracking is independent', () => {
      // DEV-TEMP threshold: 80, DEV-PRESS threshold: 150
      const readings = [
        r('plant/line-1/temp', 85),      // DEV-TEMP: TRIGGER
        r('plant/line-1/pressure', 160), // DEV-PRESS: TRIGGER
        r('plant/line-1/temp', 88),      // DEV-TEMP: SUPPRESS (already in alarm)
        r('plant/line-1/pressure', 100), // DEV-PRESS: CLEAR (returns to normal)
        r('plant/line-1/temp', 50),      // DEV-TEMP: CLEAR
        r('plant/line-1/pressure', 155), // DEV-PRESS: RE-TRIGGER
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const violations = batches.flatMap((b) => b.violations)

          expect(violations.length).toBe(3)
          // 1st: DEV-TEMP triggers
          expect(violations[0]!.deviceId).toBe('DEV-TEMP')
          expect(violations[0]!.value).toBe(85)
          // 2nd: DEV-PRESS triggers
          expect(violations[1]!.deviceId).toBe('DEV-PRESS')
          expect(violations[1]!.value).toBe(160)
          // 3rd: DEV-PRESS re-triggers after clearing
          expect(violations[2]!.deviceId).toBe('DEV-PRESS')
          expect(violations[2]!.value).toBe(155)
        }),
      )
    })

    it('alarm escalation: high → critical_high is suppressed by deadband', () => {
      // DEV-TEMP: thresholdHigh=80, thresholdCritical=95
      const readings = [
        r('plant/line-1/temp', 85),  // TRIGGER high
        r('plant/line-1/temp', 98),  // SUPPRESS (already in alarm — high→critical_high is NOT a new transition from normal)
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 100, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const violations = batches.flatMap((b) => b.violations)
          // Only the initial trigger at 85 (high). The escalation to 98 (critical_high)
          // is suppressed because the device was already in alarm state.
          expect(violations.length).toBe(1)
          expect(violations[0]!.status).toBe('high')
        }),
      )
    })
  })

  // ===========================================================================
  // Glob Route Matching
  // ===========================================================================

  describe('glob route matching in pipeline', () => {
    it('glob patterns route multiple topics to the same device', () => {
      const globRoutes: TopicRoute[] = [
        { topicPattern: 'plant/line-1/*', deviceId: 'DEV-LINE-1' },
      ]
      const readings = [
        r('plant/line-1/temp', 25),
        r('plant/line-1/pressure', 100),
        r('plant/line-1/vibration', 30),
        r('plant/line-2/temp', 40), // NOT matched by glob (line-2 ≠ line-1)
      ]

      return runPipeline(
        { readings, routes: globRoutes, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const all = batches.flatMap((b) => Chunk.toReadonlyArray(b.readings))

          expect(all.length).toBe(3) // only line-1 topics
          for (const rr of all) {
            expect(rr.deviceId).toBe('DEV-LINE-1')
          }
        }),
      )
    })

    it('exact routes take priority (checked before glob)', () => {
      const mixedRoutes: TopicRoute[] = [
        { topicPattern: 'plant/line-1/temp', deviceId: 'DEV-EXACT-TEMP' },  // exact
        { topicPattern: 'plant/line-1/*', deviceId: 'DEV-GLOB-LINE1' },     // glob
      ]
      const readings = [
        r('plant/line-1/temp', 25),       // should match EXACT
        r('plant/line-1/pressure', 100),  // should match GLOB
      ]

      return runPipeline(
        { readings, routes: mixedRoutes, thresholds: [], batch: { maxBatchSize: 100 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          const all = batches.flatMap((b) => Chunk.toReadonlyArray(b.readings))

          const tempRouted = all.find((rr) => rr.reading.topic === 'plant/line-1/temp')
          const pressRouted = all.find((rr) => rr.reading.topic === 'plant/line-1/pressure')

          expect(tempRouted!.deviceId).toBe('DEV-EXACT-TEMP')   // exact match wins
          expect(pressRouted!.deviceId).toBe('DEV-GLOB-LINE1')  // glob fallback
        }),
      )
    })
  })

  // ===========================================================================
  // Mixed Scenario — Realistic Multi-Device Flow
  // ===========================================================================

  describe('realistic multi-device scenario', () => {
    it('10 readings across 3 devices: routes, batches, alarms all correct', () => {
      const readings = [
        // Batch 1 (5 readings)
        r('plant/line-1/temp', 25),       // DEV-TEMP: normal
        r('plant/line-1/pressure', 100),  // DEV-PRESS: normal
        r('plant/line-2/vibration', 55),  // DEV-VIB: TRIGGER high (>50)
        r('plant/line-1/temp', 85),       // DEV-TEMP: TRIGGER high (>80)
        r('plant/line-1/pressure', 160),  // DEV-PRESS: TRIGGER high (>150)
        // Batch 2 (5 readings)
        r('plant/line-2/vibration', 52),  // DEV-VIB: SUPPRESS (still high)
        r('plant/line-1/temp', 50),       // DEV-TEMP: CLEAR (returns to normal)
        r('plant/line-1/pressure', 140),  // DEV-PRESS: CLEAR (returns to normal)
        r('plant/line-1/temp', 90),       // DEV-TEMP: RE-TRIGGER high
        r('plant/line-2/vibration', 1),   // DEV-VIB: CLEAR + LOW? Let's see...
        // vibration thresholdLow=2, value=1 → low violation
        // But VIB was in high alarm state. Going from high → low is:
        // First it goes to non-normal (low), so deadband says: was already in alarm (high),
        // value changed from high to low. Since wasNormal is false (was high), it won't trigger.
        // Actually, let me re-check the deadband logic:
        // status = 'low' (value 1 <= thresholdLow 2)
        // current = Some('high') → wasNormal = false
        // status !== 'normal' && !wasNormal → no trigger (status changed but not from normal)
        // So this is suppressed.
        // BUT the activeAlarms map now has DEV-VIB = 'low'
        // Hmm, this is an edge case. The deadband only triggers on normal→alarm transitions.
        // high→low is NOT normal→alarm, so it's suppressed.
      ]

      return runPipeline(
        { readings, routes: ROUTES, thresholds: THRESHOLDS, batch: { maxBatchSize: 5, maxBatchWindowMs: 60_000 } },
        Effect.gen(function* () {
          const batches = yield* collectAll
          expect(batches.length).toBe(2)

          // Total readings: all 10 are routable
          const totalReadings = batches.reduce(
            (sum, b) => sum + Chunk.size(b.readings),
            0,
          )
          expect(totalReadings).toBe(10)

          // Batch 1 violations:
          // - DEV-VIB: high (value 55 > 50) — TRIGGER
          // - DEV-TEMP: high (value 85 > 80) — TRIGGER
          // - DEV-PRESS: high (value 160 > 150) — TRIGGER
          expect(batches[0]!.violations.length).toBe(3)

          const b1Devices = batches[0]!.violations.map((v) => v.deviceId).sort()
          expect(b1Devices).toEqual(['DEV-PRESS', 'DEV-TEMP', 'DEV-VIB'])

          // Batch 2 violations:
          // - DEV-VIB suppress (still in alarm)
          // - DEV-TEMP clears then re-triggers at 90 → 1 violation
          // - DEV-PRESS clears (no re-trigger, stays normal)
          // - DEV-VIB value=1 is low, but was already in alarm → suppressed
          expect(batches[1]!.violations.length).toBe(1)
          expect(batches[1]!.violations[0]!.deviceId).toBe('DEV-TEMP')
          expect(batches[1]!.violations[0]!.value).toBe(90)
        }),
      )
    })
  })

  // ===========================================================================
  // Health Check
  // ===========================================================================

  describe('health check', () => {
    it('delegates to the underlying adapter', () =>
      runPipeline(
        { readings: [], routes: [], thresholds: [] },
        Effect.gen(function* () {
          const service = yield* IngestionService
          const health = yield* service.healthCheck
          expect(health.protocol).toBe('test-deterministic')
          expect(health.connected).toBe(true)
          expect(health.errorCount).toBe(0)
        }),
      ))

    it('exposes protocol name from adapter', () =>
      runPipeline(
        { readings: [], routes: [], thresholds: [] },
        Effect.gen(function* () {
          const service = yield* IngestionService
          expect(service.protocol).toBe('test-deterministic')
        }),
      ))
  })
})
