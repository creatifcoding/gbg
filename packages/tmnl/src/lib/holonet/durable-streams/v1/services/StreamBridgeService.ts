/**
 * StreamBridgeService
 *
 * Core CRUD operations for durable-streams ↔ NATS bridge.
 * Handles stream creation, appending, reading, and deletion.
 *
 * Call Graph:
 * - create: parseContentType → SchemaRegistry.setForStream → NatsStreamService.ensureStream
 * - append: SchemaRegistry.getForStream → StreamCodecService.encodeWithSchema → publish
 * - read: ConsumerStateService.getOrCreateConsumer → fetch → StreamCodecService.decodeWithSchema
 * - metadata: NatsStreamService.getStreamInfo → SchemaRegistry.getForStream
 * - delete: NatsStreamService.deleteStream → cleanup schema metadata
 *
 * @module holonet/durable-streams/services/StreamBridgeService
 */

import { Effect, Context, Layer } from 'effect';
import { SchemaRegistry, parseContentType } from '@/lib/holonet/core/schema';
import { StreamCodecService } from './StreamCodecService';
import {
  StreamNotFoundError,
  StreamExistsError,
  SchemaNotFoundError,
  CodecError,
  SchemaValidationError,
} from '../schemas/errors';
import {
  type StreamConfig,
  type StreamMetadata,
  type ReadResponse,
  type AppendResult,
  type StreamMessage,
} from '../schemas/protocol';

// =============================================================================
// Types
// =============================================================================

/**
 * Stream creation result
 */
export interface CreateResult {
  readonly streamId: string;
  readonly schemaId: string | undefined;
  readonly contentType: string;
  readonly created: boolean;
}

/**
 * Options for read operation
 */
export interface ReadOptions {
  readonly offset: number;
  readonly limit?: number;
  readonly clientId?: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * All possible errors from StreamBridgeService
 */
export type StreamBridgeError =
  | StreamNotFoundError
  | StreamExistsError
  | SchemaNotFoundError
  | CodecError
  | SchemaValidationError;

// =============================================================================
// Service Interface
// =============================================================================

/**
 * StreamBridgeService shape - CRUD operations for streams
 */
export interface StreamBridgeServiceShape {
  /**
   * Create a new stream with schema configuration.
   *
   * @param streamId - Unique stream identifier
   * @param config - Stream configuration with content-type
   * @returns CreateResult with stream info
   */
  readonly create: (
    streamId: string,
    config: StreamConfig
  ) => Effect.Effect<CreateResult, StreamBridgeError>;

  /**
   * Append data to a stream.
   *
   * @param streamId - Stream to append to
   * @param data - Data to append (validated against stream schema)
   * @param producerId - Optional producer ID for idempotency
   * @param producerSeq - Optional producer sequence for idempotency
   * @returns AppendResult with sequence number
   */
  readonly append: (
    streamId: string,
    data: unknown,
    producerId?: string,
    producerSeq?: number
  ) => Effect.Effect<AppendResult, StreamBridgeError>;

  /**
   * Read messages from a stream.
   *
   * @param streamId - Stream to read from
   * @param options - Read options (offset, limit, clientId)
   * @returns ReadResponse with messages and next offset
   */
  readonly read: (
    streamId: string,
    options: ReadOptions
  ) => Effect.Effect<ReadResponse, StreamBridgeError>;

  /**
   * Get stream metadata.
   *
   * @param streamId - Stream to query
   * @returns StreamMetadata
   */
  readonly metadata: (
    streamId: string
  ) => Effect.Effect<StreamMetadata, StreamBridgeError>;

