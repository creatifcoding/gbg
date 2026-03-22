/**
 * ReadingProcessor Service Tests
 *
 * Tests the reading batch processor pipeline:
 * - Topic routing via TopicRouter (routable vs unroutable)
 * - Micro-batching via Stream.groupedWithin
 * - Default and custom BatchConfig
 * - Tag identity
 * - BatchConfig schema roundtrip
 *
 * @module @gbg/tmnl/iiot/adapters/__tests__/reading-processor
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Chunk, DateTime, Effect, Layer, Schema, Stream } from 'effect'
import { IngestedReading } from '../ingestion'
import { TopicRouter } from '../device-routing'
import {
  BatchConfig,
  ReadingProcessor,
  ReadingProcessorLive,
  type RoutedReading,
} from '../reading-processor'

// =============================================================================
// Test TopicRouter — known topics get routed, unknown dropped
// =============================================================================

const TestTopicRouter = Layer.succeed(TopicRouter, {
  resolve: (topic: string) =>
    Effect.succeed(topic.startsWith('known/') ? `DEV-${topic}` : null),
  register: () => Effect.void,
  registerBatch: () => Effect.void,
})

// =============================================================================
// Helpers
// =============================================================================

const makeReading = (topic: string, value: number): IngestedReading =>
  new IngestedReading({
    topic,
    value,
    sourceTimestamp: DateTime.unsafeNow(),
  })

// =============================================================================
// Tests
// =============================================================================

describe('ReadingProcessor', () => {
  // Default config layer with test router
  const DefaultTestLayer = ReadingProcessorLive().pipe(
    Layer.provide(TestTopicRouter)
  )

  // =========================================================================
  // Test 1: Routes readings through TopicRouter
  // =========================================================================

  describe('routing', () => {
    it.effect(
      'routable readings appear in output, unroutable are dropped',
      () =>
        Effect.gen(function* () {
          const processor = yield* ReadingProcessor

          const source = Stream.fromIterable([
            makeReading('known/temp-01', 25.0),
            makeReading('unknown/pressure-01', 101.3),
            makeReading('known/temp-02', 30.0),
            makeReading('bad/topic', 0),
          ])

          const result = yield* processor
            .process(source)
            .pipe(Stream.runCollect)

          // Flatten all batches into a single array of RoutedReadings
          const allReadings = Chunk.toArray(result).flatMap(Chunk.toArray)

          // Only the 2 "known/" readings should pass through
          expect(allReadings).toHaveLength(2)
          expect(allReadings[0].deviceId).toBe('DEV-known/temp-01')
          expect(allReadings[0].reading.value).toBe(25.0)
          expect(allReadings[1].deviceId).toBe('DEV-known/temp-02')
          expect(allReadings[1].reading.value).toBe(30.0)
        }).pipe(Effect.provide(DefaultTestLayer))
    )

    it.effect('all readings dropped when none are routable', () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        const source = Stream.fromIterable([
          makeReading('unknown/a', 1),
          makeReading('bad/b', 2),
        ])

        const result = yield* processor
          .process(source)
          .pipe(Stream.runCollect)

        const allReadings = Chunk.toArray(result).flatMap(Chunk.toArray)
        expect(allReadings).toHaveLength(0)
      }).pipe(Effect.provide(DefaultTestLayer))
    )

    it.effect('empty stream produces empty output', () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        const source = Stream.fromIterable<IngestedReading>([])

        const result = yield* processor
          .process(source)
          .pipe(Stream.runCollect)

        expect(Chunk.toArray(result)).toHaveLength(0)
      }).pipe(Effect.provide(DefaultTestLayer))
    )
  })

  // =========================================================================
  // Test 2: Batching via groupedWithin
  // =========================================================================

  describe('batching', () => {
    it.effect('batch size respects config', () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        // Create 5 routable readings with batch size 2
        const source = Stream.fromIterable([
          makeReading('known/a', 1),
          makeReading('known/b', 2),
          makeReading('known/c', 3),
          makeReading('known/d', 4),
          makeReading('known/e', 5),
        ])

        const result = yield* processor
          .process(source)
          .pipe(Stream.runCollect)

        const batches = Chunk.toArray(result)
        // With batch size 2 and 5 items, we expect at least 2 batches
        // (the exact count depends on timing, but no batch should exceed size 2)
        const totalReadings = batches.reduce(
          (sum, batch) => sum + Chunk.size(batch),
          0
        )
        expect(totalReadings).toBe(5)

        // Each batch should not exceed the configured max batch size of 2
        for (const batch of batches) {
          expect(Chunk.size(batch)).toBeLessThanOrEqual(2)
        }
      }).pipe(
        Effect.provide(
          ReadingProcessorLive({ maxBatchSize: 2, maxBatchWindowMs: 60_000 }).pipe(
            Layer.provide(TestTopicRouter)
          )
        )
      )
    )
  })

  // =========================================================================
  // Test 3: Default config uses 100 batch size, 5000ms window
  // =========================================================================

  describe('default config', () => {
    it.effect(
      'default config batches up to 100 readings (small stream fits in one batch)',
      () =>
        Effect.gen(function* () {
          const processor = yield* ReadingProcessor

          // 10 readings < 100 max → should all land in a single batch
          const readings = Array.from({ length: 10 }, (_, i) =>
            makeReading(`known/sensor-${i}`, i * 10)
          )
          const source = Stream.fromIterable(readings)

          const result = yield* processor
            .process(source)
            .pipe(Stream.runCollect)

          const batches = Chunk.toArray(result)
          const totalReadings = batches.reduce(
            (sum, batch) => sum + Chunk.size(batch),
            0
          )
          expect(totalReadings).toBe(10)

          // With a finite stream of 10 items and max batch size 100,
          // all items should be in one batch when stream completes
          expect(batches).toHaveLength(1)
          expect(Chunk.size(batches[0])).toBe(10)
        }).pipe(Effect.provide(DefaultTestLayer))
    )
  })

  // =========================================================================
  // Test 4: Custom config overrides defaults
  // =========================================================================

  describe('custom config', () => {
    it.effect('custom batch size of 3 produces correctly-sized batches', () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        const readings = Array.from({ length: 9 }, (_, i) =>
          makeReading(`known/sensor-${i}`, i)
        )
        const source = Stream.fromIterable(readings)

        const result = yield* processor
          .process(source)
          .pipe(Stream.runCollect)

        const batches = Chunk.toArray(result)
        const totalReadings = batches.reduce(
          (sum, batch) => sum + Chunk.size(batch),
          0
        )
        expect(totalReadings).toBe(9)

        for (const batch of batches) {
          expect(Chunk.size(batch)).toBeLessThanOrEqual(3)
        }
      }).pipe(
        Effect.provide(
          ReadingProcessorLive({ maxBatchSize: 3, maxBatchWindowMs: 60_000 }).pipe(
            Layer.provide(TestTopicRouter)
          )
        )
      )
    )
  })

  // =========================================================================
  // Test 5: Tag identity
  // =========================================================================

  describe('Tag identity', () => {
    it('ReadingProcessor.key is tmnl/iiot/ReadingProcessor', () => {
      expect(ReadingProcessor.key).toBe('tmnl/iiot/ReadingProcessor')
    })
  })

  // =========================================================================
  // Test 6: BatchConfig schema roundtrip
  // =========================================================================

  describe('BatchConfig schema', () => {
    it('encode/decode roundtrip with full config', () => {
      const config = { maxBatchSize: 50, maxBatchWindowMs: 3000 }
      const decoded = Schema.decodeUnknownSync(BatchConfig)(config)
      const encoded = Schema.encodeSync(BatchConfig)(decoded)
      expect(encoded).toEqual(config)
    })

    it('encode/decode roundtrip with empty config (optional fields)', () => {
      const config = {}
      const decoded = Schema.decodeUnknownSync(BatchConfig)(config)
      const encoded = Schema.encodeSync(BatchConfig)(decoded)
      expect(encoded).toEqual(config)
    })

    it('rejects non-integer maxBatchSize', () => {
      expect(() =>
        Schema.decodeUnknownSync(BatchConfig)({ maxBatchSize: 2.5 })
      ).toThrow()
    })

    it('rejects non-positive maxBatchSize', () => {
      expect(() =>
        Schema.decodeUnknownSync(BatchConfig)({ maxBatchSize: 0 })
      ).toThrow()
      expect(() =>
        Schema.decodeUnknownSync(BatchConfig)({ maxBatchSize: -1 })
      ).toThrow()
    })

    it('rejects non-integer maxBatchWindowMs', () => {
      expect(() =>
        Schema.decodeUnknownSync(BatchConfig)({ maxBatchWindowMs: 1.5 })
      ).toThrow()
    })

    it('rejects non-positive maxBatchWindowMs', () => {
      expect(() =>
        Schema.decodeUnknownSync(BatchConfig)({ maxBatchWindowMs: 0 })
      ).toThrow()
    })
  })

  // =========================================================================
  // Test 7: RoutedReading carries both reading and deviceId
  // =========================================================================

  describe('RoutedReading shape', () => {
    it.effect('each RoutedReading has reading and deviceId', () =>
      Effect.gen(function* () {
        const processor = yield* ReadingProcessor

        const source = Stream.fromIterable([
          makeReading('known/motor-01', 42.5),
        ])

        const result = yield* processor
          .process(source)
          .pipe(Stream.runCollect)

        const batches = Chunk.toArray(result)
        expect(batches).toHaveLength(1)

        const first = Chunk.toArray(batches[0])[0]
        expect(first.reading).toBeDefined()
        expect(first.deviceId).toBeDefined()
        expect(first.reading.topic).toBe('known/motor-01')
        expect(first.reading.value).toBe(42.5)
        expect(first.deviceId).toBe('DEV-known/motor-01')
      }).pipe(Effect.provide(DefaultTestLayer))
    )
  })
})
