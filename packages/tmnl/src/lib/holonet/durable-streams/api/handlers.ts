/**
 * Durable-Streams API Handlers
 *
 * HttpApiBuilder handlers for the durable-streams NATS bridge.
 * Maps HTTP requests to bridge services.
 *
 * @module holonet/durable-streams/api/handlers
 */

import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from '@effect/platform';
import { EventLog } from '@effect/experimental';
import {
  HolonetDurableStreamsApi,
  ApiStreamNotFoundError,
  ApiStreamExistsError,
  ApiSchemaValidationError,
  ApiInvalidOffsetError,
  ApiNatsConnectionError,
  ApiInternalError,
  ApiLongPollTimeoutError,
} from './DurableStreamsApi';
import { StreamBridgeService, LiveStreamService } from '../services';
import {
  StreamNotFoundError,
  StreamExistsError,
} from '../schemas/errors';
import { SchemaValidationError } from '../services/StreamCodecService';
import {
  DurableStreamsEventLogSchema,
  type StreamCreatedPayload,
  type StreamReadPayload,
  type StreamAppendedPayload,
  type StreamDeletedPayload,
} from '../events';
// Note: DurableStreamsEventLogLive should be provided by the application layer

// =============================================================================
// Streams Group Handlers
// =============================================================================

/**
 * Streams API group handlers
 */
export const StreamsHandlersLive = HttpApiBuilder.group(
  HolonetDurableStreamsApi,
  'streams',
  (handlers) =>
    handlers
      // ─────────────────────────────────────────────────────────────────────
      // PUT /v1/stream/:streamId - Create stream
      // ─────────────────────────────────────────────────────────────────────
      .handle('create', ({ path, payload }) =>
        Effect.gen(function* () {
          const bridge = yield* StreamBridgeService;
          const writeEvent = yield* EventLog.makeClient(DurableStreamsEventLogSchema);

          const result = yield* bridge.create(path.streamId, {
            contentType: payload.contentType,
            retention: payload.retention,
            maxAge: payload.maxAge,
            maxMessages: payload.maxMessages,
            maxBytes: payload.maxBytes,
          }).pipe(
            Effect.mapError((e) => {
              if (e._tag === 'StreamExistsError') {
                return new ApiStreamExistsError({
                  streamId: (e as StreamExistsError).streamId,
                  message: `Stream '${(e as StreamExistsError).streamId}' already exists`,
                });
              }
              return new ApiInternalError({ message: 'Internal error' });
            })
          );

          // Emit observability event (ignore errors)
          yield* writeEvent('StreamCreated', {
            streamId: path.streamId,
            schemaId: result.schemaId ?? null,
            contentType: payload.contentType,
            timestamp: Date.now(),
          } satisfies StreamCreatedPayload).pipe(Effect.ignore);

          return {
            streamId: path.streamId,
            created: true,
            config: {
              contentType: payload.contentType,
              retention: payload.retention,
              maxAge: payload.maxAge,
              maxMessages: payload.maxMessages,
              maxBytes: payload.maxBytes,
            },
          };
        })
      )

      // ─────────────────────────────────────────────────────────────────────
      // POST /v1/stream/:streamId - Append to stream
      // ─────────────────────────────────────────────────────────────────────
      .handle('append', ({ path, payload, urlParams }) =>
        Effect.gen(function* () {
          const bridge = yield* StreamBridgeService;
          const writeEvent = yield* EventLog.makeClient(DurableStreamsEventLogSchema);

          const result = yield* bridge.append(
            path.streamId,
            payload.data,
            urlParams.producerId,
            urlParams.producerSeq
          ).pipe(
            Effect.mapError((e) => {
              if (e._tag === 'StreamNotFoundError') {
                return new ApiStreamNotFoundError({
                  streamId: (e as StreamNotFoundError).streamId,
                  message: `Stream '${(e as StreamNotFoundError).streamId}' not found`,
                });
              }
              if (e._tag === 'SchemaValidationError') {
                return new ApiSchemaValidationError({
                  message: (e as SchemaValidationError).message,
                  schemaId: (e as SchemaValidationError).schemaId,
                });
              }
              return new ApiInternalError({ message: 'Internal error' });
            })
          );

          // Emit observability event (ignore errors)
          yield* writeEvent('StreamAppended', {
            streamId: path.streamId,
            seq: result.seq,
            schemaId: null,
            byteSize: null,
            timestamp: Date.now(),
          } satisfies StreamAppendedPayload).pipe(Effect.ignore);

          return result;
        })
      )

      // ─────────────────────────────────────────────────────────────────────
      // GET /v1/stream/:streamId - Read from stream
      // ─────────────────────────────────────────────────────────────────────
      .handle('read', ({ path, urlParams }) =>
        Effect.gen(function* () {
          const bridge = yield* StreamBridgeService;
          const liveStream = yield* LiveStreamService;
          const writeEvent = yield* EventLog.makeClient(DurableStreamsEventLogSchema);

          // Parse offset
          const offset =
            urlParams.offset === '-1'
              ? -1
              : urlParams.offset === '-2'
                ? -2
                : parseInt(urlParams.offset, 10);

          if (isNaN(offset)) {
            return yield* Effect.fail(
              new ApiInvalidOffsetError({
                message: 'Invalid offset',
                offset: urlParams.offset,
                reason: 'Offset must be a number, "-1", or "-2"',
              })
            );
          }

          // Check for long-poll mode
          if (urlParams.live === 'long-poll') {
            const result = yield* liveStream.longPoll(path.streamId, {
              offset,
              timeout: urlParams.timeout,
              limit: urlParams.limit,
            }).pipe(
              Effect.mapError((e): typeof ApiStreamNotFoundError.Type | ApiLongPollTimeoutError | typeof ApiNatsConnectionError.Type | typeof ApiInternalError.Type => {
                if (e._tag === 'LongPollTimeoutError') {
                  // 204 No Content - client already knows streamId/offset from request
                  return new ApiLongPollTimeoutError();
                }
                if (e._tag === 'StreamNotFoundError') {
                  return new ApiStreamNotFoundError({
                    streamId: (e as StreamNotFoundError).streamId,
                    message: `Stream '${(e as StreamNotFoundError).streamId}' not found`,
                  });
                }
                return new ApiInternalError({ message: 'Internal error' });
              })
            );

            yield* writeEvent('StreamRead', {
              streamId: path.streamId,
              offset,
              count: result.items.length,
              clientId: null,
              timestamp: Date.now(),
            } satisfies StreamReadPayload).pipe(Effect.ignore);

            return result;
          }

          // SSE mode - TODO: implement streaming response
          // For now fall through to batch read

          // Batch read mode
          const result = yield* bridge.read(path.streamId, {
            offset,
            limit: urlParams.limit,
          }).pipe(
            Effect.mapError((e): typeof ApiStreamNotFoundError.Type | typeof ApiInternalError.Type => {
              if (e._tag === 'StreamNotFoundError') {
                return new ApiStreamNotFoundError({
                  streamId: (e as StreamNotFoundError).streamId,
                  message: `Stream '${(e as StreamNotFoundError).streamId}' not found`,
                });
              }
              return new ApiInternalError({ message: 'Internal error' });
            })
          );

          yield* writeEvent('StreamRead', {
            streamId: path.streamId,
            offset,
            count: result.items.length,
            clientId: null,
            timestamp: Date.now(),
          } satisfies StreamReadPayload).pipe(Effect.ignore);

          return result;
        })
      )

      // ─────────────────────────────────────────────────────────────────────
      // HEAD /v1/stream/:streamId - Get stream metadata
      // ─────────────────────────────────────────────────────────────────────
      .handle('metadata', ({ path }) =>
        Effect.gen(function* () {
          const bridge = yield* StreamBridgeService;

          yield* bridge.metadata(path.streamId).pipe(
            Effect.mapError((e): typeof ApiStreamNotFoundError.Type => {
              if (e._tag === 'StreamNotFoundError') {
                return new ApiStreamNotFoundError({
                  streamId: (e as StreamNotFoundError).streamId,
                  message: `Stream '${(e as StreamNotFoundError).streamId}' not found`,
                });
              }
              return new ApiStreamNotFoundError({
                streamId: path.streamId,
                message: 'Stream not found',
              });
            })
          );

          // HEAD returns void, metadata is in response headers
          return void 0;
        })
      )

      // ─────────────────────────────────────────────────────────────────────
      // DELETE /v1/stream/:streamId - Delete stream
      // ─────────────────────────────────────────────────────────────────────
      .handle('delete', ({ path }) =>
        Effect.gen(function* () {
          const bridge = yield* StreamBridgeService;
          const writeEvent = yield* EventLog.makeClient(DurableStreamsEventLogSchema);

          yield* bridge.delete(path.streamId).pipe(
            Effect.mapError((e): typeof ApiStreamNotFoundError.Type | typeof ApiInternalError.Type => {
              if (e._tag === 'StreamNotFoundError') {
                return new ApiStreamNotFoundError({
                  streamId: (e as StreamNotFoundError).streamId,
                  message: `Stream '${(e as StreamNotFoundError).streamId}' not found`,
                });
              }
              return new ApiInternalError({ message: 'Internal error' });
            })
          );

          yield* writeEvent('StreamDeleted', {
            streamId: path.streamId,
            messageCount: 0,
            timestamp: Date.now(),
          } satisfies StreamDeletedPayload).pipe(Effect.ignore);

          return void 0;
        })
      )
);

