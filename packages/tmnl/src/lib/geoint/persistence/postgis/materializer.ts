/**
 * PostGIS Materializer - Event Stream to PostGIS Bridge
 *
 * Subscribes to DurableStreams containing track/feature events and
 * materializes them into PostGIS for spatial queries.
 *
 * Architecture:
 * - DurableStreams: Event sourcing, replay, sync (primary source of truth)
 * - PostGIS: Spatial indexing for geographic queries (derived view)
 *
 * The materializer:
 * 1. Connects to event streams via DurableStreamClient
 * 2. Applies events to PostGIS repositories
 * 3. Tracks offsets for resumption after restart
 *
 * @see beads:tmnl-fb8kt GEOINT Layering System Epic
 * @module
 */

import { Context, Effect, Layer, Stream, Schedule, pipe, Scope, Fiber, Option } from 'effect'
import { Schema } from 'effect'
import type { DurableStreamClient, EffectStreamHandle, DurableStreamError } from '../../../durable-streams/service'
import { DurableStreamClient as DurableStreamClientTag } from '../../../durable-streams/service'
import type { TrackPositionRepository, FeatureRepository, InsertTrackPositionInput, InsertFeatureInput } from './repositories'
import { TrackPositionRepositoryTag, FeatureRepositoryTag, RepositoryError } from './repositories'
import type { TrackId, FeatureId, IntelSource, Position } from '../../schemas'
import { Classification } from '../../schemas'
import type { FeatureGeometry } from './schemas'

// =============================================================================
// Event Schemas - Events stored in DurableStreams
// =============================================================================

/**
 * Track position update event
 */
export const TrackPositionEvent = Schema.Struct({
  _tag: Schema.Literal('TrackPositionEvent'),
  trackId: Schema.String,
  longitude: Schema.Number,
  latitude: Schema.Number,
  altitude: Schema.optionalWith(Schema.Number, { nullable: true }),
  heading: Schema.optionalWith(Schema.Number, { nullable: true }),
  speed: Schema.optionalWith(Schema.Number, { nullable: true }),
  classification: Schema.optionalWith(Schema.String, { nullable: true }),
  source: Schema.optionalWith(Schema.String, { nullable: true }),
  timestamp: Schema.DateFromString,
})
export type TrackPositionEvent = typeof TrackPositionEvent.Type

/**
 * Feature upsert event
 */
export const FeatureUpsertEvent = Schema.Struct({
  _tag: Schema.Literal('FeatureUpsertEvent'),
  featureId: Schema.String,
  name: Schema.optionalWith(Schema.String, { nullable: true }),
  featureType: Schema.optionalWith(Schema.String, { nullable: true }),
  layer: Schema.optionalWith(Schema.String, { nullable: true }),
  source: Schema.optionalWith(Schema.String, { nullable: true }),
  properties: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { nullable: true }),
  // GeoJSON geometry
  geometry: Schema.optionalWith(Schema.Unknown, { nullable: true }),
})
export type FeatureUpsertEvent = typeof FeatureUpsertEvent.Type

/**
 * Feature delete event
 */
export const FeatureDeleteEvent = Schema.Struct({
  _tag: Schema.Literal('FeatureDeleteEvent'),
  featureId: Schema.String,
})
export type FeatureDeleteEvent = typeof FeatureDeleteEvent.Type

/**
 * Union of all materializable events
 */
export const MaterializableEvent = Schema.Union(
  TrackPositionEvent,
  FeatureUpsertEvent,
  FeatureDeleteEvent
)
export type MaterializableEvent = typeof MaterializableEvent.Type

// =============================================================================
// Materializer Configuration
// =============================================================================

/**
 * Configuration for stream materialization
 */
export interface MaterializerStreamConfig {
  /** DurableStream URL */
  url: string
  /** Stream name for logging */
  name: string
  /** Starting offset (default: '-1' for beginning) */
  startOffset?: string
  /** Batch size for database writes */
  batchSize?: number
}

/**
 * Full materializer configuration
 */
export interface MaterializerConfig {
  /** Track position events stream */
  trackPositionsStream?: MaterializerStreamConfig
  /** Feature events stream */
  featuresStream?: MaterializerStreamConfig
  /** Checkpoint stream URL (for storing offsets) */
  checkpointStreamUrl?: string
  /** Error retry schedule */
  retrySchedule?: Schedule.Schedule<number, unknown>
}

