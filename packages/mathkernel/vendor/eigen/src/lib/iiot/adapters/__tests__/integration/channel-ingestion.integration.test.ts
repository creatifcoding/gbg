import { describe, it, expect } from 'vitest'
import { Chunk, DateTime, Effect, Layer, Queue, Stream } from 'effect'
import {
  IngestionService,
  IngestionServiceLive,
  setupPipeline,
} from '../../ingestion-service'
import {
  attachIngestionPipeline,
  createIngestionChannel,
} from '../../ingestion-channel'
import {
  IngestionAdapter,
  IngestedReading,
  type IngestionHealth,
} from '../../ingestion'
import { TopicRouter, TopicRouterLive, type TopicRoute } from '../../device-routing'
import { ReadingProcessorLive, type BatchConfig } from '../../reading-processor'
import {
  AlarmDetector,
  AlarmDetectorLive,
  type SensorThresholds,
} from '../../alarm-detection'
import {
  ChannelService,
  ChannelServiceLive,
} from '@/lib/streams/constructs/ChannelService'

const reading = (topic: string, value: number): IngestedReading =>
  new IngestedReading({
    topic,
    value,
    sourceTimestamp: DateTime.unsafeNow(),
  })

const DeterministicAdapter = (readings: ReadonlyArray<IngestedReading>) =>
  Layer.succeed(IngestionAdapter, {
    protocol: 'deterministic-test',
    subscribe: Effect.succeed(Stream.fromIterable(readings)),
    healthCheck: Effect.succeed({
      protocol: 'deterministic-test',
      connected: true,
      errorCount: 0,
    } satisfies IngestionHealth),
  })

const PipelineLayer = (config: {
  readings: ReadonlyArray<IngestedReading>
  routes: ReadonlyArray<TopicRoute>
  thresholds: ReadonlyArray<SensorThresholds>
  batch?: BatchConfig
}) => {
  const adapterLayer = DeterministicAdapter(config.readings)
  const topicRouterLayer = TopicRouterLive
  const readingProcessorLayer = ReadingProcessorLive(config.batch).pipe(
    Layer.provide(topicRouterLayer)
  )
  const alarmDetectorLayer = AlarmDetectorLive
  const ingestionLayer = IngestionServiceLive.pipe(
    Layer.provide(readingProcessorLayer),
    Layer.provide(alarmDetectorLayer),
    Layer.provide(adapterLayer)
  )

  return Layer.mergeAll(
    ingestionLayer,
    topicRouterLayer,
    readingProcessorLayer,
    alarmDetectorLayer,
    adapterLayer,
    ChannelServiceLive
  )
}

const runWithLayer = <A>(
  config: {
    readings: ReadonlyArray<IngestedReading>
    routes: ReadonlyArray<TopicRoute>
    thresholds: ReadonlyArray<SensorThresholds>
    batch?: BatchConfig
  },
  program: Effect.Effect<
    A,
    never,
    IngestionService | TopicRouter | AlarmDetector | ChannelService
  >
) =>
  Effect.gen(function* () {
    yield* setupPipeline({ routes: config.routes, thresholds: config.thresholds })
    return yield* program
  }).pipe(Effect.provide(PipelineLayer(config)), Effect.runPromise)

describe('Channel + IIoT ingestion integration', () => {
  it('routes ProcessedBatch stream through Channel outlet with typed payload', () =>
    runWithLayer(
      {
        readings: [
          reading('plant/line-1/temp', 81),
          reading('plant/line-1/temp', 70),
          reading('plant/line-1/pressure', 155),
        ],
        routes: [
          { topicPattern: 'plant/line-1/temp', deviceId: 'DEV-TEMP' },
          { topicPattern: 'plant/line-1/pressure', deviceId: 'DEV-PRESS' },
        ],
        thresholds: [
          { deviceId: 'DEV-TEMP', thresholdHigh: 80 },
          { deviceId: 'DEV-PRESS', thresholdHigh: 150 },
        ],
        batch: { maxBatchSize: 50, maxBatchWindowMs: 100 },
      },
      Effect.gen(function* () {
        const channel = yield* ChannelService

        const binding = yield* createIngestionChannel()
        const queue = yield* attachIngestionPipeline(binding)

        const batch = yield* Queue.take(queue)
        expect(Chunk.size(batch.readings)).toBe(3)
        expect(batch.violations.length).toBe(2)

        const metrics = yield* channel.getMetrics(binding.channelId)
        expect(metrics._tag).toBe('Some')
        if (metrics._tag === 'Some') {
          expect(metrics.value.messagesIn).toBe(1)
          expect(metrics.value.messagesOut).toBe(1)
          expect(metrics.value.errors).toBe(0)
        }
      }).pipe(Effect.scoped)
    ))
})