  /**
   * Delete a stream and its schema metadata.
   *
   * @param streamId - Stream to delete
   * @returns true if deleted
   */
  readonly delete: (streamId: string) => Effect.Effect<boolean, StreamBridgeError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class StreamBridgeService extends Context.Tag('holonet/durable-streams/StreamBridgeService')<
  StreamBridgeService,
  StreamBridgeServiceShape
>() {
  /**
   * Default layer with mock implementation for testing
   */
  static readonly Default = Layer.effect(
    StreamBridgeService,
    Effect.gen(function* () {
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      // In-memory storage for mock
      const streams = new Map<
        string,
        {
          config: StreamConfig;
          schemaId: string | undefined;
          messages: Array<{ seq: number; data: unknown; timestamp: number }>;
          createdAt: number;
        }
      >();

      let nextSeq = 1;

      return {
        create: (streamId, config) =>
          Effect.gen(function* () {
            if (streams.has(streamId)) {
              return yield* Effect.fail(new StreamExistsError({ streamId }));
            }

            // Parse content-type to extract schema ID
            const parsed = parseContentType(config.contentType);
            const schemaId = parsed.schemaId;

            // Store stream config
            streams.set(streamId, {
              config,
              schemaId,
              messages: [],
              createdAt: Date.now(),
            });

            // Register schema metadata if schemaId present
            if (schemaId) {
              yield* registry.setForStream(streamId, {
                schemaId,
                contentType: parsed.mimeType,
                registeredAt: Date.now(),
              });
            }

            return {
              streamId,
              schemaId,
              contentType: config.contentType,
              created: true,
            };
          }),

        append: (streamId, data, _producerId, _producerSeq) =>
          Effect.gen(function* () {
            const stream = streams.get(streamId);
            if (!stream) {
              return yield* Effect.fail(new StreamNotFoundError({ streamId }));
            }

            // Validate against schema if registered
            if (stream.schemaId) {
              // This validates the data against the schema
              yield* codec.encodeWithSchema(stream.schemaId, data);
            }

            const seq = nextSeq++;
            stream.messages.push({
              seq,
              data,
              timestamp: Date.now(),
            });

            return {
              seq,
              stream: streamId,
              duplicate: false,
            };
          }),

        read: (streamId, options) =>
          Effect.sync(() => {
            const stream = streams.get(streamId);
            if (!stream) {
              throw new StreamNotFoundError({ streamId });
            }

            const { offset, limit = 100 } = options;

            // Filter messages by offset
            const startIndex = stream.messages.findIndex((m) => m.seq > offset);
            const messages =
              startIndex === -1 ? [] : stream.messages.slice(startIndex, startIndex + limit);

            const items: StreamMessage[] = messages.map((m) => ({
              seq: m.seq,
              data: m.data,
              timestamp: m.timestamp,
              schemaId: stream.schemaId,
            }));

            const lastSeq = messages.length > 0 ? messages[messages.length - 1].seq : offset;

            return {
              items,
              nextOffset: lastSeq,
              upToDate: messages.length < limit,
            };
          }).pipe(Effect.catchAllDefect((e) => Effect.fail(e as StreamNotFoundError))),

        metadata: (streamId) =>
          Effect.sync(() => {
            const stream = streams.get(streamId);
            if (!stream) {
              throw new StreamNotFoundError({ streamId });
            }

            const firstSeq = stream.messages.length > 0 ? stream.messages[0].seq : 0;
            const lastSeq =
              stream.messages.length > 0 ? stream.messages[stream.messages.length - 1].seq : 0;
            const lastMessageAt =
              stream.messages.length > 0
                ? stream.messages[stream.messages.length - 1].timestamp
                : undefined;

            return {
              id: streamId,
              contentType: stream.config.contentType,
              schemaId: stream.schemaId,
              createdAt: stream.createdAt,
              lastMessageAt,
              messageCount: stream.messages.length,
              firstSeq,
              lastSeq,
              bytes: JSON.stringify(stream.messages).length, // Rough estimate
            };
          }).pipe(Effect.catchAllDefect((e) => Effect.fail(e as StreamNotFoundError))),

        delete: (streamId) =>
          Effect.sync(() => {
            if (!streams.has(streamId)) {
              throw new StreamNotFoundError({ streamId });
            }

            streams.delete(streamId);
            return true;
          }).pipe(Effect.catchAllDefect((e) => Effect.fail(e as StreamNotFoundError))),
      };
    })
  ).pipe(Layer.provide(Layer.mergeAll(SchemaRegistry.Default, StreamCodecService.Default)));
}

// =============================================================================
// Re-export errors for convenience
// =============================================================================

export { StreamNotFoundError, StreamExistsError } from '../schemas/errors';
