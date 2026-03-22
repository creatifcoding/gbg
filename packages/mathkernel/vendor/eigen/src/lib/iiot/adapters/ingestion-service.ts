/**
 * IngestionService Orchestrator
 *
 * Composes all 6 adapter pipeline modules into a single runnable pipeline:
 *
 * ```
 * IngestionAdapter.subscribe → Stream<IngestedReading>
 *   → ReadingProcessor.process (route via TopicRouter + batch via groupedWithin)
 *     → Stream<Chunk<RoutedReading>>
 *       → AlarmDetector.checkReading (per reading in each batch)
 *         → Stream<ProcessedBatch> { readings, violations }
 * ```
 *
 * Each ProcessedBatch contains:
 * - readings: Chunk of routed readings (ready for persistence)
 * - violations: Array of threshold violations detected in this batch
 *
 * Quality mapping (OPC-UA/Sparkplug/Modbus → OpcUaQuality) is applied at
 * persistence time, not during stream processing, since it's a metadata
 * enrichment concern rather than a routing/batching concern.
 *
 * @module @gbg/tmnl/iiot/adapters/ingestion-service
 * @see Phase 5 Stream Architecture (Epic 19, Task 19.3.3)
 */

import { Context, Effect, Layer, Stream, Chunk } from 'effect'
import {
  IngestionAdapter,
  type IngestionError,
  type IngestionHealth,
} from './ingestion'
import { ReadingProcessor, type RoutedReading } from './reading-processor'
import {
  AlarmDetector,
  type ThresholdViolation,
  type SensorThresholds,
} from './alarm-detection'
import { TopicRouter, type TopicRoute } from './device-routing'
import { MockAdapterLive, type MockAdapterConfig } from './mock-adapter'
import { ReadingProcessorLive, type BatchConfig } from './reading-processor'
import { TopicRouterLive } from './device-routing'
import { AlarmDetectorLive } from './alarm-detection'
import {
  SparkplugAdapterLive,
  type SparkplugAdapterConfig,
} from './sparkplug-adapter'

// =============================================================================
// ProcessedBatch — output of each pipeline batch
// =============================================================================

/**
 * Output of a single pipeline batch.
 *
 * Contains both the routed readings (for persistence) and any threshold
 * violations detected in this batch (for alarm entity creation).
 */
export interface ProcessedBatch {
  /** Routed readings in this batch (ready for TimescaleDB insertion) */
  readonly readings: Chunk.Chunk<RoutedReading>
  /** Threshold violations detected in this batch (empty if no alarms) */
  readonly violations: ReadonlyArray<ThresholdViolation>
}

// =============================================================================
// IngestionService — service interface
// =============================================================================

/**
 * Shape of the IngestionService.
 *
 * The orchestrator composes the full pipeline and exposes:
 * - pipeline: a stream of ProcessedBatch (batched readings + violations)
 * - healthCheck: delegates to the underlying IngestionAdapter
 * - protocol: name of the underlying protocol adapter
 */
export interface IngestionServiceShape {
  /**
   * Start the full ingestion pipeline.
   *
   * Returns a stream that emits ProcessedBatch on each batch cycle.
   * Batch size and window are controlled by ReadingProcessor config.
   *
   * The stream is lazy — subscribe to start receiving batches.
   */
  readonly pipeline: Effect.Effect<
    Stream.Stream<ProcessedBatch, IngestionError>,
    IngestionError
  >

  /** Health check — delegates to the underlying adapter */
  readonly healthCheck: Effect.Effect<IngestionHealth, IngestionError>

  /** Protocol name from the underlying adapter */
  readonly protocol: string
}

/**
 * IngestionService — the full pipeline orchestrator.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const service = yield* IngestionService
 *   const stream = yield* service.pipeline
 *   yield* stream.pipe(
 *     Stream.take(10),
 *     Stream.runForEach((batch) =>
 *       Effect.log(`Batch: ${Chunk.size(batch.readings)} readings, ${batch.violations.length} violations`)
 *     ),
 *   )
 * })
 * ```
 */
export class IngestionService extends Context.Tag('tmnl/iiot/IngestionService')<
  IngestionService,
  IngestionServiceShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeIngestionService = Effect.gen(function* () {
  const adapter = yield* IngestionAdapter
  const processor = yield* ReadingProcessor
  const detector = yield* AlarmDetector

  const pipeline: IngestionServiceShape['pipeline'] = Effect.gen(function* () {
    // Step 1: Subscribe to the adapter — get raw reading stream
    const rawStream = yield* adapter.subscribe

    // Step 2: Route + batch via ReadingProcessor
    const batchedStream = processor.process(rawStream)

    // Step 3: For each batch, run alarm detection on every reading
    return batchedStream.pipe(
      Stream.mapEffect((batch) =>
        Effect.gen(function* () {
          // Check each routed reading against registered thresholds
          const results = yield* Effect.forEach(
            Chunk.toReadonlyArray(batch),
            (routed) =>
              detector.checkReading(
                routed.deviceId,
                routed.reading.value,
                routed.reading.sourceTimestamp,
              ),
          )

          // Collect non-null violations
          const violations = results.filter(
            (v): v is ThresholdViolation => v !== null,
          )

          return { readings: batch, violations } satisfies ProcessedBatch
        }),
      ),
    )
  })

  return IngestionService.of({
    pipeline,
    healthCheck: adapter.healthCheck,
    protocol: adapter.protocol,
  })
})

// =============================================================================
// Live Layer
// =============================================================================

