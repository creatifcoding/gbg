/**
 * Durable Streams Server Service
 *
 * StreamStore Effect.Service - main abstraction for stream operations.
 * Follows the pattern from src/lib/ams/v2/base/services/asset-state-sql.ts
 *
 * @module @gbg/tmnl/durable-streams/server/service
 */

import { Context, Data, Effect, Layer, Option, pipe } from 'effect'
import {
  StreamRepositoryTag,
  StreamEntryRepositoryTag,
  AllRepositoriesLive,
} from './repositories'
import type {
  StreamData,
  StreamMetadataResponse,
  AppendResult,
} from './models'

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream not found error
 */
export class StreamNotFoundError extends Data.TaggedError('StreamNotFoundError')<{
  readonly streamId: string
}> {}

/**
 * Stream already exists error
 */
export class StreamExistsError extends Data.TaggedError('StreamExistsError')<{
  readonly streamId: string
}> {}

/**
 * Generic stream store error
 */
export class StreamStoreError extends Data.TaggedError('StreamStoreError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// StreamStore Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StreamStore service interface
 */
export interface StreamStore {
  /**
   * Create a new stream
   */
  readonly create: (
    streamId: string,
    contentType?: string
  ) => Effect.Effect<void, StreamExistsError | StreamStoreError>

  /**
   * Get or create a stream (idempotent)
   */
  readonly getOrCreate: (
    streamId: string,
    contentType?: string
  ) => Effect.Effect<void, StreamStoreError>

  /**
   * Check if stream exists
   */
  readonly exists: (streamId: string) => Effect.Effect<boolean, StreamStoreError>

  /**
   * Append data to a stream
   */
  readonly append: (
    streamId: string,
    data: unknown
  ) => Effect.Effect<AppendResult, StreamNotFoundError | StreamStoreError>

  /**
   * Read entries from a stream
   */
  readonly read: (
    streamId: string,
    fromOffset?: string,
    limit?: number
  ) => Effect.Effect<StreamData, StreamNotFoundError | StreamStoreError>

  /**
   * Get stream metadata
   */
  readonly metadata: (
    streamId: string
  ) => Effect.Effect<StreamMetadataResponse, StreamStoreError>

  /**
   * Delete a stream
   */
  readonly delete: (streamId: string) => Effect.Effect<void, StreamStoreError>

  /**
   * Get total stream count
   */
  readonly count: () => Effect.Effect<number, StreamStoreError>
}

// ─────────────────────────────────────────────────────────────────────────────
// StreamStore Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StreamStore service tag
 */
export class StreamStoreTag extends Context.Tag('tmnl/durable-streams/StreamStore')<
  StreamStoreTag,
  StreamStore
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// StreamStore Live Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StreamStore live implementation
 *
 * Requires: StreamRepository, StreamEntryRepository
 */
export const StreamStoreLive = Layer.effect(
  StreamStoreTag,
  Effect.gen(function* () {
    const streamRepo = yield* StreamRepositoryTag
    const entryRepo = yield* StreamEntryRepositoryTag

    /**
     * Parse offset string to number
     * "-1" or empty = start from beginning (sequence 0)
     */
    const parseOffset = (offset?: string): number => {
      if (!offset || offset === '-1') return 0
      const parsed = parseInt(offset, 10)
      return isNaN(parsed) ? 0 : parsed
    }

    return StreamStoreTag.of({
      create: (streamId, contentType = 'application/json') =>
        Effect.gen(function* () {
          const exists = yield* streamRepo.exists(streamId).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
          )

          if (exists) {
            return yield* Effect.fail(new StreamExistsError({ streamId }))
          }

          yield* streamRepo.create(streamId, contentType).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Failed to create stream', cause: e }))
          )
        }),

      getOrCreate: (streamId, contentType = 'application/json') =>
        Effect.gen(function* () {
          const exists = yield* streamRepo.exists(streamId).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
          )

          if (!exists) {
            yield* streamRepo.create(streamId, contentType).pipe(
              Effect.mapError((e) => new StreamStoreError({ message: 'Failed to create stream', cause: e }))
            )
          }
        }),

      exists: (streamId) =>
        streamRepo.exists(streamId).pipe(
          Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
        ),

      append: (streamId, data) =>
        Effect.gen(function* () {
          // Check stream exists
          const exists = yield* streamRepo.exists(streamId).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
          )

          if (!exists) {
            return yield* Effect.fail(new StreamNotFoundError({ streamId }))
          }

          // Append entry
          const sequence = yield* entryRepo.append(streamId, data).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Failed to append entry', cause: e }))
          )

          return {
            offset: String(sequence),
            streamId,
            success: true,
          }
        }),

      read: (streamId, fromOffset, limit = 100) =>
        Effect.gen(function* () {
          // Check stream exists
          const streamOpt = yield* streamRepo.findByStreamId(streamId).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
          )

          if (Option.isNone(streamOpt)) {
            return yield* Effect.fail(new StreamNotFoundError({ streamId }))
          }

          const stream = streamOpt.value
          const fromSequence = parseOffset(fromOffset)

          // Read entries
          const entries = yield* entryRepo.read(streamId, fromSequence, limit).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Failed to read entries', cause: e }))
          )

          // Find last offset
          const lastOffset = entries.length > 0
            ? String(entries[entries.length - 1]!.sequence)
            : String(fromSequence)

          // Check if up to date
          const upToDate = entries.length < limit ||
            (entries.length > 0 && entries[entries.length - 1]!.sequence >= stream.currentSequence)

          return {
            streamId,
            entries: entries.map((e) => ({
              offset: String(e.sequence),
              // Parse JSON data that was stringified during storage
              data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data,
              timestamp: new Date(e.createdAt as unknown as string).getTime(),
            })),
            lastOffset,
            upToDate,
          }
        }),

      metadata: (streamId) =>
        Effect.gen(function* () {
          const streamOpt = yield* streamRepo.findByStreamId(streamId).pipe(
            Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
          )

          if (Option.isNone(streamOpt)) {
            return {
              exists: false,
            }
          }

          const stream = streamOpt.value
          return {
            exists: true,
            streamId: stream.streamId,
            contentType: stream.contentType,
            currentOffset: String(stream.currentSequence),
            createdAt: new Date(stream.createdAt as unknown as string).getTime(),
            updatedAt: new Date(stream.updatedAt as unknown as string).getTime(),
          }
        }),

      delete: (streamId) =>
        streamRepo.delete(streamId).pipe(
          Effect.mapError((e) => new StreamStoreError({ message: 'Failed to delete stream', cause: e }))
        ),

      count: () =>
        streamRepo.count().pipe(
          Effect.mapError((e) => new StreamStoreError({ message: 'Database error', cause: e }))
        ),
    })
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Combined Service Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full StreamStore layer with repositories
 *
 * Requires: SqlClient.SqlClient
 */
export const StreamStoreFullLayer = StreamStoreLive.pipe(
  Layer.provide(AllRepositoriesLive)
)
