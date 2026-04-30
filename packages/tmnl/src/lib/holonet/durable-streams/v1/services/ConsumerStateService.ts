/**
 * ConsumerStateService
 *
 * Manages client consumer state for durable-streams.
 * Maps streamId + clientId to NATS durable consumers for offset tracking.
 *
 * Key responsibilities:
 * - Create/get durable consumers per client
 * - Track acknowledged offset (handled automatically by NATS consumer)
 * - Support reading from specific offsets on reconnection
 *
 * @module holonet/durable-streams/services/ConsumerStateService
 */

import { Effect, Data } from 'effect';
import type { Consumer } from 'nats.ws';

import { NatsInnerService } from '@/lib/holonet/nats/inner';

// =============================================================================
// Types
// =============================================================================

/**
 * Consumer state information
 */
export interface ConsumerState {
  /** Stream ID this consumer is attached to */
  readonly streamId: string;
  /** Client ID that owns this consumer */
  readonly clientId: string;
  /** Consumer name in NATS */
  readonly consumerName: string;
  /** Last acknowledged stream sequence */
  readonly ackFloorSeq: number;
  /** Last delivered stream sequence */
  readonly deliveredSeq: number;
  /** Number of pending (unacked) messages */
  readonly numPending: number;
  /** Number of redelivered messages */
  readonly numRedelivered: number;
}

/**
 * Options for creating/getting a consumer
 */
export interface ConsumerOptions {
  /** Starting offset (stream sequence). -1 = earliest, undefined = latest */
  readonly fromOffset?: number;
  /** Max messages in flight before ack required */
  readonly maxAckPending?: number;
  /** Ack wait timeout in ms (default: 30000) */
  readonly ackWait?: number;
  /** Max redelivery attempts (default: 3) */
  readonly maxDeliver?: number;
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when consumer operations fail
 */
export class ConsumerStateError extends Data.TaggedError('ConsumerStateError')<{
  readonly operation: 'get' | 'create' | 'info' | 'delete';
  readonly streamId: string;
  readonly clientId?: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Error when consumer not found
 */
export class ConsumerNotFoundError extends Data.TaggedError('ConsumerNotFoundError')<{
  readonly streamId: string;
  readonly clientId: string;
  readonly consumerName: string;
}> {}

// =============================================================================
// Service Interface
// =============================================================================

export interface ConsumerStateServiceShape {
  /**
   * Get or create a durable consumer for a client.
   *
   * Creates a consumer named `ds-{streamId}-{clientId}` that persists
   * across client reconnections.
   *
   * @param streamId - Stream identifier
   * @param clientId - Client identifier (from auth token or session)
   * @param opts - Consumer options (offset, ack settings)
   * @returns NATS Consumer handle
   */
  readonly getOrCreateConsumer: (
    streamId: string,
    clientId: string,
    opts?: ConsumerOptions
  ) => Effect.Effect<Consumer, ConsumerStateError>;

  /**
   * Get consumer state/info.
   *
   * @param streamId - Stream identifier
   * @param clientId - Client identifier
   * @returns Consumer state with offset information
   */
  readonly getState: (
    streamId: string,
    clientId: string
  ) => Effect.Effect<ConsumerState, ConsumerStateError | ConsumerNotFoundError>;

  /**
   * Get the last acknowledged offset for a consumer.
   *
   * @param streamId - Stream identifier
   * @param clientId - Client identifier
   * @returns Last acknowledged stream sequence
   */
  readonly getOffset: (
    streamId: string,
    clientId: string
  ) => Effect.Effect<number, ConsumerStateError | ConsumerNotFoundError>;

  /**
   * Delete a consumer (cleanup on client disconnect or session end).
   *
   * @param streamId - Stream identifier
   * @param clientId - Client identifier
   */
  readonly deleteConsumer: (
    streamId: string,
    clientId: string
  ) => Effect.Effect<void, ConsumerStateError>;

