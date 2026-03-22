/**
 * NATS Stream Service
 *
 * High-level service for JetStream stream operations with Schema codecs.
 * Provides typed publish/subscribe operations on top of NatsInnerService.
 *
 * Features:
 * - Stream management (ensure, info, delete)
 * - Schema-typed publish with JetStream acknowledgment
 * - Schema-typed subscribe with consumer management
 * - Pull-based consumption with fetch/next operations
 * - Scoped streams with proper cleanup
 *
 * @module holonet/nats/stream
 */

import { Effect, Stream, Schema, Scope, pipe } from 'effect';
import type {
  StreamInfo,
  Consumer,
  ConsumerMessages,
  PubAck,
  JsMsg,
} from 'nats.ws';

import {
  NatsInnerService,
  type StreamConfigInput,
  type ConsumerConfigInput,
} from './inner';
import { Inner, Stream as StreamErrors, Codec } from './errors';
import { NatsCodec } from './codec';
import { fromAsyncIterable } from '../utils/stream';

// =============================================================================
// Type Definitions
// =============================================================================

/** Typed JetStream message */
export interface TypedJsMessage<A> {
  /** Subject the message was published to */
  readonly subject: string;
  /** Decoded message data */
  readonly data: A;
  /** Stream sequence number */
  readonly seq: number;
  /** Message timestamp */
  readonly time: Date;
  /** Acknowledge the message */
  readonly ack: () => Effect.Effect<void>;
  /** Negative acknowledge (redelivery) */
  readonly nak: (delay?: number) => Effect.Effect<void>;
  /** Indicate message is being worked on */
  readonly working: () => Effect.Effect<void>;
  /** Terminate redelivery */
  readonly term: (reason?: string) => Effect.Effect<void>;
}

/** Options for publish operation */
export interface PublishOptions {
  /** Message ID for deduplication */
  readonly msgId?: string;
  /** Expected stream name */
  readonly expectStream?: string;
  /** Expected last message ID */
  readonly expectLastMsgId?: string;
  /** Expected last sequence number */
  readonly expectLastSequence?: number;
}

/** Options for subscribe operation */
export interface SubscribeOptions {
  /** Consumer name (creates durable if provided) */
  readonly consumer?: string;
  /** Filter subject (if different from subscription) */
  readonly filterSubject?: string;
  /** Multiple filter subjects */
  readonly filterSubjects?: readonly string[];
  /** Deliver policy */
  readonly deliverPolicy?:
    | 'all'
    | 'last'
    | 'new'
    | 'by_start_sequence'
    | 'by_start_time'
    | 'last_per_subject';
  /** Start sequence (for 'by_start_sequence') */
  readonly startSequence?: number;
  /** Start time (for 'by_start_time') */
  readonly startTime?: Date;
  /** Ack policy */
  readonly ackPolicy?: 'none' | 'all' | 'explicit';
  /** Max in-flight messages */
  readonly maxAckPending?: number;
  /** Ack wait duration in ms */
  readonly ackWait?: number;
  /** Max redelivery attempts */
  readonly maxDeliver?: number;
}

/** Options for fetch operation */
export interface FetchOptions {
  /** Max messages to fetch */
  readonly max?: number;
  /** Max bytes to fetch */
  readonly maxBytes?: number;
  /** Timeout in ms */
  readonly expires?: number;
  /** Idle heartbeat in ms */
  readonly idleHeartbeat?: number;
}

// =============================================================================
// Service Shape
// =============================================================================

export interface NatsStreamServiceShape {
  // ─── Stream Management ───────────────────────────────────────────────────────

  /**
   * Ensure a stream exists, creating it if necessary.
   *
   * @param config - Stream configuration
   * @returns StreamInfo for existing or newly created stream
   */
  readonly ensureStream: (
    config: StreamConfigInput
  ) => Effect.Effect<StreamInfo, StreamErrors.EnsureStreamError>;

