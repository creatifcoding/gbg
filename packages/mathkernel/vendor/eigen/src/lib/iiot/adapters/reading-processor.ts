/**
 * ReadingProcessor Service -- Batch Insert Pipeline
 *
 * Processes a stream of IngestedReading through:
 * 1. Topic routing via TopicRouter (drops unroutable readings)
 * 2. Micro-batching via Stream.groupedWithin
 *
 * The processor does NOT handle database insertion or alarm detection.
 * Those concerns are composed at the IngestionService level (task 19.3.3).
 * This module's responsibility is routing + batching only.
 *
 * @module @gbg/tmnl/iiot/adapters/reading-processor
 * @see Phase 5 Stream Architecture (Epic 19), Section 5
 */

import { Context, Effect, Stream, Duration, Chunk, Schema, Layer } from 'effect'
import { IngestedReading, IngestionError } from './ingestion'
import { TopicRouter } from './device-routing'

// =============================================================================
// BatchConfig -- configurable batch size and window
// =============================================================================

/**
 * Configuration for the reading micro-batcher.
 *
 * - maxBatchSize: Max readings per batch (default: 100)
 * - maxBatchWindowMs: Max time to wait before flushing (default: 5000ms)
 */
export const BatchConfig = Schema.Struct({
  maxBatchSize: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),
  maxBatchWindowMs: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive())
  ),
})
export type BatchConfig = Schema.Schema.Type<typeof BatchConfig>

// =============================================================================
// RoutedReading -- intermediate type after topic routing
// =============================================================================

/**
 * A reading that has been successfully routed to a DeviceId.
 *
 * Carries the original IngestedReading alongside the resolved DeviceId
 * so downstream consumers (batch inserter, alarm detector) have both.
 */
export interface RoutedReading {
  readonly reading: IngestedReading
  readonly deviceId: string
}

// =============================================================================
// ReadingProcessor Service Interface
// =============================================================================

/**
 * Shape of the ReadingProcessor service.
 *
 * The processor takes a stream of raw IngestedReading and returns a stream
 * of batched RoutedReading chunks. The caller is responsible for consuming
 * the batched stream (e.g., inserting into TimescaleDB).
 */
export interface ReadingProcessorShape {
  /**
   * Process a stream of ingested readings:
   * 1. Route topic -> DeviceId (drop unroutable)
   * 2. Batch with Stream.groupedWithin
   * 3. Return batched stream of Chunk<RoutedReading>
   */
  readonly process: (
    source: Stream.Stream<IngestedReading, IngestionError>
  ) => Stream.Stream<Chunk.Chunk<RoutedReading>, IngestionError>
}

/**
 * ReadingProcessor service tag.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const processor = yield* ReadingProcessor
 *   const batched = processor.process(adapterStream)
 *   // consume batched stream...
 * })
 * ```
 */
export class ReadingProcessor extends Context.Tag('tmnl/iiot/ReadingProcessor')<
  ReadingProcessor,
  ReadingProcessorShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Create the ReadingProcessor implementation.
 *
 * Requires TopicRouter in the environment for topic-to-DeviceId resolution.
 * Uses Stream.groupedWithin for micro-batching with configurable size/window.
 */
const makeReadingProcessor = (config: BatchConfig) =>
  Effect.gen(function* () {
    const router = yield* TopicRouter

    const process = (
      source: Stream.Stream<IngestedReading, IngestionError>
    ): Stream.Stream<Chunk.Chunk<RoutedReading>, IngestionError> =>
      source.pipe(
        // Route: topic -> DeviceId (drop unroutable readings)
        Stream.mapEffect((reading) =>
          Effect.gen(function* () {
            const deviceId = yield* router.resolve(reading.topic)
            if (deviceId === null) return null
            return { reading, deviceId } as RoutedReading
          })
        ),
        Stream.filter((r): r is RoutedReading => r !== null),

        // Batch: collect up to maxBatchSize OR flush every maxBatchWindowMs
        Stream.groupedWithin(
          config.maxBatchSize ?? 100,
          Duration.millis(config.maxBatchWindowMs ?? 5000)
        )
      )

    return ReadingProcessor.of({ process })
  })

// =============================================================================
// Live Layer Factory
// =============================================================================

/**
 * Create a ReadingProcessor layer with the given config.
 *
 * @param config - Optional BatchConfig. Defaults to { maxBatchSize: 100, maxBatchWindowMs: 5000 }
 * @returns Layer that provides ReadingProcessor, requiring TopicRouter
 */
export const ReadingProcessorLive = (
  config?: BatchConfig
): Layer.Layer<ReadingProcessor, never, TopicRouter> =>
  Layer.effect(ReadingProcessor, makeReadingProcessor(config ?? {}))
