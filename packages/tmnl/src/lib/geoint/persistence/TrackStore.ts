/**
 * TrackStore - Durable Streams Persistence for GEOINT Tracks
 *
 * Persists track position history to durable streams with replay capability.
 * Supports offline operation and real-time streaming.
 *
 * @see .cursor/prd/features.md F007: Durable Persistence
 * @module
 */

import { Context, Data, Effect, Layer, Stream, Schedule, Duration, type Scope } from 'effect'
import {
  DurableStreamClient,
  DurableStreamClientLive,
  type EffectStreamHandle,
} from '@/lib/durable-streams/service'
import type { TrackId, TrackPosition, TrackPositionUpdate } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8787/streams/geoint/tracks'
const STREAM_TTL_DAYS = 30
const RETRY_SCHEDULE = Schedule.exponential(Duration.millis(100)).pipe(
  Schedule.union(Schedule.spaced(Duration.seconds(5))),
  Schedule.compose(Schedule.recurs(5))
)

// =============================================================================
// Errors
// =============================================================================

export class TrackStoreError extends Data.TaggedError('TrackStoreError')<{
  readonly operation: 'append' | 'replay' | 'subscribe' | 'delete' | 'connect'
  readonly trackId?: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Track Update Event (for stream storage)
// =============================================================================

interface TrackUpdateEvent {
  readonly _tag: 'TrackUpdateEvent'
  readonly trackId: string
  readonly position: {
    lat: number
    lon: number
    timestamp: string
    heading: number
    speed: number
    altitude: number
  }
  readonly eventTimestamp: string
}

// =============================================================================
// Service Interface
// =============================================================================

export interface TrackStore {
  /**
   * Append a position update to a track's durable stream
   * Creates the stream if it doesn't exist
   */
  readonly appendTrackUpdate: (
    trackId: TrackId,
    position: TrackPosition
  ) => Effect.Effect<void, TrackStoreError>

  /**
   * Append multiple position updates (batch)
   */
  readonly appendTrackUpdates: (
    updates: readonly TrackPositionUpdate[]
  ) => Effect.Effect<void, TrackStoreError>

  /**
   * Replay full track history from durable stream
   * Returns all stored positions for a track
   */
  readonly replayTrack: (
    trackId: TrackId
  ) => Effect.Effect<readonly TrackUpdateEvent[], TrackStoreError>

  /**
   * Subscribe to live track position updates
   * Returns a scoped effect that provides a stream of position updates
   * The scope manages the underlying subscription lifecycle
   */
  readonly subscribeTrack: (
    trackId: TrackId
  ) => Effect.Effect<Stream.Stream<TrackUpdateEvent, TrackStoreError>, TrackStoreError, Scope.Scope>

  /**
   * Delete a track's durable stream
   */
  readonly deleteTrack: (trackId: TrackId) => Effect.Effect<void, TrackStoreError>

  /**
   * Check if a track stream exists
   */
  readonly trackExists: (trackId: TrackId) => Effect.Effect<boolean, TrackStoreError>

  /**
   * Get all track IDs with persisted data
   * (Note: requires external index - returns empty for now)
   */
  readonly listTracks: () => Effect.Effect<readonly TrackId[], TrackStoreError>
}

export const TrackStore = Context.GenericTag<TrackStore>('geoint/TrackStore')

// =============================================================================
// Configuration Tag
// =============================================================================

export interface TrackStoreConfig {
  readonly baseUrl: string
  readonly ttlDays: number
}

export class TrackStoreConfigTag extends Context.Tag('geoint/TrackStoreConfig')<
  TrackStoreConfigTag,
  TrackStoreConfig
>() {}

// =============================================================================
// Implementation
// =============================================================================

const make = Effect.gen(function* () {
  const streams = yield* DurableStreamClient

  // Get config or use defaults
  const configResult = yield* Effect.serviceOption(TrackStoreConfigTag)
  const config = configResult._tag === 'Some' ? configResult.value : {
    baseUrl: DEFAULT_BASE_URL,
    ttlDays: STREAM_TTL_DAYS,
  }

  // Cache for stream handles
  const handleCache = new Map<string, EffectStreamHandle<TrackUpdateEvent>>()

  /**
   * Get or create a stream handle for a track
   */
  const getHandle = (trackId: TrackId) =>
    Effect.gen(function* () {
      const cached = handleCache.get(trackId)
      if (cached) return cached

      const url = `${config.baseUrl}/${trackId}`
      const handle = yield* streams.getOrCreate<TrackUpdateEvent>({
        url,
        contentType: 'application/json',
        ttlSeconds: config.ttlDays * 24 * 60 * 60,
      }).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'connect',
            trackId,
            message: `Failed to connect to track stream: ${e.message}`,
            cause: e,
          })
        ),
        Effect.retry(RETRY_SCHEDULE)
      )

