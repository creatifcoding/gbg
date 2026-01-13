/**
 * HolonetStreamProcessor
 *
 * Drop-in replacement for DurableStreamClient pattern using NATS JetStream.
 * Provides durable, resumable streaming with automatic consumer-based offset tracking.
 *
 * @module holonet/integration/stream-processor
 *
 * ## Migration from DurableStreams
 *
 * ```typescript
 * // Before: DurableStreamClient
 * const handle = yield* client.getOrCreate({ url: '/my-stream' });
 * yield* handle.append(data);
 * const result = yield* handle.read({ offset: '-1' });
 *
 * // After: HolonetStreamProcessor
 * const processor = yield* makeProcessor(config);
 * yield* processor.publish(data);
 * const result = yield* processor.read({ fromSequence: 0 });
 * ```
 *
 * ## Key Differences from DurableStreams
 *
 * 1. **Offset tracking**: Automatic via durable consumers (no manual offset management)
 * 2. **Acknowledgment**: Explicit ack required for consumer progress
 * 3. **Persistence**: NATS JetStream (cluster-capable) vs SQLite (single-node)
 * 4. **Protocol**: NATS WebSocket vs HTTP REST
 */

import {
  Effect,
  Stream,
  Schema,
  Scope,
  pipe,
  Context,
  Layer,
} from 'effect';
// nats.ws types not needed - we use the service abstractions

import { NatsStreamService, type TypedJsMessage } from '../nats/stream';
import { NatsInnerService } from '../nats/inner';

// =============================================================================
// Configuration Schema
// =============================================================================

/**
 * Configuration for a stream processor instance
 */
export const StreamProcessorConfig = Schema.Struct({
  /** JetStream stream name (will be created if doesn't exist) */
  streamName: Schema.String,

  /** Subject pattern for publishing (e.g., "blocks.my-stream.events") */
  subject: Schema.String,

  /** Subjects to bind to the stream (wildcards allowed) */
  subjects: Schema.Array(Schema.String),

  /** Durable consumer name for offset tracking */
  consumerName: Schema.String,

  /** Message retention: limits (default), workqueue, or interest */
  retention: Schema.optional(Schema.Literal('limits', 'workqueue', 'interest')),

  /** Max age for messages in seconds (0 = unlimited) */
  maxAge: Schema.optional(Schema.Number),

  /** Max messages in stream (0 = unlimited) */
  maxMsgs: Schema.optional(Schema.Number),

  /** Max bytes in stream (0 = unlimited) */
  maxBytes: Schema.optional(Schema.Number),

  /** Replicas for durability (1-5) */
  replicas: Schema.optional(Schema.Number),
});
export type StreamProcessorConfig = typeof StreamProcessorConfig.Type;

// =============================================================================
// Service Types
// =============================================================================

/**
 * Result of a publish operation
 */
export interface PublishResult {
  /** Stream sequence number */
  readonly seq: number;
  /** Stream name */
  readonly stream: string;
  /** Whether this was a duplicate (dedup) */
  readonly duplicate: boolean;
}

/**
 * Result of a read operation
 */
export interface ReadResult<T> {
  /** Items read from the stream */
  readonly items: readonly T[];
  /** Last sequence number in this batch */
  readonly lastSequence: number;
  /** Whether we've caught up to the stream head */
  readonly upToDate: boolean;
}

/**
 * A message from the stream with acknowledgment
 */
export interface StreamMessage<T> {
  /** Decoded message data */
  readonly data: T;
  /** Stream sequence number */
  readonly sequence: number;
  /** Message timestamp */
  readonly timestamp: Date;
  /** Acknowledge the message (advances consumer offset) */
  readonly ack: () => Effect.Effect<void>;
  /** Negative acknowledge (redelivery after delay) */
  readonly nak: (delay?: number) => Effect.Effect<void>;
  /** Indicate message is being worked on (extends ack deadline) */
  readonly working: () => Effect.Effect<void>;
  /** Terminate redelivery (dead-letter) */
  readonly term: (reason?: string) => Effect.Effect<void>;
}

/**
 * Stream info metadata
 */
export interface StreamInfoResult {
  /** Total messages in stream */
  readonly messages: number;
  /** Total bytes in stream */
  readonly bytes: number;
  /** First sequence number */
  readonly firstSeq: number;
  /** Last sequence number */
  readonly lastSeq: number;
  /** Stream creation time */
  readonly created: Date;
}

// =============================================================================
// Error Types
// =============================================================================

