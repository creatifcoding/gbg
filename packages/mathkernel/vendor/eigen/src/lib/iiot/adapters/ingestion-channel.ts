import { Effect, Schema, Scope, type Queue } from 'effect'
import {
  ChannelId,
  InletId,
  OutletId,
  type ChannelServiceError,
  ChannelService,
  type ChannelBuilderError,
  ChannelBuilder,
} from '@/lib/streams/constructs'
import {
  IngestionService,
  type IngestionError,
  type ProcessedBatch,
} from './ingestion-service'

export const IngestionChannelConfig = Schema.Struct({
  channelId: Schema.optional(ChannelId),
  inletLocalId: Schema.optional(Schema.NonEmptyString),
  outletLocalId: Schema.optional(Schema.NonEmptyString),
  broadcast: Schema.optional(Schema.Boolean),
})
export type IngestionChannelConfig = typeof IngestionChannelConfig.Type

export const IngestionChannelBinding = Schema.Struct({
  channelId: ChannelId,
  inletId: InletId,
  outletId: OutletId,
})
export type IngestionChannelBinding = typeof IngestionChannelBinding.Type

const DEFAULT_CONFIG = {
  channelId: 'iiot-ingestion-channel' as ChannelId,
  inletLocalId: 'pipeline',
  outletLocalId: 'processed',
  broadcast: true,
} as const

const resolveConfig = (
  config?: IngestionChannelConfig,
): {
  readonly channelId: ChannelId
  readonly inletLocalId: string
  readonly outletLocalId: string
  readonly broadcast: boolean
} => ({
  channelId: config?.channelId ?? DEFAULT_CONFIG.channelId,
  inletLocalId: config?.inletLocalId ?? DEFAULT_CONFIG.inletLocalId,
  outletLocalId: config?.outletLocalId ?? DEFAULT_CONFIG.outletLocalId,
  broadcast: config?.broadcast ?? DEFAULT_CONFIG.broadcast,
})

/**
 * Registers + opens the canonical IIoT ingestion channel topology.
 */
export const createIngestionChannel = (
  config?: IngestionChannelConfig,
): Effect.Effect<IngestionChannelBinding, ChannelBuilderError | ChannelServiceError, ChannelService> =>
  Effect.gen(function* () {
    const channel = yield* ChannelService
    const resolved = resolveConfig(config)

    const builder = ChannelBuilder.create(resolved.channelId as string)
      .inlet(resolved.inletLocalId, {
        schema: Schema.Struct({
          readings: Schema.Unknown,
          violations: Schema.Array(Schema.Unknown),
        }),
      })
      .outlet(resolved.outletLocalId, { broadcast: resolved.broadcast })
      .wire(resolved.inletLocalId, resolved.outletLocalId)

    const channelId = yield* channel.register(builder)
    yield* channel.open(channelId)

    return {
      channelId,
      inletId: `${channelId}:inlet:${resolved.inletLocalId}` as InletId,
      outletId: `${channelId}:outlet:${resolved.outletLocalId}` as OutletId,
    }
  })

/**
 * Subscribes to the ingestion outlet and attaches IngestionService.pipeline to the inlet.
 */
export const attachIngestionPipeline = (
  binding: IngestionChannelBinding,
  options?: { readonly subscriberId?: string },
): Effect.Effect<
  Queue.Dequeue<ProcessedBatch>,
  IngestionError | ChannelServiceError,
  IngestionService | ChannelService | Scope.Scope
> =>
  Effect.gen(function* () {
    const ingestion = yield* IngestionService
    const channel = yield* ChannelService
    const pipeline = yield* ingestion.pipeline

    const queue = yield* channel.subscribeOutlet<ProcessedBatch>(
      binding.channelId,
      binding.outletId,
      options?.subscriberId,
    )

    yield* channel.connectStream(binding.channelId, binding.inletId, pipeline)

    return queue
  })