  /**
   * Get stream info.
   *
   * @param streamName - Name of the stream
   * @returns StreamInfo or null if not found
   */
  readonly getStreamInfo: (
    streamName: string
  ) => Effect.Effect<StreamInfo | null, Inner.Streams.InfoError>;

  /**
   * Delete a stream.
   *
   * @param streamName - Name of the stream
   * @returns true if deleted
   */
  readonly deleteStream: (
    streamName: string
  ) => Effect.Effect<boolean, Inner.Streams.DeleteError>;

  // ─── Publishing ──────────────────────────────────────────────────────────────

  /**
   * Publish a typed message to JetStream.
   *
   * @param subject - Subject to publish to
   * @param schema - Schema for encoding
   * @param data - Data to publish
   * @param opts - Publish options
   * @returns PubAck with sequence number and stream name
   */
  readonly publish: <A, I, R>(
    subject: string,
    schema: Schema.Schema<A, I, R>,
    data: A,
    opts?: PublishOptions
  ) => Effect.Effect<PubAck, StreamErrors.PublishError, R>;

  // ─── Subscribing ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to a stream with typed messages.
   *
   * Returns a scoped stream that automatically manages consumer lifecycle.
   *
   * @param streamName - Name of the stream
   * @param schema - Schema for decoding messages
   * @param opts - Subscribe options
   * @returns Scoped Effect containing Stream of typed messages
   */
  readonly subscribe: <A, I, R>(
    streamName: string,
    schema: Schema.Schema<A, I, R>,
    opts?: SubscribeOptions
  ) => Effect.Effect<
    Stream.Stream<TypedJsMessage<A>, StreamErrors.SubscribeError, R>,
    Inner.Consumers.GetError | Inner.Consumers.AddError | Inner.Consumers.ConsumeError,
    Scope.Scope | R
  >;

  // ─── Pull-based Consumption ──────────────────────────────────────────────────

  /**
   * Get or create a consumer for pull-based consumption.
   *
   * @param streamName - Name of the stream
   * @param consumerName - Name of the consumer (for durable)
   * @param config - Optional consumer config
   * @returns Consumer handle
   */
  readonly getConsumer: (
    streamName: string,
    consumerName?: string,
    config?: ConsumerConfigInput
  ) => Effect.Effect<Consumer, Inner.Consumers.GetError | Inner.Consumers.AddError>;

  /**
   * Fetch a batch of typed messages from a consumer.
   *
   * @param consumer - Consumer handle
   * @param schema - Schema for decoding
   * @param opts - Fetch options
   * @returns Array of typed messages
   */
  readonly fetch: <A, I, R>(
    consumer: Consumer,
    schema: Schema.Schema<A, I, R>,
    opts?: FetchOptions
  ) => Effect.Effect<
    ReadonlyArray<TypedJsMessage<A>>,
    Inner.Consumers.ConsumeError | Codec.DecodeError,
    R
  >;

