/**
 * ConnectionBus Orchestrator Service
 *
 * Unified service combining NatsPort and DurableStreamsPort
 * with intelligent routing and stream management.
 *
 * @module connection-ports/services/ConnectionBus
 */

import { Context, Effect, Layer, Stream, Schema, Ref } from 'effect';
import { NatsPort, type NatsPortShape } from './NatsPort';
import { DurableStreamsPort, type DurableStreamsPortShape } from './DurableStreamsPort';
import { ConnectionPortsStatus, PortStatus, StreamStatus } from '../schemas/status';
import {
  ConnectionBusNotInitializedError,
  type NatsError,
  type DurableStreamsError,
} from '../schemas/errors';

// =============================================================================
// Subscription Options
// =============================================================================

/**
 * Options for stream subscription.
 */
export interface SubscribeOptions {
  /** Enable historical replay from durable streams */
  readonly replay?: boolean;

  /** Starting offset for replay (default: 'earliest') */
  readonly fromOffset?: string;

  /** Prefer NATS for live updates even with replay enabled */
  readonly preferNats?: boolean;

  /** Buffer size for stream processing */
  readonly bufferSize?: number;
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * ConnectionBus service interface.
 * Orchestrates NATS and Durable Streams for unified data access.
 */
export interface ConnectionBusShape {
  /**
   * Get aggregate status of all ports.
   */
  readonly status: Effect.Effect<ConnectionPortsStatus>;

  /**
   * Subscribe to a stream with optional replay.
   * Automatically routes to NATS or Durable Streams based on options.
   */
  readonly subscribe: <A>(
    streamId: string,
    schema: Schema.Schema<A>,
    options?: SubscribeOptions
  ) => Stream.Stream<A, NatsError | DurableStreamsError>;

  /**
   * Publish a message to a stream.
   * Uses NATS for live distribution, optionally appends to durable stream.
   */
  readonly publish: <A>(
    streamId: string,
    value: A,
    schema: Schema.Schema<A>,
    durable?: boolean
  ) => Effect.Effect<void, NatsError | DurableStreamsError>;

  /**
   * Get direct access to NatsPort.
   */
  readonly nats: () => NatsPortShape;

  /**
   * Get direct access to DurableStreamsPort.
   */
  readonly durable: () => DurableStreamsPortShape;

  /**
   * Initialize connections to all ports.
   */
  readonly connect: Effect.Effect<void, NatsError | DurableStreamsError>;

  /**
   * Disconnect from all ports.
   */
  readonly disconnect: Effect.Effect<void>;

  /**
   * Check if bus is fully connected.
   */
  readonly isConnected: Effect.Effect<boolean>;