      handleCache.set(trackId, handle)
      return handle
    })

  /**
   * Convert TrackPosition to storage event
   */
  const toStorageEvent = (trackId: TrackId, position: TrackPosition): TrackUpdateEvent => ({
    _tag: 'TrackUpdateEvent',
    trackId,
    position: {
      lat: position.lat,
      lon: position.lon,
      timestamp: position.timestamp.toISOString(),
      heading: position.heading,
      speed: position.speed,
      altitude: position.altitude,
    },
    eventTimestamp: new Date().toISOString(),
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Service Methods
  // ─────────────────────────────────────────────────────────────────────────────

  const appendTrackUpdate = (trackId: TrackId, position: TrackPosition) =>
    Effect.gen(function* () {
      const handle = yield* getHandle(trackId)
      const event = toStorageEvent(trackId, position)

      yield* handle.append(event).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'append',
            trackId,
            message: `Failed to append track update: ${e.message}`,
            cause: e,
          })
        ),
        Effect.retry(RETRY_SCHEDULE)
      )
    })

  const appendTrackUpdates = (updates: readonly TrackPositionUpdate[]) =>
    Effect.gen(function* () {
      // Group by trackId for efficient batching
      const byTrack = new Map<TrackId, TrackPositionUpdate[]>()
      for (const update of updates) {
        const existing = byTrack.get(update.trackId) ?? []
        existing.push(update)
        byTrack.set(update.trackId, existing)
      }

      // Append to each track's stream
      yield* Effect.forEach(
        Array.from(byTrack.entries()),
        ([trackId, trackUpdates]) =>
          Effect.gen(function* () {
            const handle = yield* getHandle(trackId)
            const events = trackUpdates.map((u) => toStorageEvent(trackId, u.position))

            yield* handle.appendBatch(events).pipe(
              Effect.mapError((e) =>
                new TrackStoreError({
                  operation: 'append',
                  trackId,
                  message: `Failed to append batch updates: ${e.message}`,
                  cause: e,
                })
              )
            )
          }),
        { concurrency: 5 }
      )
    })

  const replayTrack = (trackId: TrackId) =>
    Effect.gen(function* () {
      const handle = yield* getHandle(trackId)

      const batch = yield* handle.read({ offset: '0', live: false }).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'replay',
            trackId,
            message: `Failed to replay track: ${e.message}`,
            cause: e,
          })
        )
      )

      return batch.items
    })

  const subscribeTrack = (trackId: TrackId) =>
    Effect.gen(function* () {
      const handle = yield* getHandle(trackId)

      const stream = yield* handle.subscribe({ offset: '-1', live: 'sse' }).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'subscribe',
            trackId,
            message: `Failed to subscribe to track: ${e.message}`,
            cause: e,
          })
        )
      )

      // Flatten batches into individual events
      return stream.pipe(
        Stream.mapConcat((batch) => batch.items),
        Stream.mapError((e) =>
          new TrackStoreError({
            operation: 'subscribe',
            trackId,
            message: `Stream error: ${e instanceof Error ? e.message : String(e)}`,
            cause: e,
          })
        )
      )
    })

  const deleteTrack = (trackId: TrackId) =>
    Effect.gen(function* () {
      const url = `${config.baseUrl}/${trackId}`

      yield* streams.delete(url).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'delete',
            trackId,
            message: `Failed to delete track: ${e.message}`,
            cause: e,
          })
        )
      )

      // Remove from cache
      handleCache.delete(trackId)
    })

  const trackExists = (trackId: TrackId) =>
    Effect.gen(function* () {
      const url = `${config.baseUrl}/${trackId}`

      return yield* streams.exists(url).pipe(
        Effect.mapError((e) =>
          new TrackStoreError({
            operation: 'connect',
            trackId,
            message: `Failed to check track existence: ${e.message}`,
            cause: e,
          })
        )
      )
    })

  const listTracks = () =>
    // Note: Durable streams don't have a list operation
    // This would require an external index (e.g., separate metadata stream)
    Effect.succeed([] as readonly TrackId[])

  return {
    appendTrackUpdate,
    appendTrackUpdates,
    replayTrack,
    subscribeTrack,
    deleteTrack,
    trackExists,
    listTracks,
  } as TrackStore
})

// =============================================================================
// Layers
// =============================================================================

/**
 * TrackStore live layer (requires DurableStreamClient)
 */
export const TrackStoreLive = Layer.effect(TrackStore, make).pipe(
  Layer.provide(DurableStreamClientLive)
)

/**
 * TrackStore with custom config
 */
export const TrackStoreConfigured = (config: TrackStoreConfig) =>
  Layer.effect(TrackStore, make).pipe(
    Layer.provide(DurableStreamClientLive),
    Layer.provide(Layer.succeed(TrackStoreConfigTag, config))
  )

/**
 * Default development layer
 */
export const TrackStoreDev = TrackStoreLive

export default TrackStore
