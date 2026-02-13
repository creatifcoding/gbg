/**
 * MockAdapter for Testing
 *
 * Produces synthetic sensor readings for testing the ingestion pipeline
 * without external protocol dependencies. Readings are emitted as fast
 * as the consumer pulls them -- no internal rate limiting is applied.
 *
 * To rate-limit at the consumer level:
 * ```typescript
 * stream.pipe(Stream.schedule(Schedule.spaced(Duration.millis(100))))
 * ```
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const adapter = yield* IngestionAdapter
 *   const stream = yield* adapter.subscribe
 *   yield* stream.pipe(Stream.take(10), Stream.runCollect)
 * }).pipe(Effect.provide(MockAdapterLive()))
 * ```
 *
 * @module @gbg/tmnl/iiot/adapters/mock-adapter
 * @see Phase 5 Stream Architecture (Epic 19, Task 19.1.2)
 */

import {
  DateTime,
  Effect,
  Layer,
  Random,
  Schema,
  Stream,
} from 'effect'
import { IngestionAdapter, IngestedReading, type IngestionHealth } from './ingestion'

// =============================================================================
// MockAdapterConfig
// =============================================================================

/**
 * Configuration schema for the MockAdapter.
 *
 * All fields are optional -- sensible defaults are provided.
 */
export const MockAdapterConfig = Schema.Struct({
  /** Readings per second (default: 10) */
  ratePerSecond: Schema.optional(Schema.Number),
  /** Device topic patterns to simulate (default: 5 devices) */
  deviceTopics: Schema.optional(Schema.Array(Schema.String)),
  /** Minimum value in range (default: 0) */
  valueMin: Schema.optional(Schema.Number),
  /** Maximum value in range (default: 100) */
  valueMax: Schema.optional(Schema.Number),
  /** Probability of 'uncertain' quality (default: 0.05) */
  uncertainRate: Schema.optional(Schema.Number),
  /** Probability of 'bad' quality (default: 0.01) */
  badRate: Schema.optional(Schema.Number),
})
export type MockAdapterConfig = Schema.Schema.Type<typeof MockAdapterConfig>

// =============================================================================
// Defaults
// =============================================================================

const defaultConfig = {
  ratePerSecond: 10,
  deviceTopics: [
    'mock/plant-a/line-1/machine-1/temp',
    'mock/plant-a/line-1/machine-1/pressure',
    'mock/plant-a/line-1/machine-2/temp',
    'mock/plant-a/line-2/machine-1/vibration',
    'mock/plant-a/line-2/machine-2/flow',
  ],
  valueMin: 0,
  valueMax: 100,
  uncertainRate: 0.05,
  badRate: 0.01,
} as const satisfies Required<MockAdapterConfig>

// =============================================================================
// MockAdapterLive Layer Factory
// =============================================================================

/**
 * Create a MockAdapter Layer that produces synthetic sensor readings.
 *
 * The adapter emits `IngestedReading` instances as fast as the consumer
 * pulls, picking random topics from the configured device list and random
 * values within the configured range. Apply `Stream.schedule` downstream
 * if rate limiting is needed.
 *
 * Quality distribution follows configurable probabilities:
 * - `badRate` chance of 'bad'
 * - `uncertainRate` chance of 'uncertain'
 * - remaining probability is 'good'
 *
 * @param config - Optional configuration overrides
 * @returns Layer that provides the IngestionAdapter service
 */
export const MockAdapterLive = (
  config?: MockAdapterConfig,
): Layer.Layer<IngestionAdapter> => {
  // ratePerSecond is preserved in config for downstream consumers who
  // want to apply Schedule.spaced(Duration.millis(1000 / ratePerSecond))
  const deviceTopics = config?.deviceTopics ?? defaultConfig.deviceTopics
  const valueMin = config?.valueMin ?? defaultConfig.valueMin
  const valueMax = config?.valueMax ?? defaultConfig.valueMax
  const uncertainRate = config?.uncertainRate ?? defaultConfig.uncertainRate
  const badRate = config?.badRate ?? defaultConfig.badRate

  const valueRange = valueMax - valueMin

  /** Generate a single synthetic reading */
  const generateReading = Effect.gen(function* () {
    // Pick a random device topic
    const topicIndex = yield* Random.nextIntBetween(0, deviceTopics.length)
    const topic = deviceTopics[topicIndex]!

    // Generate a random value in [valueMin, valueMax]
    const rawRandom = yield* Random.next
    const value = valueMin + rawRandom * valueRange

    // Determine quality based on random roll vs uncertainRate/badRate
    const qualityRoll = yield* Random.next
    let sourceQuality: string
    if (qualityRoll < badRate) {
      sourceQuality = 'bad'
    } else if (qualityRoll < badRate + uncertainRate) {
      sourceQuality = 'uncertain'
    } else {
      sourceQuality = 'good'
    }

    return new IngestedReading({
      topic,
      value,
      sourceTimestamp: DateTime.unsafeNow(),
      sourceQuality,
    })
  })

  return Layer.succeed(IngestionAdapter, {
    protocol: 'mock',

    subscribe: Effect.succeed(
      Stream.repeatEffect(generateReading),
    ),

    healthCheck: Effect.succeed({
      protocol: 'mock',
      connected: true,
      errorCount: 0,
    } satisfies IngestionHealth),
  })
}
