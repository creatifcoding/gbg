/**
 * MockAdapter Unit Tests
 *
 * Tests for the synthetic sensor reading generator used
 * in testing the ingestion pipeline without external dependencies.
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/mock-adapter
 */

import { describe, it, expect } from '@effect/vitest'
import { Chunk, Duration, Effect, Layer, Schema, Stream } from 'effect'
import {
  IngestionAdapter,
  IngestedReading,
  type IngestionHealth,
} from '../ingestion'
import { MockAdapterConfig, MockAdapterLive } from '../mock-adapter'

// =============================================================================
// Layer Construction
// =============================================================================

describe('MockAdapterLive', () => {
  it('produces a valid Layer', () => {
    const layer = MockAdapterLive()
    // Layer.Layer<IngestionAdapter> -- if this compiles, the type is correct
    expect(layer).toBeDefined()
  })

  it('accepts custom config', () => {
    const layer = MockAdapterLive({
      ratePerSecond: 5,
      deviceTopics: ['custom/topic/1', 'custom/topic/2'],
      valueMin: 10,
      valueMax: 50,
      uncertainRate: 0.1,
      badRate: 0.02,
    })
    expect(layer).toBeDefined()
  })
})

// =============================================================================
// subscribe() Tests
// =============================================================================

describe('MockAdapter.subscribe', () => {
  it.effect('returns a Stream that emits IngestedReading instances', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(3),
        Stream.runCollect,
      )

      expect(Chunk.size(readings)).toBe(3)

      for (const reading of readings) {
        expect(reading).toBeInstanceOf(IngestedReading)
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('readings have _tag IngestedReading', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(5),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(reading._tag).toBe('IngestedReading')
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('readings have topics from configured deviceTopics', () =>
    Effect.gen(function* () {
      const topics = ['test/sensor/1', 'test/sensor/2', 'test/sensor/3']
      const layer = MockAdapterLive({ deviceTopics: topics })

      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(20),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(topics).toContain(reading.topic)
      }
    }).pipe(Effect.provide(MockAdapterLive({
      deviceTopics: ['test/sensor/1', 'test/sensor/2', 'test/sensor/3'],
    })))
  )

  it.effect('reading values are within [valueMin, valueMax]', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(50),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(reading.value).toBeGreaterThanOrEqual(0)
        expect(reading.value).toBeLessThanOrEqual(100)
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('custom value range is respected', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(50),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(reading.value).toBeGreaterThanOrEqual(20)
        expect(reading.value).toBeLessThanOrEqual(30)
      }
    }).pipe(Effect.provide(MockAdapterLive({ valueMin: 20, valueMax: 30 })))
  )

  it.effect('readings have sourceTimestamp set', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(3),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(reading.sourceTimestamp).toBeDefined()
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('readings have sourceQuality set to good, uncertain, or bad', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(20),
        Stream.runCollect,
      )

      const validQualities = ['good', 'uncertain', 'bad']
      for (const reading of readings) {
        expect(reading.sourceQuality).toBeDefined()
        expect(validQualities).toContain(reading.sourceQuality)
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )
})

// =============================================================================
// healthCheck Tests
// =============================================================================

describe('MockAdapter.healthCheck', () => {
  it.effect('returns connected=true', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const health = yield* adapter.healthCheck

      expect(health.connected).toBe(true)
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('returns protocol=mock', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const health = yield* adapter.healthCheck

      expect(health.protocol).toBe('mock')
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('returns errorCount=0', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const health = yield* adapter.healthCheck

      expect(health.errorCount).toBe(0)
    }).pipe(Effect.provide(MockAdapterLive()))
  )
})

// =============================================================================
// Default Config Tests
// =============================================================================

describe('MockAdapter defaults', () => {
  it.effect('default config produces 5 device topics', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      // Collect enough readings to statistically see all 5 topics
      const readings = yield* stream.pipe(
        Stream.take(100),
        Stream.runCollect,
      )

      const uniqueTopics = new Set(
        Chunk.toArray(readings).map((r) => r.topic),
      )

      // With 100 readings across 5 topics, probability of missing one is negligible
      expect(uniqueTopics.size).toBe(5)
    }).pipe(Effect.provide(MockAdapterLive()))
  )

  it.effect('default topics follow mock/plant-a/... pattern', () =>
    Effect.gen(function* () {
      const adapter = yield* IngestionAdapter
      const stream = yield* adapter.subscribe

      const readings = yield* stream.pipe(
        Stream.take(20),
        Stream.runCollect,
      )

      for (const reading of readings) {
        expect(reading.topic).toMatch(/^mock\/plant-a\//)
      }
    }).pipe(Effect.provide(MockAdapterLive()))
  )
})

// =============================================================================
// MockAdapterConfig Schema Tests
// =============================================================================

describe('MockAdapterConfig', () => {
  it.effect('decodes valid config', () =>
    Effect.gen(function* () {
      const config = yield* Schema.decode(MockAdapterConfig)({
        ratePerSecond: 20,
        deviceTopics: ['a', 'b'],
        valueMin: 10,
        valueMax: 90,
        uncertainRate: 0.1,
        badRate: 0.05,
      })

      expect(config.ratePerSecond).toBe(20)
      expect(config.deviceTopics).toEqual(['a', 'b'])
      expect(config.valueMin).toBe(10)
      expect(config.valueMax).toBe(90)
      expect(config.uncertainRate).toBe(0.1)
      expect(config.badRate).toBe(0.05)
    })
  )

  it.effect('all fields are optional', () =>
    Effect.gen(function* () {
      const config = yield* Schema.decode(MockAdapterConfig)({})
      expect(config).toBeDefined()
    })
  )
})
