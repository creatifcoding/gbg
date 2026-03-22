/**
 * NatsPort Effect.Service
 *
 * Effect service wrapper for NATS operations including
 * subscriptions, publishing, and KV operations.
 *
 * @module connection-ports/services/NatsPort
 */

import { Context, Effect, Layer, Stream, Schema, Ref, Queue } from 'effect';
import type { NatsConfig, NatsSubject } from '../schemas/connection';
import { PortStatus } from '../schemas/status';
import {
  NatsConnectionError,
  NatsSubscriptionError,
  NatsPublishError,
  NatsKvError,
} from '../schemas/errors';

// =============================================================================
// Service Interface
// =============================================================================

/**
 * NatsPort service interface.
 * Provides NATS operations with Effect-based error handling.
 */
export interface NatsPortShape {
  /**
   * Get current port status.
   */
  readonly status: Effect.Effect<PortStatus>;

  /**
   * Subscribe to a NATS subject.
   * Returns a Stream of decoded messages.
   */
  readonly subscribe: <A>(
    subject: string,
    schema: Schema.Schema<A>
  ) => Stream.Stream<A, NatsSubscriptionError>;

  /**
   * Publish a message to a NATS subject.
   */
  readonly publish: <A>(
    subject: string,
    value: A,
    schema: Schema.Schema<A>
  ) => Effect.Effect<void, NatsPublishError>;

  /**
   * Request-reply pattern.
   */
  readonly request: <Req, Res>(
    subject: string,
    value: Req,
    requestSchema: Schema.Schema<Req>,
    responseSchema: Schema.Schema<Res>,
    timeoutMs?: number
  ) => Effect.Effect<Res, NatsPublishError>;

  /**
   * Get a value from a KV bucket.
   */
  readonly kvGet: <A>(
    bucket: string,
    key: string,
    schema: Schema.Schema<A>
  ) => Effect.Effect<A | null, NatsKvError>;

  /**
   * Put a value into a KV bucket.
   */
  readonly kvPut: <A>(
    bucket: string,
    key: string,
    value: A,
    schema: Schema.Schema<A>
  ) => Effect.Effect<void, NatsKvError>;

  /**
   * Delete a key from a KV bucket.
   */
  readonly kvDelete: (
    bucket: string,
    key: string
  ) => Effect.Effect<void, NatsKvError>;

  /**
   * Watch a KV bucket for changes.
   */
  readonly kvWatch: <A>(
    bucket: string,
    keyPattern: string,
    schema: Schema.Schema<A>
  ) => Stream.Stream<{ key: string; value: A | null; operation: 'put' | 'delete' }, NatsKvError>;

  /**
   * Connect to NATS server.
   */
  readonly connect: Effect.Effect<void, NatsConnectionError>;

  /**
   * Disconnect from NATS server.
   */
  readonly disconnect: Effect.Effect<void>;
}

// =============================================================================
// Context Tag
// =============================================================================

export class NatsPort extends Context.Tag('tmnl/ports/NatsPort')<
  NatsPort,
  NatsPortShape
>() {}

// =============================================================================
// Configuration Tag
// =============================================================================

export class NatsPortConfig extends Context.Tag('tmnl/ports/NatsPortConfig')<
  NatsPortConfig,
  NatsConfig
>() {}

// =============================================================================
// Mock Implementation (for development without NATS)
// =============================================================================

/**
 * Mock NatsPort implementation for development.
 * Simulates NATS behavior without actual connection.
 */
export const NatsPortMock = Layer.effect(
  NatsPort,
  Effect.gen(function* () {
    const statusRef = yield* Ref.make(PortStatus.Disconnected);

    // Simulated message queues per subject
    const messageQueues = new Map<string, Queue.Queue<unknown>>();

    const getQueue = (subject: string) =>
      Effect.gen(function* () {
        let queue = messageQueues.get(subject);
        if (!queue) {
          queue = yield* Queue.unbounded<unknown>();
          messageQueues.set(subject, queue);
        }
        return queue;
      });

    return {
      status: Ref.get(statusRef),

      subscribe: <A>(subject: string, schema: Schema.Schema<A>) =>
        Stream.async<A, NatsSubscriptionError>((emit) => {
          const interval = setInterval(() => {
            // Simulate periodic messages in mock mode
          }, 1000);

          return Effect.sync(() => {
            clearInterval(interval);
          });
        }),

      publish: <A>(subject: string, value: A, schema: Schema.Schema<A>) =>
        Effect.gen(function* () {
          const encoded = yield* Schema.encode(schema)(value);
          const queue = yield* getQueue(subject);
          yield* Queue.offer(queue, encoded);
        }).pipe(
          Effect.mapError(
            (cause) =>
              new NatsPublishError({
                subject,
                message: 'Failed to publish message',
                cause,
              })
          )
        ),

      request: <Req, Res>(
        subject: string,
        value: Req,
        requestSchema: Schema.Schema<Req>,
        responseSchema: Schema.Schema<Res>,
        timeoutMs = 5000
      ) =>
        Effect.fail(
          new NatsPublishError({
            subject,
            message: 'Request-reply not implemented in mock',
          })
        ),

      kvGet: <A>(bucket: string, key: string, schema: Schema.Schema<A>) =>
        Effect.succeed(null as A | null),

      kvPut: <A>(bucket: string, key: string, value: A, schema: Schema.Schema<A>) =>
        Effect.void,

      kvDelete: (bucket: string, key: string) => Effect.void,

      kvWatch: <A>(bucket: string, keyPattern: string, schema: Schema.Schema<A>) =>
        Stream.empty,

      connect: Effect.gen(function* () {
        yield* Effect.sleep('100 millis');
        yield* Ref.set(statusRef, PortStatus.Disconnected.withState('connected'));
      }).pipe(Effect.withSpan('NatsPort.connect.mock')),

      disconnect: Effect.gen(function* () {
        yield* Ref.set(statusRef, PortStatus.Disconnected);
      }),
    } satisfies NatsPortShape;
  })
);

// =============================================================================
// Default Layer (uses mock for now)
// =============================================================================

/**
 * Default NatsPort layer.
 * Uses mock implementation until real NATS integration is available.
 */
export const NatsPortLive = NatsPortMock;
