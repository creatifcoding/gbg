/**
 * Adapter Property-Based Tests
 *
 * Uses fast-check with Effect Schema Arbitrary for property-based testing
 * of adapter pipeline components. Verifies roundtrip, determinism, and
 * schema invariants.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/property/adapter-properties
 */

import { describe, it, expect } from 'vitest'
import { Arbitrary, Schema, FastCheck as fc } from 'effect'
import { Effect, Chunk, DateTime, Layer, Stream } from 'effect'
import { it as effectIt } from '@effect/vitest'
import { IngestedReading } from '../../ingestion'
import { MockAdapterLive, MockAdapterConfig } from '../../mock-adapter'
import { IngestionAdapter } from '../../ingestion'
import { TopicRouter, TopicRouterLive, type TopicRoute } from '../../device-routing'
import { BatchConfig } from '../../reading-processor'
import {
  checkThresholds,
  ThresholdStatus,
  type SensorThresholds,
} from '../../alarm-detection'

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// IngestedReading Schema Properties
// =============================================================================

describe('Adapter Property Tests', () => {
  describe('IngestedReading Schema', () => {
    it('encode -> decode roundtrip preserves shape', () => {
      const arb = Arbitrary.make(IngestedReading)
      fc.assert(
        fc.property(arb, (reading) => {
          const encoded = Schema.encodeSync(IngestedReading)(reading)
          const decoded = Schema.decodeSync(IngestedReading)(encoded)
          expect(decoded.topic).toBe(reading.topic)
          expect(decoded.value).toBe(reading.value)
          expect(decoded._tag).toBe('IngestedReading')
          return true
        }),
        { numRuns: 50 },
      )
    })

    it('all generated readings have _tag IngestedReading', () => {
      const arb = Arbitrary.make(IngestedReading)
      fc.assert(
        fc.property(arb, (reading) => {
          expect(reading._tag).toBe('IngestedReading')
          return true
        }),
        { numRuns: 100 },
      )
    })

    it('idempotent encoding: encode(decode(encode(x))) === encode(x)', () => {
      const arb = Arbitrary.make(IngestedReading)
      fc.assert(
        fc.property(arb, (reading) => {
          const encoded1 = Schema.encodeSync(IngestedReading)(reading)
          const decoded = Schema.decodeSync(IngestedReading)(encoded1)
          const encoded2 = Schema.encodeSync(IngestedReading)(decoded)
          expect(encoded2).toEqual(encoded1)
          return true
        }),
        { numRuns: 50 },
      )
    })
  })

  // ===========================================================================
  // checkThresholds Properties
  // ===========================================================================

  describe('checkThresholds', () => {
    it('is deterministic: same input always produces same output', () => {
      const allThresholds = makeThresholds('DEV-prop', {
        thresholdHigh: 80,
        thresholdCritical: 95,
        thresholdLow: 10,
        thresholdCriticalLow: 5,
      })

      fc.assert(
        fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const result1 = checkThresholds(value, allThresholds)
          const result2 = checkThresholds(value, allThresholds)
          expect(result1).toBe(result2)
          return true
        }),
        { numRuns: 200 },
      )
    })

    it('critical always takes priority over non-critical', () => {
      // When both critical and high are set, and value exceeds both,
      // critical_high should always win
      const thresholds = makeThresholds('DEV-priority', {
        thresholdHigh: 80,
        thresholdCritical: 95,
        thresholdLow: 10,
        thresholdCriticalLow: 5,
      })

      fc.assert(
        fc.property(
          fc.double({ min: 95, max: 10000, noNaN: true }),
          (value) => {
            const result = checkThresholds(value, thresholds)
            expect(result).toBe('critical_high')
            return true
          },
        ),
        { numRuns: 100 },
      )

      fc.assert(
        fc.property(
          fc.double({ min: -10000, max: 5, noNaN: true }),
          (value) => {
            const result = checkThresholds(value, thresholds)
            expect(result).toBe('critical_low')
            return true
          },
        ),
        { numRuns: 100 },
      )
    })

    it('normal returned when value is within all thresholds', () => {
      const thresholds = makeThresholds('DEV-normal', {
        thresholdHigh: 80,
        thresholdCritical: 95,
        thresholdLow: 10,
        thresholdCriticalLow: 5,
      })

      // Values strictly between (10, 80) exclusive of boundaries
      fc.assert(
        fc.property(
          fc.double({ min: 10.01, max: 79.99, noNaN: true }),
          (value) => {
            const result = checkThresholds(value, thresholds)
            expect(result).toBe('normal')
            return true
          },
        ),
        { numRuns: 100 },
      )
    })

    it('no thresholds configured always returns normal', () => {
      const empty = makeThresholds('DEV-empty')

      fc.assert(
        fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (value) => {
          expect(checkThresholds(value, empty)).toBe('normal')
          return true
        }),
        { numRuns: 100 },
      )
    })

    it('result is always a valid ThresholdStatus', () => {
      const validStatuses = new Set<string>([
        'normal',
        'high',
        'critical_high',
        'low',
        'critical_low',
      ])

      const thresholds = makeThresholds('DEV-status', {
        thresholdHigh: 80,
        thresholdCritical: 95,
        thresholdLow: 10,
        thresholdCriticalLow: 5,
      })

      fc.assert(
        fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (value) => {
          const result = checkThresholds(value, thresholds)
          expect(validStatuses.has(result)).toBe(true)
          return true
        }),
        { numRuns: 200 },
      )
    })
  })

  // ===========================================================================
  // TopicRouter Properties
  // ===========================================================================

  describe('TopicRouter', () => {
    effectIt.effect('exact match always resolves registered routes', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter

        // Register a set of routes
        const routes: TopicRoute[] = [
          { topicPattern: 'sensor/temp-01', deviceId: 'DEV-T1' },
          { topicPattern: 'sensor/temp-02', deviceId: 'DEV-T2' },
          { topicPattern: 'sensor/pressure-01', deviceId: 'DEV-P1' },
        ]
        yield* router.registerBatch(routes)

        // Every registered route should resolve
        for (const route of routes) {
          const result = yield* router.resolve(route.topicPattern)
          expect(result).toBe(route.deviceId)
        }
      }).pipe(Effect.provide(TopicRouterLive)),
    )

    effectIt.effect('unregistered topics always return null', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter

        // Register only one route
        yield* router.register({
          topicPattern: 'registered/topic',
          deviceId: 'DEV-1',
        })

        // Random unregistered topics should all return null
        const unregistered = [
          'unregistered/topic',
          'some/other/topic',
          'completely-different',
          '',
          'registered/topic/extra-segment',
        ]

        for (const topic of unregistered) {
          const result = yield* router.resolve(topic)
          expect(result).toBeNull()
        }
      }).pipe(Effect.provide(TopicRouterLive)),
    )

    effectIt.effect('glob pattern matches correct topics', () =>
      Effect.gen(function* () {
        const router = yield* TopicRouter

        yield* router.register({
          topicPattern: 'spBv1.0/acme/DDATA/*/temp',
          deviceId: 'DEV-glob',
        })

        // Should match single-segment wildcards
        const match1 = yield* router.resolve('spBv1.0/acme/DDATA/site-a/temp')
        expect(match1).toBe('DEV-glob')

        const match2 = yield* router.resolve('spBv1.0/acme/DDATA/site-b/temp')
        expect(match2).toBe('DEV-glob')

        // Should NOT match multi-segment
        const noMatch = yield* router.resolve('spBv1.0/acme/DDATA/site-a/sub/temp')
        expect(noMatch).toBeNull()
      }).pipe(Effect.provide(TopicRouterLive)),
    )
  })

  // ===========================================================================
  // BatchConfig Properties
  // ===========================================================================

  describe('BatchConfig', () => {
    it('non-positive maxBatchSize always rejected by schema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 0 }),
          (size) => {
            expect(() =>
              Schema.decodeUnknownSync(BatchConfig)({ maxBatchSize: size }),
            ).toThrow()
            return true
          },
        ),
        { numRuns: 50 },
      )
    })

    it('non-integer values always rejected by schema', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 100, noNaN: true }).filter((n) => n % 1 !== 0),
          (size) => {
            expect(() =>
              Schema.decodeUnknownSync(BatchConfig)({ maxBatchSize: size }),
            ).toThrow()
            return true
          },
        ),
        { numRuns: 50 },
      )
    })

    it('positive integers always accepted by schema', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (size) => {
            const decoded = Schema.decodeUnknownSync(BatchConfig)({
              maxBatchSize: size,
            })
            expect(decoded.maxBatchSize).toBe(size)
            return true
          },
        ),
        { numRuns: 50 },
      )
    })

    it('non-positive maxBatchWindowMs always rejected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 0 }),
          (ms) => {
            expect(() =>
              Schema.decodeUnknownSync(BatchConfig)({ maxBatchWindowMs: ms }),
            ).toThrow()
            return true
          },
        ),
        { numRuns: 50 },
      )
    })
  })

  // ===========================================================================
  // MockAdapterConfig Properties
  // ===========================================================================

  describe('MockAdapterConfig', () => {
    effectIt.effect('readings always within [valueMin, valueMax]', () =>
      Effect.gen(function* () {
        const min = 20
        const max = 40
        const adapter = yield* IngestionAdapter
        const stream = yield* adapter.subscribe

        const readings = yield* stream.pipe(Stream.take(100), Stream.runCollect)

        for (const reading of readings) {
          expect(reading.value).toBeGreaterThanOrEqual(min)
          expect(reading.value).toBeLessThanOrEqual(max)
        }
      }).pipe(Effect.provide(MockAdapterLive({ valueMin: 20, valueMax: 40 }))),
    )

    effectIt.effect('topics always from configured deviceTopics', () =>
      Effect.gen(function* () {
        const topics = ['a/b/c', 'd/e/f', 'g/h/i']
        const adapter = yield* IngestionAdapter
        const stream = yield* adapter.subscribe

        const readings = yield* stream.pipe(Stream.take(100), Stream.runCollect)

        for (const reading of readings) {
          expect(topics).toContain(reading.topic)
        }
      }).pipe(
        Effect.provide(
          MockAdapterLive({ deviceTopics: ['a/b/c', 'd/e/f', 'g/h/i'] }),
        ),
      ),
    )

    effectIt.effect('quality is always good, uncertain, or bad', () =>
      Effect.gen(function* () {
        const adapter = yield* IngestionAdapter
        const stream = yield* adapter.subscribe

        const readings = yield* stream.pipe(Stream.take(200), Stream.runCollect)

        const validQualities = new Set(['good', 'uncertain', 'bad'])
        for (const reading of readings) {
          expect(reading.sourceQuality).toBeDefined()
          expect(validQualities.has(reading.sourceQuality!)).toBe(true)
        }
      }).pipe(Effect.provide(MockAdapterLive())),
    )

    it('MockAdapterConfig schema roundtrip', () => {
      const arb = Arbitrary.make(MockAdapterConfig)
      fc.assert(
        fc.property(arb, (config) => {
          const encoded = Schema.encodeSync(MockAdapterConfig)(config)
          const decoded = Schema.decodeSync(MockAdapterConfig)(encoded)
          // Roundtrip should preserve all defined fields
          if (config.ratePerSecond !== undefined) {
            expect(decoded.ratePerSecond).toBe(config.ratePerSecond)
          }
          if (config.valueMin !== undefined) {
            expect(decoded.valueMin).toBe(config.valueMin)
          }
          if (config.valueMax !== undefined) {
            expect(decoded.valueMax).toBe(config.valueMax)
          }
          return true
        }),
        { numRuns: 50 },
      )
    })
  })
})