/**
 * IngestionService live layer.
 *
 * Requires:
 * - IngestionAdapter (protocol adapter — MockAdapter, SparkplugAdapter, etc.)
 * - ReadingProcessor (routing + batching)
 * - AlarmDetector (threshold detection)
 *
 * Note: ReadingProcessor itself requires TopicRouter, so the full dependency
 * chain is: IngestionAdapter + TopicRouter + ReadingProcessor + AlarmDetector.
 */
export const IngestionServiceLive: Layer.Layer<
  IngestionService,
  never,
  IngestionAdapter | ReadingProcessor | AlarmDetector
> = Layer.effect(IngestionService, makeIngestionService)

// =============================================================================
// Pipeline Setup Helper
// =============================================================================

/**
 * Register routes and thresholds before starting the pipeline.
 *
 * Call this after building the Layer but before consuming the pipeline stream.
 * Routes are registered in TopicRouter, thresholds in AlarmDetector.
 *
 * @param config.routes - Topic routes for device routing
 * @param config.thresholds - Sensor thresholds for alarm detection
 */
export const setupPipeline = (config: {
  readonly routes: ReadonlyArray<TopicRoute>
  readonly thresholds: ReadonlyArray<SensorThresholds>
}): Effect.Effect<void, never, TopicRouter | AlarmDetector> =>
  Effect.gen(function* () {
    const router = yield* TopicRouter
    const detector = yield* AlarmDetector
    yield* router.registerBatch(config.routes)
    yield* Effect.forEach(
      config.thresholds,
      (t) => detector.registerThresholds(t),
      { discard: true },
    )
  })

// =============================================================================
// Dev/Test Convenience Layer
// =============================================================================

/**
 * Complete pipeline layer for dev/test environments.
 *
 * Wires MockAdapter + TopicRouter + ReadingProcessor + AlarmDetector + IngestionService
 * into a single Layer. No external dependencies required.
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   yield* setupPipeline({
 *     routes: [{ topicPattern: 'mock/plant-a/*', deviceId: 'DEV-001' }],
 *     thresholds: [{ deviceId: 'DEV-001', thresholdHigh: 80 }],
 *   })
 *   const service = yield* IngestionService
 *   const stream = yield* service.pipeline
 *   yield* stream.pipe(Stream.take(5), Stream.runCollect)
 * }).pipe(Effect.provide(IngestionPipelineDevLayer()))
 * ```
 *
 * @param config.adapter - MockAdapter config (optional)
 * @param config.batch - BatchConfig for ReadingProcessor (optional)
 */
export const IngestionPipelineDevLayer = (config?: {
  readonly adapter?: MockAdapterConfig
  readonly batch?: BatchConfig
}): Layer.Layer<
  IngestionService | IngestionAdapter | ReadingProcessor | AlarmDetector | TopicRouter
> => {
  const topicRouterLayer = TopicRouterLive
  const alarmDetectorLayer = AlarmDetectorLive
  const readingProcessorLayer = ReadingProcessorLive(config?.batch).pipe(
    Layer.provide(topicRouterLayer),
  )
  const adapterLayer = MockAdapterLive(config?.adapter)
  const serviceLayer = IngestionServiceLive.pipe(
    Layer.provide(readingProcessorLayer),
    Layer.provide(alarmDetectorLayer),
    Layer.provide(adapterLayer),
  )

  return Layer.mergeAll(
    serviceLayer,
    adapterLayer,
    readingProcessorLayer,
    alarmDetectorLayer,
    topicRouterLayer,
  )
}

// =============================================================================
// Sparkplug Pipeline Layer
// =============================================================================

/**
 * Complete pipeline layer using the SparkplugAdapter.
 *
 * Wires SparkplugAdapter + TopicRouter + ReadingProcessor + AlarmDetector + IngestionService
 * into a single Layer. Requires a valid SparkplugAdapterConfig (broker URL, group IDs).
 *
 * Usage:
 * ```typescript
 * const program = Effect.gen(function* () {
 *   yield* setupPipeline({
 *     routes: [{ topicPattern: 'spBv1.0/acme/DDATA/node-1/device-1/temp', deviceId: 'SPK-001' }],
 *     thresholds: [{ deviceId: 'SPK-001', thresholdHigh: 85 }],
 *   })
 *   const service = yield* IngestionService
 *   const stream = yield* service.pipeline
 *   yield* stream.pipe(Stream.take(10), Stream.runCollect)
 * }).pipe(Effect.provide(SparkplugPipelineLayer({ sparkplug: config })))
 * ```
 *
 * @param config.sparkplug - SparkplugAdapterConfig (broker URL, group IDs, auth)
 * @param config.batch - BatchConfig for ReadingProcessor (optional)
 */
export const SparkplugPipelineLayer = (config: {
  readonly sparkplug: SparkplugAdapterConfig
  readonly batch?: BatchConfig
}): Layer.Layer<
  IngestionService | IngestionAdapter | ReadingProcessor | AlarmDetector | TopicRouter
> => {
  const topicRouterLayer = TopicRouterLive
  const alarmDetectorLayer = AlarmDetectorLive
  const readingProcessorLayer = ReadingProcessorLive(config.batch).pipe(
    Layer.provide(topicRouterLayer),
  )
  const adapterLayer = SparkplugAdapterLive(config.sparkplug)
  const serviceLayer = IngestionServiceLive.pipe(
    Layer.provide(readingProcessorLayer),
    Layer.provide(alarmDetectorLayer),
    Layer.provide(adapterLayer),
  )

  return Layer.mergeAll(
    serviceLayer,
    adapterLayer,
    readingProcessorLayer,
    alarmDetectorLayer,
    topicRouterLayer,
  )
}