  /**
   * Get status of a specific stream subscription.
   */
  readonly getStreamStatus: (
    streamId: string
  ) => Effect.Effect<StreamStatus | null>;
}

// =============================================================================
// Context Tag
// =============================================================================

export class ConnectionBus extends Context.Tag('tmnl/ports/ConnectionBus')<
  ConnectionBus,
  ConnectionBusShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

/**
 * ConnectionBus implementation layer.
 * Combines NatsPort and DurableStreamsPort with intelligent routing.
 */
export const ConnectionBusLive = Layer.effect(
  ConnectionBus,
  Effect.gen(function* () {
    const natsPort = yield* NatsPort;
    const durablePort = yield* DurableStreamsPort;

    // Track active stream subscriptions
    const streamStatuses = yield* Ref.make<Map<string, StreamStatus>>(new Map());

    const updateStreamStatus = (streamId: string, updater: (s: StreamStatus) => StreamStatus) =>
      Ref.update(streamStatuses, (map) => {
        const current = map.get(streamId) ?? StreamStatus.empty(streamId);
        const updated = updater(current);
        const next = new Map(map);
        next.set(streamId, updated);
        return next;
      });

    return {
      status: Effect.gen(function* () {
        const natsStatus = yield* natsPort.status;
        const durableStatus = yield* durablePort.status;
        const streams = yield* Ref.get(streamStatuses);

        return new ConnectionPortsStatus({
          nats: natsStatus,
          durableStreams: durableStatus,
          streams: Object.fromEntries(streams),
          updatedAt: new Date(),
        });
      }).pipe(Effect.withSpan('ConnectionBus.status')),

      subscribe: <A>(
        streamId: string,
        schema: Schema.Schema<A>,
        options: SubscribeOptions = {}
      ) => {
        const { replay = false, fromOffset = 'earliest', preferNats = false } = options;

        // Track subscription state
        const trackMessage = (data: A) =>
          updateStreamStatus(streamId, (s) =>
            s.withMessage(JSON.stringify(data).length)
          );

        if (replay && !preferNats) {
          // Use durable streams for replay + live tail
          return Stream.unwrap(
            Effect.gen(function* () {
              yield* updateStreamStatus(streamId, (s) => s.withState('subscribing'));

              const durableStreamUrl = `streams/${streamId}`;

              return durablePort
                .catchUpAndTail(durableStreamUrl, fromOffset, schema)
                .pipe(
                  Stream.map(({ data }) => data),
                  Stream.tap((data) => trackMessage(data)),
                  Stream.tapError((e) =>
                    updateStreamStatus(streamId, (s) => s.withError(String(e)))
                  ),
                  Stream.onStart(
                    updateStreamStatus(streamId, (s) => s.withState('active'))
                  ),
                  Stream.ensuring(
                    updateStreamStatus(streamId, (s) => s.withState('closed'))
                  )
                );
            })
          );
        }

        // Use NATS for live-only subscription
        return Stream.unwrap(
          Effect.gen(function* () {
            yield* updateStreamStatus(streamId, (s) => s.withState('subscribing'));

            return natsPort.subscribe(streamId, schema).pipe(
              Stream.tap((data) => trackMessage(data)),
              Stream.tapError((e) =>
                updateStreamStatus(streamId, (s) => s.withError(String(e)))
              ),
              Stream.onStart(
                updateStreamStatus(streamId, (s) => s.withState('active'))
              ),
              Stream.ensuring(
                updateStreamStatus(streamId, (s) => s.withState('closed'))
              )
            );
          })
        );
      },

      publish: <A>(
        streamId: string,
        value: A,
        schema: Schema.Schema<A>,
        durable = false
      ) =>
        Effect.gen(function* () {
          // Always publish to NATS for live distribution
          yield* natsPort.publish(streamId, value, schema);

          // Optionally append to durable stream for persistence
          if (durable) {
            const durableStreamUrl = `streams/${streamId}`;
            yield* durablePort.append(durableStreamUrl, value, schema);
          }
        }).pipe(Effect.withSpan('ConnectionBus.publish', { attributes: { streamId, durable } })),

      nats: () => natsPort,

      durable: () => durablePort,

      connect: Effect.gen(function* () {
        yield* Effect.all([natsPort.connect, durablePort.connect], {
          concurrency: 2,
        });
      }).pipe(Effect.withSpan('ConnectionBus.connect')),

      disconnect: Effect.gen(function* () {
        yield* Effect.all([natsPort.disconnect, durablePort.disconnect], {
          concurrency: 2,
        });
      }).pipe(Effect.withSpan('ConnectionBus.disconnect')),

      isConnected: Effect.gen(function* () {
        const natsStatus = yield* natsPort.status;
        const durableStatus = yield* durablePort.status;
        return natsStatus.isConnected() && durableStatus.isConnected();
      }),

      getStreamStatus: (streamId: string) =>
        Effect.gen(function* () {
          const statuses = yield* Ref.get(streamStatuses);
          return statuses.get(streamId) ?? null;
        }),
    } satisfies ConnectionBusShape;
  })
);

// =============================================================================
// Combined Layer
// =============================================================================

/**
 * Complete ConnectionBus layer with all dependencies.
 */
export const ConnectionBusComplete = ConnectionBusLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      // Import these from their modules
      Layer.effect(NatsPort, Effect.gen(function* () {
        const { NatsPortMock } = yield* Effect.promise(() =>
          import('./NatsPort').then((m) => ({ NatsPortMock: m.NatsPortMock }))
        );
        // This is a workaround - in practice, use NatsPortLive directly
        return yield* Effect.fail(new Error('Use ConnectionBusWithPorts instead'));
      })),
      Layer.effect(DurableStreamsPort, Effect.gen(function* () {
        return yield* Effect.fail(new Error('Use ConnectionBusWithPorts instead'));
      }))
    )
  )
);