// =============================================================================
// Health Group Handlers
// =============================================================================

/**
 * Health API group handlers
 */
export const HealthHandlersLive = HttpApiBuilder.group(
  HolonetDurableStreamsApi,
  'health',
  (handlers) =>
    handlers.handle('check', () =>
      Effect.succeed({
        status: 'healthy' as const,
        nats: {
          connected: true,
          latency: undefined as number | undefined,
        },
        uptime: process.uptime() * 1000,
        version: '1.0.0',
      })
    )
);

// =============================================================================
// Combined API Layer
// =============================================================================

/**
 * All handlers combined as a Layer for the Holonet Durable-Streams API.
 *
 * Provides the HttpApiBuilder.Api service for use with HttpServer.
 *
 * @example
 * ```typescript
 * import { HolonetDurableStreamsApiLive } from '@/lib/holonet/durable-streams/api'
 *
 * const ServerLive = HttpServer.serve().pipe(
 *   Layer.provide(HolonetDurableStreamsApiLive),
 *   Layer.provide(StreamBridgeService.Default),
 *   Layer.provide(LiveStreamService.Default),
 *   Layer.provide(DurableStreamsEventLogLive)
 * )
 * ```
 */
export const HolonetDurableStreamsApiLive = Layer.mergeAll(
  StreamsHandlersLive,
  HealthHandlersLive
);
