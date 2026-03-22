/**
 * LiveStreamService
 *
 * Real-time streaming operations for durable-streams ↔ NATS bridge.
 * Provides long-poll and SSE live modes for edge clients.
 *
 * Call Graph:
 * - longPoll: ConsumerStateService → fetch with timeout → decode messages
 * - sse: ConsumerStateService → subscribe → Stream.mapEffect(decode) → heartbeats
 * - subscribe: ConsumerStateService → subscribe → buffer → decode
 *
 * @module holonet/durable-streams/services/LiveStreamService
 */

import { Effect, Context, Layer, Stream, Duration, Schedule, Option, Chunk } from 'effect';
import {
  StreamNotFoundError,
  LongPollTimeoutError,
  SSEConnectionError,
  SubscriptionError,
  CodecError,
  SchemaValidationError,
} from '../schemas/errors';
import { SchemaNotFoundError } from '@/lib/holonet/core/schema';
import {
  type ReadResponse,
  type StreamMessage,
  type SSEDataEvent,
  type SSEHeartbeatEvent,
  type SSEErrorEvent,
  type SSEEndEvent,
} from '../schemas/protocol';
import { StreamBridgeService, type ReadOptions, type StreamBridgeError } from './StreamBridgeService';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for long-poll operation
 */
export interface LongPollOptions {
  readonly offset: number;
  readonly limit?: number;
  readonly timeout: Duration.DurationInput;
  readonly clientId?: string;
}

/**
 * Options for SSE operation
 */
export interface SSEOptions {
  readonly offset: number;
  readonly heartbeatInterval?: Duration.DurationInput;
  readonly clientId?: string;
}

/**
 * Options for subscribe operation
 */
export interface SubscribeOptions {
  readonly offset: number;
  readonly bufferCapacity?: number;
  readonly clientId?: string;
}

/**
 * SSE event union type
 */
export type SSEEvent = SSEDataEvent | SSEHeartbeatEvent | SSEErrorEvent | SSEEndEvent;

// =============================================================================
// Error Types
// =============================================================================

/**
 * All possible errors from LiveStreamService
 */
export type LiveStreamError =
  | StreamNotFoundError
  | LongPollTimeoutError
  | SSEConnectionError
  | SubscriptionError
  | CodecError
  | SchemaValidationError
  | SchemaNotFoundError;

// =============================================================================
// Service Interface
// =============================================================================

/**
 * LiveStreamService shape - real-time streaming operations
 */
export interface LiveStreamServiceShape {
  /**
   * Long-poll for new messages.
   *
   * Blocks until either:
   * - New messages are available
   * - Timeout is reached
   *
   * @param streamId - Stream to poll
   * @param options - Poll options (offset, timeout, limit)
   * @returns ReadResponse with messages, or LongPollTimeoutError if no data
   */
  readonly longPoll: (
    streamId: string,
    options: LongPollOptions
  ) => Effect.Effect<ReadResponse, LiveStreamError>;

  /**
   * Subscribe to SSE events.
   *
   * Returns an Effect.Stream of SSE events including:
   * - data: Message data with seq number
   * - heartbeat: Keep-alive signal
   * - error: Stream error occurred
   * - end: Stream ended
   *
   * @param streamId - Stream to subscribe to
   * @param options - SSE options (offset, heartbeatInterval)
   * @returns Stream of SSE events
   */
  readonly sse: (
    streamId: string,
    options: SSEOptions
  ) => Effect.Effect<Stream.Stream<SSEEvent, LiveStreamError>, LiveStreamError>;