  /**
   * Get the next single message from a consumer.
   *
   * @param consumer - Consumer handle
   * @param schema - Schema for decoding
   * @param opts - Options (expires)
   * @returns Typed message or null if none available
   */
  readonly next: <A, I, R>(
    consumer: Consumer,
    schema: Schema.Schema<A, I, R>,
    opts?: { expires?: number }
  ) => Effect.Effect<
    TypedJsMessage<A> | null,
    Inner.Consumers.ConsumeError | Codec.DecodeError,
    R
  >;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NatsStreamService extends Effect.Service<NatsStreamService>()(
  'holonet/nats/Stream',
  {
    effect: Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      // ─────────────────────────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Decode a JsMsg to TypedJsMessage
       */
      const decodeMessage = <A, I, R>(
        msg: JsMsg,
        schema: Schema.Schema<A, I, R>
      ): Effect.Effect<TypedJsMessage<A>, Codec.DecodeError, R> =>
        pipe(
          NatsCodec.decodeJson(schema, {
            subject: msg.subject,
            seq: msg.seq,
          })(msg.data),
          Effect.map(
            (data): TypedJsMessage<A> => ({
              subject: msg.subject,
              data,
              seq: msg.seq,
              time: msg.info.timestampNanos
                ? new Date(Number(msg.info.timestampNanos) / 1_000_000)
                : new Date(),
              ack: () => Effect.sync(() => msg.ack()),
              nak: (delay?: number) =>
                Effect.sync(() => msg.nak(delay)),
              working: () => Effect.sync(() => msg.working()),
              term: (reason?: string) => Effect.sync(() => msg.term(reason)),
            })
          )
        );

      /**
       * Collect async iterator into array using Effect.promise wrapper.
       */
      const collectMessages = (
        messages: ConsumerMessages,
        limit?: number
      ): Effect.Effect<JsMsg[]> =>
        Effect.promise(async () => {
          const results: JsMsg[] = [];
          for await (const msg of messages) {
            results.push(msg);
            if (limit && results.length >= limit) break;
          }
          return results;
        });

      // ─────────────────────────────────────────────────────────────────────────
      // STREAM MANAGEMENT
      // ─────────────────────────────────────────────────────────────────────────

      const ensureStream = (
        config: StreamConfigInput
      ): Effect.Effect<StreamInfo, StreamErrors.EnsureStreamError> =>
        Effect.gen(function* () {
          // Check if stream exists
          const existing = yield* inner.streams.info(config.name);
          if (existing) {
            return existing;
          }

          // Create new stream
          return yield* inner.streams.add(config);
        });

      const getStreamInfo = (
        streamName: string
      ): Effect.Effect<StreamInfo | null, Inner.Streams.InfoError> =>
        inner.streams.info(streamName);

      const deleteStream = (
        streamName: string
      ): Effect.Effect<boolean, Inner.Streams.DeleteError> =>
        inner.streams.delete(streamName);

      // ─────────────────────────────────────────────────────────────────────────
      // PUBLISHING
      // ─────────────────────────────────────────────────────────────────────────

      const publish = <A, I, R>(
        subject: string,
        schema: Schema.Schema<A, I, R>,
        data: A,
        opts?: PublishOptions
      ): Effect.Effect<PubAck, StreamErrors.PublishError, R> =>
        Effect.gen(function* () {
          // Encode the data
          const bytes = yield* NatsCodec.encodeJson(schema, data);

          // Publish to JetStream
          return yield* inner.jsPublish(subject, bytes, {
            msgID: opts?.msgId,
            expect: {
              streamName: opts?.expectStream,
              lastMsgID: opts?.expectLastMsgId,
              lastSequence: opts?.expectLastSequence,
            },
          });
        });

      // ─────────────────────────────────────────────────────────────────────────
      // SUBSCRIBING
      // ─────────────────────────────────────────────────────────────────────────

      const subscribe = <A, I, R>(
        streamName: string,
        schema: Schema.Schema<A, I, R>,
        opts?: SubscribeOptions
      ): Effect.Effect<
        Stream.Stream<TypedJsMessage<A>, StreamErrors.SubscribeError, R>,
        Inner.Consumers.GetError | Inner.Consumers.AddError,
        Scope.Scope | R
      > =>
        Effect.gen(function* () {
          // Get or create consumer
          let consumer: Consumer;

          if (opts?.consumer) {
            // Try to get existing durable consumer
            const existingConsumer = yield* pipe(
              inner.consumers.get(streamName, opts.consumer),
              Effect.either
            );

            if (existingConsumer._tag === 'Right') {
              consumer = existingConsumer.right;
            } else {
              // Create new durable consumer
              const config: ConsumerConfigInput = {
                durableName: opts.consumer,
                filterSubject: opts?.filterSubject,
                filterSubjects: opts?.filterSubjects,
                deliverPolicy: opts?.deliverPolicy,
                ackPolicy: opts?.ackPolicy ?? 'explicit',
                maxAckPending: opts?.maxAckPending,
                ackWait: opts?.ackWait,
                maxDeliver: opts?.maxDeliver,
              };
              yield* inner.consumers.add(streamName, config);
              consumer = yield* inner.consumers.get(streamName, opts.consumer);
            }
          } else {
            // Create ephemeral consumer
            const config: ConsumerConfigInput = {
              filterSubject: opts?.filterSubject,
              filterSubjects: opts?.filterSubjects,
              deliverPolicy: opts?.deliverPolicy ?? 'new',
              ackPolicy: opts?.ackPolicy ?? 'explicit',
              maxAckPending: opts?.maxAckPending,
              ackWait: opts?.ackWait,
              maxDeliver: opts?.maxDeliver,
            };
            yield* inner.consumers.add(streamName, config);
            consumer = yield* inner.consumers.get(streamName);
          }

          // Start consuming
          const messages = yield* inner.consumers.consume(consumer);

          // Create stream from async iterator
          const rawStream = fromAsyncIterable<JsMsg, Inner.Consumers.ConsumeError>(
            messages,
            (err) =>
              new Inner.Consumers.ConsumeError({
                message: `Consumer iteration error on stream '${streamName}'`,
                streamName,
                cause: err,
              }),
            () => {
              messages.stop?.();
            }
          );

          // Map to typed messages
          return pipe(
            rawStream,
            Stream.mapEffect((msg) => decodeMessage(msg, schema))
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // PULL-BASED CONSUMPTION
      // ─────────────────────────────────────────────────────────────────────────

      const getConsumer = (
        streamName: string,
        consumerName?: string,
        config?: ConsumerConfigInput
      ): Effect.Effect<Consumer, Inner.Consumers.GetError | Inner.Consumers.AddError> =>
        Effect.gen(function* () {
          if (consumerName) {
            // Try to get existing durable consumer
            const existing = yield* pipe(
              inner.consumers.get(streamName, consumerName),
              Effect.either
            );

            if (existing._tag === 'Right') {
              return existing.right;
            }

            // Create new durable consumer
            const cfg: ConsumerConfigInput = {
              ...config,
              durableName: consumerName,
            };
            yield* inner.consumers.add(streamName, cfg);
            return yield* inner.consumers.get(streamName, consumerName);
          } else {
            // Create ephemeral consumer
            if (config) {
              yield* inner.consumers.add(streamName, config);
            }
            return yield* inner.consumers.get(streamName);
          }
        });

      const fetch = <A, I, R>(
        consumer: Consumer,
        schema: Schema.Schema<A, I, R>,
        opts?: FetchOptions
      ): Effect.Effect<
        ReadonlyArray<TypedJsMessage<A>>,
        Inner.Consumers.ConsumeError | Codec.DecodeError,
        R
      > =>
        Effect.gen(function* () {
          const messages = yield* inner.consumers.fetch(consumer, {
            max_messages: opts?.max ?? 100,
            max_bytes: opts?.maxBytes,
            expires: opts?.expires ?? 5000,
            idle_heartbeat: opts?.idleHeartbeat,
          });

          const rawMsgs = yield* collectMessages(messages, opts?.max);

          // Decode all messages
          const results: TypedJsMessage<A>[] = [];
          for (const msg of rawMsgs) {
            const typed = yield* decodeMessage(msg, schema);
            results.push(typed);
          }

          return results;
        });

      const next = <A, I, R>(
        consumer: Consumer,
        schema: Schema.Schema<A, I, R>,
        opts?: { expires?: number }
      ): Effect.Effect<
        TypedJsMessage<A> | null,
        Inner.Consumers.ConsumeError | Codec.DecodeError,
        R
      > =>
        Effect.gen(function* () {
          const msg = yield* inner.consumers.next(consumer, {
            expires: opts?.expires,
          });

          if (!msg) return null;

          return yield* decodeMessage(msg, schema);
        });

      return {
        ensureStream,
        getStreamInfo,
        deleteStream,
        publish,
        subscribe,
        getConsumer,
        fetch,
        next,
      } satisfies NatsStreamServiceShape;
    }),
    dependencies: [NatsInnerService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NatsStreamServiceLive = NatsStreamService.Default;