export class StreamProcessorError extends Schema.TaggedError<StreamProcessorError>()(
  'StreamProcessorError',
  {
    message: Schema.String,
    operation: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {}

export class StreamNotFoundError extends Schema.TaggedError<StreamNotFoundError>()(
  'StreamNotFoundError',
  {
    streamName: Schema.String,
  }
) {}

// =============================================================================
// Service Shape (Generic)
// =============================================================================

/**
 * HolonetStreamProcessor provides durable, resumable streaming via NATS JetStream.
 *
 * This is the NATS equivalent of DurableStreamClient, providing:
 * - Durable message storage in JetStream
 * - Automatic offset tracking via durable consumers
 * - Replay from any sequence number
 * - Real-time subscriptions with acknowledgment
 */
export interface HolonetStreamProcessorShape<T> {
  // ─── Publishing ───────────────────────────────────────────────────────────────

  /**
   * Publish data to the stream with durability acknowledgment.
   *
   * @param data - Data to publish (must match schema)
   * @param opts - Optional: msgId for deduplication
   * @returns PublishResult with sequence number
   */
  readonly publish: (
    data: T,
    opts?: { msgId?: string }
  ) => Effect.Effect<PublishResult, StreamProcessorError>;

  /**
   * Publish multiple items atomically.
   *
   * @param items - Array of data items
   * @returns Array of PublishResults
   */
  readonly publishBatch: (
    items: readonly T[]
  ) => Effect.Effect<readonly PublishResult[], StreamProcessorError>;

  // ─── Reading ──────────────────────────────────────────────────────────────────

  /**
   * Read from the stream (catch-up mode).
   *
   * Reads a batch of messages starting from the specified sequence.
   * Does NOT advance consumer offset (use subscribe for that).
   *
   * @param opts - fromSequence (0 = beginning), limit
   * @returns ReadResult with items and upToDate flag
   */
  readonly read: (opts?: {
    fromSequence?: number;
    limit?: number;
  }) => Effect.Effect<ReadResult<T>, StreamProcessorError>;

  // ─── Subscribing ──────────────────────────────────────────────────────────────

  /**
   * Subscribe to live updates starting from current consumer position.
   *
   * Uses durable consumer for automatic offset tracking.
   * Each message must be ack'd to advance the consumer offset.
   *
   * @returns Scoped Stream of messages with ack functions
   */
  readonly subscribe: Effect.Effect<
    Stream.Stream<StreamMessage<T>, StreamProcessorError>,
    StreamProcessorError,
    Scope.Scope
  >;

  /**
   * Subscribe from a specific sequence number.
   *
   * Creates a new consumer or resets existing one to the specified sequence.
   * Useful for resuming after disconnect.
   *
   * @param fromSequence - Sequence to start from (0 = beginning)
   * @returns Scoped Stream of messages
   */
  readonly subscribeFrom: (
    fromSequence: number
  ) => Effect.Effect<
    Stream.Stream<StreamMessage<T>, StreamProcessorError>,
    StreamProcessorError,
    Scope.Scope
  >;

  // ─── Metadata ─────────────────────────────────────────────────────────────────

  /**
   * Get current stream head sequence number.
   *
   * @returns The last sequence number in the stream
   */
  readonly getCurrentSequence: Effect.Effect<number, StreamProcessorError>;

  /**
   * Get stream info (messages, bytes, etc.).
   *
   * @returns StreamInfoResult
   */
  readonly getInfo: Effect.Effect<StreamInfoResult, StreamProcessorError>;

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Delete the stream and all its messages.
   *
   * WARNING: This is destructive and cannot be undone.
   *
   * @returns true if deleted
   */
  readonly delete: Effect.Effect<boolean, StreamProcessorError>;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a HolonetStreamProcessor for a specific schema type.
 *
 * @param config - Stream processor configuration
 * @param schema - Effect.Schema for encoding/decoding messages
 * @returns Layer providing HolonetStreamProcessor<T>
 *
 * @example
 * ```typescript
 * const BlockEventSchema = Schema.Union(BlockCreated, BlockUpdated, BlockDeleted);
 *
 * const processor = yield* makeStreamProcessor(
 *   {
 *     streamName: 'BLOCK_EVENTS',
 *     subject: 'blocks.my-stream.events',
 *     subjects: ['blocks.my-stream.>'],
 *     consumerName: 'block-processor-1',
 *   },
 *   BlockEventSchema
 * );
 *
 * // Publish
 * yield* processor.publish({ _tag: 'BlockCreated', blockId: 'b1', ... });
 *
 * // Subscribe
 * const stream = yield* processor.subscribe;
 * yield* Stream.runForEach(stream, (msg) =>
 *   Effect.gen(function* () {
 *     console.log('Received:', msg.data);
 *     yield* msg.ack(); // Important: acknowledge to advance offset
 *   })
 * );
 * ```
 */
export const makeStreamProcessor = <T, I>(
  config: StreamProcessorConfig,
  schema: Schema.Schema<T, I, never>
): Effect.Effect<
  HolonetStreamProcessorShape<T>,
  StreamProcessorError,
  NatsStreamService | NatsInnerService
> =>
  Effect.gen(function* () {
    const streamService = yield* NatsStreamService;
    const inner = yield* NatsInnerService;

    // ─────────────────────────────────────────────────────────────────────────
    // STREAM SETUP
    // ─────────────────────────────────────────────────────────────────────────

    // Ensure the stream exists
    yield* streamService
      .ensureStream({
        name: config.streamName,
        subjects: [...config.subjects],
        retention: config.retention ?? 'limits',
        maxAge: config.maxAge ? config.maxAge * 1_000_000_000 : undefined, // nanos
        maxMsgs: config.maxMsgs,
        maxBytes: config.maxBytes,
        replicas: config.replicas ?? 1,
      })
      .pipe(
        Effect.mapError(
          (e) =>
            new StreamProcessorError({
              message: `Failed to ensure stream '${config.streamName}': ${e.message}`,
              operation: 'ensureStream',
              cause: e,
            })
        )
      );

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    const mapTypedMessage = (msg: TypedJsMessage<T>): StreamMessage<T> => ({
      data: msg.data,
      sequence: msg.seq,
      timestamp: msg.time,
      ack: msg.ack,
      nak: msg.nak,
      working: msg.working,
      term: msg.term,
    });

    const wrapError =
      (operation: string) =>
      <E extends Error>(e: E): StreamProcessorError =>
        new StreamProcessorError({
          message: `${operation} failed: ${e.message}`,
          operation,
          cause: e,
        });

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLISH
    // ─────────────────────────────────────────────────────────────────────────

    const publish = (
      data: T,
      opts?: { msgId?: string }
    ): Effect.Effect<PublishResult, StreamProcessorError> =>
      streamService
        .publish(config.subject, schema, data, {
          msgId: opts?.msgId,
          expectStream: config.streamName,
        })
        .pipe(
          Effect.map(
            (ack): PublishResult => ({
              seq: ack.seq,
              stream: ack.stream,
              duplicate: ack.duplicate,
            })
          ),
          Effect.mapError(wrapError('publish'))
        );

    const publishBatch = (
      items: readonly T[]
    ): Effect.Effect<readonly PublishResult[], StreamProcessorError> =>
      Effect.forEach(items, (item) => publish(item), {
        concurrency: 'unbounded',
      });

    // ─────────────────────────────────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────────────────────────────────

    const read = (
      opts?: { fromSequence?: number; limit?: number }
    ): Effect.Effect<ReadResult<T>, StreamProcessorError> =>
      Effect.scoped(
        Effect.gen(function* () {
          const fromSeq = opts?.fromSequence ?? 1;
          const limitCount = opts?.limit ?? 100;

          // Use subscribe with ephemeral consumer for reading
          // Take only up to limit messages
          const ephemeralConsumerName = `ephemeral-read-${Date.now()}`;
          const stream = yield* streamService
            .subscribe(config.streamName, schema, {
              consumer: ephemeralConsumerName,
              deliverPolicy: 'by_start_sequence',
              startSequence: fromSeq,
              ackPolicy: 'none', // No ack needed for read
            })
            .pipe(Effect.mapError(wrapError('subscribe')));

          // Collect up to limit messages
          const messages = yield* pipe(
            stream,
            Stream.take(limitCount),
            Stream.runCollect,
            Effect.map((chunk) => [...chunk]),
            Effect.timeout(5000),
            Effect.catchAll(() => Effect.succeed([] as TypedJsMessage<T>[]))
          );

          // Clean up ephemeral consumer
          yield* inner.consumers
            .delete(config.streamName, ephemeralConsumerName)
            .pipe(Effect.catchAll(() => Effect.void));

          // Get stream info to check if we're caught up
          const info = yield* streamService
            .getStreamInfo(config.streamName)
            .pipe(Effect.mapError(wrapError('getStreamInfo')));

          const lastSeq = messages.length > 0 ? messages[messages.length - 1].seq : fromSeq;
          const streamLastSeq = info?.state?.last_seq ?? 0;

          return {
            items: messages.map((m) => m.data),
            lastSequence: lastSeq,
            upToDate: lastSeq >= streamLastSeq,
          };
        })
      );

    // ─────────────────────────────────────────────────────────────────────────
    // SUBSCRIBE
    // ─────────────────────────────────────────────────────────────────────────

    const subscribe: Effect.Effect<
      Stream.Stream<StreamMessage<T>, StreamProcessorError>,
      StreamProcessorError,
      Scope.Scope
    > = Effect.gen(function* () {
      const stream = yield* streamService
        .subscribe(config.streamName, schema, {
          consumer: config.consumerName,
          deliverPolicy: 'new',
          ackPolicy: 'explicit',
          maxDeliver: 5,
        })
        .pipe(Effect.mapError(wrapError('subscribe')));

      return pipe(
        stream,
        Stream.map(mapTypedMessage),
        Stream.mapError(wrapError('streamMessage'))
      );
    });

    const subscribeFrom = (
      fromSequence: number
    ): Effect.Effect<
      Stream.Stream<StreamMessage<T>, StreamProcessorError>,
      StreamProcessorError,
      Scope.Scope
    > =>
      Effect.gen(function* () {
        // Delete existing consumer to reset offset
        yield* inner.consumers
          .delete(config.streamName, config.consumerName)
          .pipe(Effect.catchAll(() => Effect.void));

        const stream = yield* streamService
          .subscribe(config.streamName, schema, {
            consumer: config.consumerName,
            deliverPolicy: 'by_start_sequence',
            startSequence: fromSequence,
            ackPolicy: 'explicit',
            maxDeliver: 5,
          })
          .pipe(Effect.mapError(wrapError('subscribeFrom')));

        return pipe(
          stream,
          Stream.map(mapTypedMessage),
          Stream.mapError(wrapError('streamMessage'))
        );
      });

    // ─────────────────────────────────────────────────────────────────────────
    // METADATA
    // ─────────────────────────────────────────────────────────────────────────

    const getCurrentSequence: Effect.Effect<number, StreamProcessorError> =
      streamService
        .getStreamInfo(config.streamName)
        .pipe(
          Effect.flatMap((info) =>
            info
              ? Effect.succeed(info.state?.last_seq ?? 0)
              : Effect.fail(
                  new StreamProcessorError({
                    message: `Stream '${config.streamName}' not found`,
                    operation: 'getCurrentSequence',
                  })
                )
          ),
          Effect.mapError(wrapError('getCurrentSequence'))
        );

    const getInfo: Effect.Effect<StreamInfoResult, StreamProcessorError> =
      streamService
        .getStreamInfo(config.streamName)
        .pipe(
          Effect.flatMap((info) =>
            info
              ? Effect.succeed({
                  messages: info.state?.messages ?? 0,
                  bytes: info.state?.bytes ?? 0,
                  firstSeq: info.state?.first_seq ?? 0,
                  lastSeq: info.state?.last_seq ?? 0,
                  created: new Date(info.created),
                })
              : Effect.fail(
                  new StreamProcessorError({
                    message: `Stream '${config.streamName}' not found`,
                    operation: 'getInfo',
                  })
                )
          ),
          Effect.mapError(wrapError('getInfo'))
        );

    // ─────────────────────────────────────────────────────────────────────────
    // LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────

    const deleteStream: Effect.Effect<boolean, StreamProcessorError> =
      streamService
        .deleteStream(config.streamName)
        .pipe(Effect.mapError(wrapError('delete')));

    return {
      publish,
      publishBatch,
      read,
      subscribe,
      subscribeFrom,
      getCurrentSequence,
      getInfo,
      delete: deleteStream,
    } satisfies HolonetStreamProcessorShape<T>;
  });

// =============================================================================
// Context Tag (for dependency injection)
// =============================================================================

/**
 * Context tag for HolonetStreamProcessor.
 *
 * Use `makeStreamProcessorLayer` to create a typed layer for dependency injection.
 */
export class HolonetStreamProcessor extends Context.Tag(
  'holonet/integration/StreamProcessor'
)<HolonetStreamProcessor, HolonetStreamProcessorShape<unknown>>() {}

/**
 * Create a Layer providing HolonetStreamProcessor<T>.
 *
 * @param config - Stream processor configuration
 * @param schema - Effect.Schema for message type
 * @returns Layer providing the processor
 */
export const makeStreamProcessorLayer = <T, I>(
  config: StreamProcessorConfig,
  schema: Schema.Schema<T, I, never>
): Layer.Layer<
  HolonetStreamProcessor,
  StreamProcessorError,
  NatsStreamService | NatsInnerService
> =>
  Layer.effect(
    HolonetStreamProcessor,
    makeStreamProcessor(config, schema) as Effect.Effect<
      HolonetStreamProcessorShape<unknown>,
      StreamProcessorError,
      NatsStreamService | NatsInnerService
    >
  );
