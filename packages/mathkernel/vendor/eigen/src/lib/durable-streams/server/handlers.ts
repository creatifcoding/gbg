/**
 * Durable Streams Server Handlers
 *
 * HttpApiBuilder handlers for the durable streams API.
 * Maps API endpoints to StreamStore service operations.
 *
 * @module @gbg/tmnl/durable-streams/server/handlers
 */

import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from '@effect/platform'
import {
  DurableStreamsApi,
  StreamNotFound,
  InternalError,
} from './api'
import {
  StreamStoreTag,
  StreamNotFoundError,
  StreamStoreError,
  StreamStoreLive,
} from './service'
import { AllRepositoriesLive } from './repositories'

// ─────────────────────────────────────────────────────────────────────────────
// Error Mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map service errors to API errors
 */
const mapError = (error: StreamNotFoundError | StreamStoreError, streamId: string) => {
  if (error._tag === 'StreamNotFoundError') {
    return new StreamNotFound({
      streamId: error.streamId,
      message: `Stream not found: ${error.streamId}`,
    })
  }
  return new InternalError({
    message: error.message,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Streams Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Streams API handlers
 */
export const StreamsHandlersLive = HttpApiBuilder.group(
  DurableStreamsApi,
  'streams',
  (handlers) =>
    handlers
      // POST /v1/stream/:streamId - Append to stream
      .handle('append', ({ path, payload }) =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          // Create stream if it doesn't exist (idempotent)
          yield* store.getOrCreate(path.streamId, payload.contentType)

          // Append data
          const result = yield* store.append(path.streamId, payload.data)

          return result
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new InternalError({ message: String(error) }))
          )
        )
      )

      // GET /v1/stream/:streamId - Read from stream
      .handle('read', ({ path, urlParams }) =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const data = yield* store.read(
            path.streamId,
            urlParams.offset,
            urlParams.limit
          )

          return data
        }).pipe(
          Effect.catchAll((error) => {
            if (error._tag === 'StreamNotFoundError') {
              return Effect.fail(new StreamNotFound({
                streamId: error.streamId,
                message: `Stream not found: ${error.streamId}`,
              }))
            }
            return Effect.fail(new InternalError({ message: String(error) }))
          })
        )
      )

      // HEAD /v1/stream/:streamId - Check if stream exists
      .handle('exists', ({ path }) =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const exists = yield* store.exists(path.streamId)

          if (!exists) {
            return yield* Effect.fail(new StreamNotFound({
              streamId: path.streamId,
              message: `Stream not found: ${path.streamId}`,
            }))
          }

          return undefined as void
        }).pipe(
          Effect.catchAll((error) => {
            if (error._tag === 'StreamNotFound') {
              return Effect.fail(error)
            }
            return Effect.fail(new StreamNotFound({
              streamId: path.streamId,
              message: String(error),
            }))
          })
        )
      )

      // DELETE /v1/stream/:streamId - Delete stream
      .handle('delete', ({ path }) =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          yield* store.delete(path.streamId)

          return undefined as void
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new InternalError({ message: String(error) }))
          )
        )
      )

      // GET /v1/stream/:streamId/metadata - Get stream metadata
      .handle('metadata', ({ path }) =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          return yield* store.metadata(path.streamId)
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(new InternalError({ message: String(error) }))
          )
        )
      )
)

// ─────────────────────────────────────────────────────────────────────────────
// Health Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health API handlers
 */
export const HealthHandlersLive = HttpApiBuilder.group(
  DurableStreamsApi,
  'health',
  (handlers) =>
    handlers
      .handle('check', () =>
        Effect.gen(function* () {
          const store = yield* StreamStoreTag

          const streamCount = yield* store.count().pipe(
            Effect.catchAll(() => Effect.succeed(0))
          )

          return {
            status: 'ok' as const,
            service: 'durable-streams',
            timestamp: Date.now(),
            streamCount,
          }
        })
      )
)

// ─────────────────────────────────────────────────────────────────────────────
// Combined API Layer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full API implementation layer
 *
 * Combines all handler groups.
 */
export const DurableStreamsApiLive = HttpApiBuilder.api(DurableStreamsApi).pipe(
  Layer.provide(StreamsHandlersLive),
  Layer.provide(HealthHandlersLive),
  Layer.provide(StreamStoreLive),
  Layer.provide(AllRepositoriesLive)
)