export class MaterializerConfigTag extends Context.Tag('tmnl/geoint/MaterializerConfig')<
  MaterializerConfigTag,
  MaterializerConfig
>() {}

// =============================================================================
// Materializer Errors
// =============================================================================

export class MaterializerError extends Error {
  readonly _tag = 'MaterializerError'
  constructor(
    readonly operation: string,
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'MaterializerError'
  }
}

// =============================================================================
// Checkpoint Management
// =============================================================================

/**
 * Checkpoint schema for offset tracking
 */
const Checkpoint = Schema.Struct({
  streamName: Schema.String,
  offset: Schema.String,
  updatedAt: Schema.DateFromString,
})
type Checkpoint = typeof Checkpoint.Type

// =============================================================================
// Materializer Service Interface
// =============================================================================

export interface PostGISMaterializerShape {
  /**
   * Start materializing track position events to PostGIS
   */
  readonly materializeTrackPositions: (
    config: MaterializerStreamConfig
  ) => Effect.Effect<Fiber.RuntimeFiber<void, MaterializerError | DurableStreamError | RepositoryError>, MaterializerError | DurableStreamError, Scope.Scope>

  /**
   * Start materializing feature events to PostGIS
   */
  readonly materializeFeatures: (
    config: MaterializerStreamConfig
  ) => Effect.Effect<Fiber.RuntimeFiber<void, MaterializerError | DurableStreamError | RepositoryError>, MaterializerError | DurableStreamError, Scope.Scope>

  /**
   * Start all configured materializers
   */
  readonly startAll: () => Effect.Effect<void, MaterializerError | DurableStreamError, Scope.Scope>

  /**
   * Process a single track position event
   */
  readonly processTrackEvent: (
    event: TrackPositionEvent
  ) => Effect.Effect<void, RepositoryError>

  /**
   * Process a single feature event
   */
  readonly processFeatureEvent: (
    event: FeatureUpsertEvent | FeatureDeleteEvent
  ) => Effect.Effect<void, RepositoryError | MaterializerError>
}

// =============================================================================
// Service Tag
// =============================================================================

export class PostGISMaterializer extends Context.Tag('tmnl/geoint/PostGISMaterializer')<
  PostGISMaterializer,
  PostGISMaterializerShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