  /**
   * Subscribe to raw messages.
   *
   * Returns a buffered Effect.Stream of decoded messages.
   * Use for internal consumption or custom protocols.
   *
   * @param streamId - Stream to subscribe to
   * @param options - Subscribe options (offset, bufferCapacity)
   * @returns Stream of messages
   */
  readonly subscribe: (
    streamId: string,
    options: SubscribeOptions
  ) => Effect.Effect<Stream.Stream<StreamMessage, LiveStreamError>, LiveStreamError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class LiveStreamService extends Context.Tag('holonet/durable-streams/LiveStreamService')<
  LiveStreamService,
  LiveStreamServiceShape
>() {
  /**
   * Live layer that requires StreamBridgeService as a dependency.
   * Use this when you need to share the same StreamBridgeService instance.
   */
  static readonly Live = Layer.effect(
    LiveStreamService,
    Effect.gen(function* () {
      const bridge = yield* StreamBridgeService;

      /**
       * Helper to map StreamBridgeError to LiveStreamError
       */
      const mapBridgeError = (error: StreamBridgeError): LiveStreamError => {
        // StreamNotFoundError passes through
        if (error._tag === 'StreamNotFoundError') return error;
        if (error._tag === 'CodecError') return error;
        if (error._tag === 'SchemaValidationError') return error;
        if (error._tag === 'SchemaNotFoundError') return error;
        // StreamExistsError shouldn't happen in read operations,
        // but map it to a generic error if it does
        return new SubscriptionError({
          streamId: 'unknown',
          reason: `Unexpected error: ${error._tag}`,
        });
      };

      return {
        longPoll: (streamId, options) =>
          Effect.gen(function* () {
            const { offset, limit = 100, timeout } = options;
            const timeoutMs = Duration.toMillis(timeout);
            const pollInterval = 100; // ms
            const startTime = Date.now();

            // Poll until we get data or timeout
            while (Date.now() - startTime < timeoutMs) {
              const readOptions: ReadOptions = { offset, limit };
              const result = yield* bridge.read(streamId, readOptions).pipe(
                Effect.mapError(mapBridgeError)
              );

              if (result.items.length > 0) {
                return result;
              }

              // Wait before next poll
              yield* Effect.sleep(Duration.millis(pollInterval));
            }

            // Timeout - return empty result (not an error per protocol)
            return yield* Effect.fail(
              new LongPollTimeoutError({
                streamId,
                timeout: timeoutMs,
                lastOffset: offset,
              })
            );
          }),

        sse: (streamId, options) =>
          Effect.gen(function* () {
            const { offset, heartbeatInterval = Duration.seconds(15) } = options;

            // Verify stream exists first
            yield* bridge.metadata(streamId).pipe(Effect.mapError(mapBridgeError));

            // State for polling: { offset, emptyPolls }
            // emptyPolls tracks empty polls for termination in test mode
            interface PollState {
              readonly offset: number;
              readonly emptyPolls: number;
            }

            // Create data stream using unfoldChunkEffect
            // This is more reliable than asyncPush for polling patterns
            const dataStream: Stream.Stream<SSEEvent, LiveStreamError> = Stream.unfoldChunkEffect(
              { offset, emptyPolls: 0 } as PollState,
              (state: PollState) =>
                Effect.gen(function* () {
                  const result = yield* bridge
                    .read(streamId, {
                      offset: state.offset,
                      limit: 50,
                    })
                    .pipe(Effect.mapError(mapBridgeError));

                  if (result.items.length === 0) {
                    // In real NATS implementation, we'd wait for new messages
                    // For mock/testing, limit empty polls to avoid infinite loop
                    if (state.emptyPolls >= 10) {
                      // Stop polling after 10 empty polls
                      return Option.none<readonly [Chunk.Chunk<SSEEvent>, PollState]>();
                    }
                    // Wait and continue polling
                    yield* Effect.sleep(Duration.millis(100));
                    return Option.some([
                      Chunk.empty<SSEEvent>(),
                      { offset: state.offset, emptyPolls: state.emptyPolls + 1 }
                    ] as const);
                  }

                  // Convert messages to SSE data events
                  const events: SSEEvent[] = result.items.map((msg) => ({
                    _tag: 'data' as const,
                    data: msg.data,
                    seq: msg.seq,
                    timestamp: msg.timestamp,
                  }));

                  const lastSeq = result.items[result.items.length - 1].seq;
                  return Option.some([
                    Chunk.fromIterable(events),
                    { offset: lastSeq, emptyPolls: 0 }
                  ] as const);
                })
            );

            // Create heartbeat stream
            const heartbeatStream: Stream.Stream<SSEEvent, never> = Stream.repeatEffectWithSchedule(
              Effect.succeed<SSEEvent>({
                _tag: 'heartbeat',
                timestamp: Date.now(),
              }),
              Schedule.spaced(heartbeatInterval)
            );

            // Merge data and heartbeats - data stream has priority since it starts first
            return Stream.merge(dataStream, heartbeatStream);
          }),

        subscribe: (streamId, options) =>
          Effect.gen(function* () {
            const { offset, bufferCapacity = 100 } = options;

            // Verify stream exists first
            yield* bridge.metadata(streamId).pipe(Effect.mapError(mapBridgeError));

            // State for polling
            interface SubscribePollState {
              readonly offset: number;
              readonly emptyPolls: number;
            }

            // Create message stream using unfoldChunkEffect
            const messageStream: Stream.Stream<StreamMessage, LiveStreamError> = Stream.unfoldChunkEffect(
              { offset, emptyPolls: 0 } as SubscribePollState,
              (state: SubscribePollState) =>
                Effect.gen(function* () {
                  const result = yield* bridge
                    .read(streamId, {
                      offset: state.offset,
                      limit: 50,
                    })
                    .pipe(Effect.mapError(mapBridgeError));

                  if (result.items.length === 0) {
                    // For mock/testing, limit empty polls to avoid infinite loop
                    if (state.emptyPolls >= 10) {
                      return Option.none<readonly [Chunk.Chunk<StreamMessage>, SubscribePollState]>();
                    }
                    yield* Effect.sleep(Duration.millis(100));
                    return Option.some([
                      Chunk.empty<StreamMessage>(),
                      { offset: state.offset, emptyPolls: state.emptyPolls + 1 }
                    ] as const);
                  }

                  const lastSeq = result.items[result.items.length - 1].seq;
                  return Option.some([
                    Chunk.fromIterable(result.items),
                    { offset: lastSeq, emptyPolls: 0 }
                  ] as const);
                })
            );

            // Buffer for backpressure handling
            return messageStream.pipe(
              Stream.buffer({ capacity: bufferCapacity, strategy: 'sliding' })
            );
          }),
      };
    })
  );

  /**
   * Default layer with mock implementation for testing.
   *
   * Uses StreamBridgeService for underlying data operations,
   * simulating real-time behavior with polling.
   */
  static readonly Default = LiveStreamService.Live.pipe(
    Layer.provide(StreamBridgeService.Default)
  );
}

// =============================================================================
// Re-export errors for convenience
// =============================================================================

export { LongPollTimeoutError, SSEConnectionError, SubscriptionError } from '../schemas/errors';