  /**
   * Generate consumer name from streamId and clientId.
   */
  readonly consumerName: (streamId: string, clientId: string) => string;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Generate a NATS-safe consumer name from stream and client IDs.
 * NATS consumer names must be alphanumeric with dashes/underscores.
 */
const makeConsumerName = (streamId: string, clientId: string): string =>
  `ds-${sanitizeName(streamId)}-${sanitizeName(clientId)}`;

/**
 * Sanitize a name for NATS (alphanumeric, dash, underscore only)
 */
const sanitizeName = (name: string): string =>
  name.replace(/[^a-zA-Z0-9_-]/g, '_');

export class ConsumerStateService extends Effect.Service<ConsumerStateService>()(
  'holonet/durable-streams/ConsumerStateService',
  {
    // Note: Don't use dependencies: [NatsInnerService.Default] here
    // as it auto-merges and prevents mocking in tests.
    // Instead, require NatsInnerService to be provided via layer composition.
    effect: Effect.gen(function* () {
      const inner = yield* NatsInnerService;

      // ─────────────────────────────────────────────────────────────────────────
      // getOrCreateConsumer
      // ─────────────────────────────────────────────────────────────────────────

      const getOrCreateConsumer = (
        streamId: string,
        clientId: string,
        opts?: ConsumerOptions
      ): Effect.Effect<Consumer, ConsumerStateError> =>
        Effect.gen(function* () {
          const name = makeConsumerName(streamId, clientId);

          // Try to get existing consumer first
          const existing = yield* inner.consumers.get(streamId, name).pipe(
            Effect.either
          );

          if (existing._tag === 'Right') {
            return existing.right;
          }

          // Create new consumer with specified options
          // Note: For now, we create consumers with 'new' or 'all' policy.
          // The 'by_start_sequence' policy requires extending NatsInnerService.
          const deliverPolicy = opts?.fromOffset === -1
            ? 'all' as const
            : 'new' as const;

          yield* inner.consumers.add(streamId, {
            durableName: name,
            deliverPolicy,
            ackPolicy: 'explicit',
            maxAckPending: opts?.maxAckPending ?? 100,
            ackWait: opts?.ackWait ?? 30000,
            maxDeliver: opts?.maxDeliver ?? 3,
          }).pipe(
            Effect.mapError(
              (err) =>
                new ConsumerStateError({
                  operation: 'create',
                  streamId,
                  clientId,
                  reason: `Failed to create consumer '${name}'`,
                  cause: err,
                })
            )
          );

          // Get the newly created consumer
          return yield* inner.consumers.get(streamId, name).pipe(
            Effect.mapError(
              (err) =>
                new ConsumerStateError({
                  operation: 'get',
                  streamId,
                  clientId,
                  reason: `Failed to get consumer '${name}' after creation`,
                  cause: err,
                })
            )
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // getState
      // ─────────────────────────────────────────────────────────────────────────

      const getState = (
        streamId: string,
        clientId: string
      ): Effect.Effect<ConsumerState, ConsumerStateError | ConsumerNotFoundError> =>
        Effect.gen(function* () {
          const name = makeConsumerName(streamId, clientId);

          const consumer = yield* inner.consumers.get(streamId, name).pipe(
            Effect.mapError(
              (err) =>
                // Check for NATS "consumer not found" error
                err._tag === 'Inner/Consumers/Get' &&
                String(err.cause).includes('consumer not found')
                  ? new ConsumerNotFoundError({
                      streamId,
                      clientId,
                      consumerName: name,
                    })
                  : new ConsumerStateError({
                      operation: 'info',
                      streamId,
                      clientId,
                      reason: `Failed to get consumer '${name}'`,
                      cause: err,
                    })
            )
          );

          // Get consumer info for state details
          const info = yield* Effect.tryPromise({
            try: () => consumer.info(),
            catch: (err) =>
              new ConsumerStateError({
                operation: 'info',
                streamId,
                clientId,
                reason: `Failed to get consumer info for '${name}'`,
                cause: err,
              }),
          });

          return {
            streamId,
            clientId,
            consumerName: name,
            ackFloorSeq: info.ack_floor?.stream_seq ?? 0,
            deliveredSeq: info.delivered?.stream_seq ?? 0,
            numPending: info.num_pending ?? 0,
            numRedelivered: info.num_redelivered ?? 0,
          };
        });

      // ─────────────────────────────────────────────────────────────────────────
      // getOffset
      // ─────────────────────────────────────────────────────────────────────────

      const getOffset = (
        streamId: string,
        clientId: string
      ): Effect.Effect<number, ConsumerStateError | ConsumerNotFoundError> =>
        getState(streamId, clientId).pipe(
          Effect.map((state) => state.ackFloorSeq)
        );

      // ─────────────────────────────────────────────────────────────────────────
      // deleteConsumer
      // ─────────────────────────────────────────────────────────────────────────

      const deleteConsumer = (
        streamId: string,
        clientId: string
      ): Effect.Effect<void, ConsumerStateError> =>
        Effect.gen(function* () {
          const name = makeConsumerName(streamId, clientId);

          yield* inner.consumers.delete(streamId, name).pipe(
            // Don't fail if consumer doesn't exist (check error message)
            Effect.catchAll((err) =>
              String(err.cause).includes('consumer not found')
                ? Effect.void
                : Effect.fail(
                    new ConsumerStateError({
                      operation: 'delete',
                      streamId,
                      clientId,
                      reason: `Failed to delete consumer '${name}'`,
                      cause: err,
                    })
                  )
            )
          );
        });

      // ─────────────────────────────────────────────────────────────────────────
      // consumerName
      // ─────────────────────────────────────────────────────────────────────────

      const consumerName = (streamId: string, clientId: string): string =>
        makeConsumerName(streamId, clientId);

      return {
        getOrCreateConsumer,
        getState,
        getOffset,
        deleteConsumer,
        consumerName,
      } satisfies ConsumerStateServiceShape;
    }),
  }
) {}