export const PostGISMaterializerLive = Layer.effect(
  PostGISMaterializer,
  Effect.gen(function* () {
    const dsClient = yield* DurableStreamClientTag
    const trackRepo = yield* TrackPositionRepositoryTag
    const featureRepo = yield* FeatureRepositoryTag
    const configOption = yield* Effect.serviceOption(MaterializerConfigTag)
    const config = Option.getOrElse(configOption, () => ({} as MaterializerConfig))

    // Helper: Convert event to repository input
    const eventToTrackInput = (event: TrackPositionEvent): InsertTrackPositionInput => ({
      trackId: event.trackId as TrackId,
      longitude: event.longitude,
      latitude: event.latitude,
      altitude: event.altitude ?? undefined,
      heading: event.heading ?? undefined,
      speed: event.speed ?? undefined,
      classification: (event.classification as typeof Classification.Type) ?? undefined,
      source: (event.source as IntelSource) ?? undefined,
      timestamp: event.timestamp,
    })

    const eventToFeatureInput = (event: FeatureUpsertEvent): InsertFeatureInput | null => {
      // Geometry is required for feature insertion
      if (!event.geometry) return null
      return {
        featureId: event.featureId as FeatureId,
        name: event.name ?? undefined,
        featureType: event.featureType ?? undefined,
        layer: event.layer ?? undefined,
        source: (event.source as IntelSource) ?? undefined,
        properties: event.properties ?? undefined,
        // geometry is validated by the repository - FeatureGeometry type
        geometry: event.geometry as FeatureGeometry,
      }
    }

    // Process single track event
    const processTrackEvent = (event: TrackPositionEvent) =>
      trackRepo.insert(eventToTrackInput(event)).pipe(Effect.asVoid)

    // Process single feature event
    const processFeatureEvent = (event: FeatureUpsertEvent | FeatureDeleteEvent): Effect.Effect<void, RepositoryError | MaterializerError> => {
      switch (event._tag) {
        case 'FeatureUpsertEvent': {
          const input = eventToFeatureInput(event)
          if (!input) {
            // Skip features without geometry
            return Effect.logWarning(`Skipping feature ${event.featureId}: missing geometry`).pipe(Effect.asVoid)
          }
          return featureRepo.upsert(input).pipe(Effect.asVoid)
        }
        case 'FeatureDeleteEvent':
          return featureRepo.delete(event.featureId as FeatureId).pipe(Effect.asVoid)
      }
    }

    // Materialize track positions from stream
    const materializeTrackPositions = (streamConfig: MaterializerStreamConfig) =>
      Effect.gen(function* () {
        const handle = yield* dsClient.connect<TrackPositionEvent>({
          url: streamConfig.url,
        })

        // Subscribe and process events
        const stream = yield* handle.subscribe({
          offset: streamConfig.startOffset ?? '-1',
          live: 'auto',
          json: true,
        })

        // Fork the materialization fiber
        const fiber = yield* pipe(
          stream,
          Stream.mapEffect((batch) =>
            Effect.gen(function* () {
              // Process each event in the batch
              for (const event of batch.items) {
                // Validate event schema
                const parsed = yield* Schema.decodeUnknown(TrackPositionEvent)(event).pipe(
                  Effect.mapError((e) => new MaterializerError('parse', `Invalid event: ${e}`, e))
                )
                yield* processTrackEvent(parsed).pipe(
                  Effect.mapError((e) => e as MaterializerError | DurableStreamError | RepositoryError)
                )
              }
              console.log(`[PostGISMaterializer] Processed ${batch.items.length} track events, offset: ${batch.offset}`)
            })
          ),
          Stream.runDrain,
          Effect.retry({ schedule: config.retrySchedule ?? Schedule.exponential('1 second', 2).pipe(Schedule.jittered) }),
          Effect.forkScoped
        )

        return fiber
      })

    // Materialize features from stream
    const materializeFeatures = (streamConfig: MaterializerStreamConfig) =>
      Effect.gen(function* () {
        const handle = yield* dsClient.connect<FeatureUpsertEvent | FeatureDeleteEvent>({
          url: streamConfig.url,
        })

        const stream = yield* handle.subscribe({
          offset: streamConfig.startOffset ?? '-1',
          live: 'auto',
          json: true,
        })

        const fiber = yield* pipe(
          stream,
          Stream.mapEffect((batch) =>
            Effect.gen(function* () {
              for (const event of batch.items) {
                const parsed = yield* Schema.decodeUnknown(Schema.Union(FeatureUpsertEvent, FeatureDeleteEvent))(event).pipe(
                  Effect.mapError((e) => new MaterializerError('parse', `Invalid event: ${e}`, e))
                )
                yield* processFeatureEvent(parsed).pipe(
                  Effect.mapError((e) => e as MaterializerError | DurableStreamError | RepositoryError)
                )
              }
              console.log(`[PostGISMaterializer] Processed ${batch.items.length} feature events, offset: ${batch.offset}`)
            })
          ),
          Stream.runDrain,
          Effect.retry({ schedule: config.retrySchedule ?? Schedule.exponential('1 second', 2).pipe(Schedule.jittered) }),
          Effect.forkScoped
        )

        return fiber
      })

    // Start all configured materializers
    const startAll = () =>
      Effect.gen(function* () {
        if (config.trackPositionsStream) {
          yield* materializeTrackPositions(config.trackPositionsStream)
          console.log(`[PostGISMaterializer] Started track positions materializer: ${config.trackPositionsStream.name}`)
        }

        if (config.featuresStream) {
          yield* materializeFeatures(config.featuresStream)
          console.log(`[PostGISMaterializer] Started features materializer: ${config.featuresStream.name}`)
        }
      })

    return {
      materializeTrackPositions,
      materializeFeatures,
      startAll,
      processTrackEvent,
      processFeatureEvent,
    }
  })
)

// =============================================================================
// Configured Layer
// =============================================================================

export const PostGISMaterializerConfigured = (config: MaterializerConfig) =>
  Layer.provide(
    PostGISMaterializerLive,
    Layer.succeed(MaterializerConfigTag, config)
  )
