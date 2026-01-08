/**
 * TrackStore - Durable stream persistence for track history
 *
 * Provides:
 * - Append position updates to per-track streams
 * - Replay full track history on demand
 * - Support offline operation with local caching
 *
 * @see .cursor/prd/features.md F007 (Durable Persistence)
 * @module
 */

import { Context, Data, Effect, Layer, Stream, Scope } from 'effect'
import {
  DurableStreamClient,
  DurableStreamError,
  type EffectStreamHandle
} from '@/lib/durable-streams/service'
import type { TrackId, TrackPosition } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8787/streams/geoint/tracks'

// =============================================================================
// Errors
// =============================================================================

export class TrackStoreError extends Data.TaggedError('TrackStoreError')<{
  readonly operation: 'append' | 'replay' | 'head' | 'delete'
  readonly trackId: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Track Update Schema
// =============================================================================

export interface TrackUpdate {
  readonly trackId: string
  readonly position: {
    readonly lat: number
    readonly lon: number
    readonly timestamp: string // ISO date string for serialization
    readonly heading: number
    readonly speed: number
    readonly altitude: number
  }
  readonly recordedAt: string // When this update was recorded
}

// =============================================================================
// Service Interface
// =============================================================================

export interface TrackStoreShape {
  /**
   * Append a position update to a track's stream
   * Creates the stream if it doesn't exist
   */
  readonly appendTrackUpdate: (
    trackId: TrackId,
    position: TrackPosition
  ) => Effect.Effect<void, TrackStoreError>

  /**
   * Append multiple position updates in batch
   */
  readonly appendBatch: (
    updates: readonly { trackId: TrackId; position: TrackPosition }[]
  ) => Effect.Effect<void, TrackStoreError>

  /**
   * Replay full track history as a stream
   * Starts from beginning and includes live updates
   */
  readonly replayTrack: (
    trackId: TrackId,
    options?: { live?: boolean }
  ) => Effect.Effect<
    Stream.Stream<TrackUpdate, TrackStoreError>,
    TrackStoreError,
    Scope.Scope
  >

  /**
   * Get track stream metadata (last position time, count, etc.)
   */
  readonly getTrackInfo: (
    trackId: TrackId
  ) => Effect.Effect<
    { exists: boolean; lastOffset?: string; contentType?: string },
    TrackStoreError
  >

  /**
   * Delete a track's history
   */
  readonly deleteTrack: (trackId: TrackId) => Effect.Effect<void, TrackStoreError>

  /**
   * Get the base URL for track streams
   */
  readonly baseUrl: string
}

// =============================================================================
// Service Tag
// =============================================================================

export class TrackStore extends Context.Tag('geoint/TrackStore')<
  TrackStore,
  TrackStoreShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const make = Effect.gen(function* () {
  const streams = yield* DurableStreamClient
  const baseUrl = DEFAULT_BASE_URL

  // Cache for stream handles (avoid repeated creates)
  const handleCache = new Map<string, EffectStreamHandle<TrackUpdate>>()

  /**
   * Get or create a stream handle for a track
   */
  const getHandle = (trackId: string) =>
    Effect.gen(function* () {
      const cached = handleCache.get(trackId)
      if (cached) return cached

      const handle = yield* streams
        .getOrCreate<TrackUpdate>({
          url: `${baseUrl}/${trackId}`,
          contentType: 'application/json'
        })
        .pipe(
          Effect.mapError(
            (e) =>
              new TrackStoreError({
                operation: 'append',
                trackId,
                message: `Failed to get/create stream: ${e.message}`,
                cause: e
              })
          )
        )

      handleCache.set(trackId, handle)
      return handle
    })

  /**
   * Convert TrackPosition to serializable TrackUpdate
   */
  const toUpdate = (trackId: string, position: TrackPosition): TrackUpdate => ({
    trackId,
    position: {
      lat: position.lat,
      lon: position.lon,
      timestamp: position.timestamp.toISOString(),
      heading: position.heading,
      speed: position.speed,
      altitude: position.altitude
    },
    recordedAt: new Date().toISOString()
  })

  const appendTrackUpdate = (trackId: TrackId, position: TrackPosition) =>
    Effect.gen(function* () {
      const handle = yield* getHandle(trackId)
      const update = toUpdate(trackId, position)
      yield* handle.append(update).pipe(
        Effect.mapError(
          (e) =>
            new TrackStoreError({
              operation: 'append',
              trackId,
              message: `Failed to append: ${e.message}`,
              cause: e
            })
        )
      )
    })

  const appendBatch = (
    updates: readonly { trackId: TrackId; position: TrackPosition }[]
  ) =>
    Effect.forEach(updates, ({ trackId, position }) =>
      appendTrackUpdate(trackId, position)
    ).pipe(Effect.asVoid)

  const replayTrack = (trackId: TrackId, options?: { live?: boolean }) =>
    Effect.gen(function* () {
      const handle = yield* getHandle(trackId)

      const batchStream = yield* handle
        .subscribe({
          offset: '-1', // From beginning
          live: options?.live ? 'sse' : false
        })
        .pipe(
          Effect.mapError(
            (e) =>
              new TrackStoreError({
                operation: 'replay',
                trackId,
                message: `Failed to subscribe: ${e.message}`,
                cause: e
              })
          )
        )

      // Flatten batches to individual updates
      return batchStream.pipe(
        Stream.mapConcat((batch) => batch.items),
        Stream.mapError(
          (e) =>
            new TrackStoreError({
              operation: 'replay',
              trackId,
              message: `Stream error: ${e.message}`,
              cause: e
            })
        )
      )
    })

  const getTrackInfo = (trackId: TrackId) =>
    Effect.gen(function* () {
      const exists = yield* streams.exists(`${baseUrl}/${trackId}`).pipe(
        Effect.mapError(
          (e) =>
            new TrackStoreError({
              operation: 'head',
              trackId,
              message: `Failed to check existence: ${e.message}`,
              cause: e
            })
        )
      )

      if (!exists) {
        return { exists: false }
      }

      const handle = yield* getHandle(trackId)
      const meta = yield* handle.head().pipe(
        Effect.mapError(
          (e) =>
            new TrackStoreError({
              operation: 'head',
              trackId,
              message: `Failed to get metadata: ${e.message}`,
              cause: e
            })
        )
      )

      return {
        exists: true,
        lastOffset: meta.offset,
        contentType: meta.contentType
      }
    })

  const deleteTrack = (trackId: TrackId) =>
    Effect.gen(function* () {
      yield* streams.delete(`${baseUrl}/${trackId}`).pipe(
        Effect.mapError(
          (e) =>
            new TrackStoreError({
              operation: 'delete',
              trackId,
              message: `Failed to delete: ${e.message}`,
              cause: e
            })
        )
      )
      handleCache.delete(trackId)
    })

  return {
    appendTrackUpdate,
    appendBatch,
    replayTrack,
    getTrackInfo,
    deleteTrack,
    baseUrl
  } satisfies TrackStoreShape
})

// =============================================================================
// Layer
// =============================================================================

/**
 * TrackStore layer with DurableStreamClient dependency
 */
export const TrackStoreLive = Layer.effect(TrackStore, make)

export default TrackStore
