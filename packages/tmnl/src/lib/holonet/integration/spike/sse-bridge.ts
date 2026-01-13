/**
 * SSE Bridge Spike
 *
 * Proves that Stream.asyncPush can bridge external push sources to Effect.Stream for SSE.
 * This is a spike file - patterns proven here will be formalized into services.
 *
 * Key patterns demonstrated:
 * - Stream.asyncPush with emit.single() for push-based sources
 * - Sliding buffer strategy for slow consumers (drops old messages)
 * - Stream.interruptWhen for client disconnect cleanup
 * - Stream.merge + Stream.schedule for heartbeats
 * - Effect.acquireRelease for cleanup on stream termination
 *
 * @module holonet/integration/spike/sse-bridge
 */

import {
  Effect,
  Stream,
  Schedule,
  Deferred,
  Chunk,
  Duration,
  Data,
  pipe,
} from 'effect';

// =============================================================================
// Types
// =============================================================================

/**
 * SSE Event types following durable-streams protocol
 */
export type SSEEvent =
  | { readonly _tag: 'data'; readonly data: unknown; readonly seq: number }
  | { readonly _tag: 'heartbeat'; readonly timestamp: number }
  | { readonly _tag: 'error'; readonly error: string };

/**
 * Message from external source (e.g., NATS consumer)
 */
export interface ExternalMessage<A> {
  readonly data: A;
  readonly seq: number;
  readonly ack: () => void;
}

/**
 * Errors that can occur in the SSE bridge
 */
export class SSEBridgeError extends Data.TaggedError('SSEBridgeError')<{
  readonly reason: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Core Pattern: Stream.asyncPush → SSE Bridge
// =============================================================================

/**
 * Creates an Effect.Stream from an external push-based source.
 *
 * This demonstrates the core pattern for bridging NATS consumers to SSE:
 * 1. Use Stream.asyncPush to create a stream from a push source
 * 2. Use Effect.acquireRelease for cleanup on stream end
 * 3. Use emit.single() to push messages
 * 4. Use emit.end() to signal stream termination
 *
 * @param subscribe - Function that sets up the subscription and returns cleanup
 * @param options - Buffer configuration
 */
export const fromPushSource = <A, E = never>(
  subscribe: (emit: {
    single: (value: A) => boolean;
    end: () => void;
    fail: (error: E) => void;
  }) => Effect.Effect<() => void, E, never>
): Stream.Stream<A, E, never> =>
  Stream.asyncPush<A, E>(
    (emit) =>
      Effect.acquireRelease(
        // Acquire: Set up subscription
        Effect.gen(function* () {
          const cleanup = yield* subscribe({
            single: (value) => emit.single(value),
            end: () => emit.end(),
            fail: (error) => emit.fail(error),
          });
          return cleanup;
        }),
        // Release: Clean up subscription
        (cleanup) => Effect.sync(() => cleanup())
      ),
    { bufferSize: 100, strategy: 'sliding' }
  );

// =============================================================================
// Pattern: Heartbeat Stream
// =============================================================================

/**
 * Creates a stream that emits heartbeat events at regular intervals.
 *
 * Used to keep SSE connections alive and detect stale connections.
 */
export const heartbeatStream = (
  interval: Duration.DurationInput = '15 seconds'
): Stream.Stream<SSEEvent, never, never> =>
  Stream.repeatEffect(
    Effect.sync(
      (): SSEEvent => ({
        _tag: 'heartbeat',
        timestamp: Date.now(),
      })
    )
  ).pipe(Stream.schedule(Schedule.spaced(interval)));

// =============================================================================
// Pattern: Merge with Heartbeats
// =============================================================================

/**
 * Merges a data stream with heartbeats.
 *
 * Uses haltStrategy: 'left' so heartbeats don't keep the stream alive
 * after the data stream ends.
 */
export const withHeartbeats = <A, E, R>(
  dataStream: Stream.Stream<SSEEvent, E, R>,
  heartbeatInterval: Duration.DurationInput = '15 seconds'
): Stream.Stream<SSEEvent, E, R> =>
  Stream.merge(dataStream, heartbeatStream(heartbeatInterval), {
    haltStrategy: 'left',
  });

// =============================================================================
// Pattern: Client Disconnect Handling
// =============================================================================

/**
 * Interrupts the stream when a disconnect signal is received.
 *
 * In HTTP handlers, you would signal the Deferred when the client disconnects.
 */
export const withClientDisconnect = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  disconnectSignal: Deferred.Deferred<void, never>
): Stream.Stream<A, E, R> =>
  stream.pipe(Stream.interruptWhen(Deferred.await(disconnectSignal)));

// =============================================================================
// Pattern: Complete SSE Stream Factory
// =============================================================================

/**
 * Creates a complete SSE stream with heartbeats and disconnect handling.
 *
 * This is the full pattern for SSE in durable-streams:
 * 1. Data stream from external source (NATS)
 * 2. Buffer with sliding strategy for slow consumers
 * 3. Merged with heartbeats
 * 4. Interrupted on client disconnect
 */
export const createSSEStream = <A>(
  subscribe: (emit: {
    single: (value: ExternalMessage<A>) => boolean;
    end: () => void;
    fail: (error: SSEBridgeError) => void;
  }) => Effect.Effect<() => void, SSEBridgeError, never>,
  options: {
    readonly heartbeatInterval?: Duration.DurationInput;
    readonly disconnectSignal: Deferred.Deferred<void, never>;
  }
): Stream.Stream<SSEEvent, SSEBridgeError, never> => {
  // Create data stream from push source
  const dataStream = fromPushSource<ExternalMessage<A>, SSEBridgeError>(
    subscribe
  ).pipe(
    // Transform to SSE events
    Stream.map(
      (msg): SSEEvent => ({
        _tag: 'data',
        data: msg.data,
        seq: msg.seq,
      })
    ),
    // Buffer with sliding strategy
    Stream.buffer({ capacity: 100, strategy: 'sliding' })
  );

  // Add heartbeats and disconnect handling
  return pipe(
    dataStream,
    (s) => withHeartbeats(s, options.heartbeatInterval ?? '15 seconds'),
    (s) => withClientDisconnect(s, options.disconnectSignal)
  );
};

// =============================================================================
// Pattern: SSE Encoding
// =============================================================================

/**
 * Encodes SSE events to the text/event-stream format.
 */
export const encodeSSEEvent = (event: SSEEvent): string => {
  switch (event._tag) {
    case 'data':
      return `event: data\ndata: ${JSON.stringify(event.data)}\nid: ${event.seq}\n\n`;
    case 'heartbeat':
      return `event: heartbeat\ndata: ${event.timestamp}\n\n`;
    case 'error':
      return `event: error\ndata: ${event.error}\n\n`;
  }
};

/**
 * Encodes a stream of SSE events to text/event-stream format.
 */
export const encodeSSEStream = <E, R>(
  stream: Stream.Stream<SSEEvent, E, R>
): Stream.Stream<string, E, R> => stream.pipe(Stream.map(encodeSSEEvent));

// =============================================================================
// Spike: Simulated NATS Consumer Bridge
// =============================================================================

/**
 * Simulates a NATS consumer for testing the SSE bridge pattern.
 *
 * In production, this would be replaced with actual NATS consumer.subscribe()
 */
export const simulateNatsConsumer = (
  emit: {
    single: (value: ExternalMessage<string>) => boolean;
    end: () => void;
    fail: (error: SSEBridgeError) => void;
  },
  messageInterval = 1000
): Effect.Effect<() => void, never, never> =>
  Effect.sync(() => {
    let seq = 0;
    const interval = setInterval(() => {
      seq++;
      emit.single({
        data: `message-${seq}`,
        seq,
        ack: () => {
          /* simulated ack */
        },
      });
    }, messageInterval);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  });

// =============================================================================
// Spike: Demo Program
// =============================================================================

/**
 * Demo program that proves the SSE bridge pattern works.
 *
 * Run with: Effect.runPromise(demoSSEBridge)
 */
export const demoSSEBridge = Effect.gen(function* () {
  // Create disconnect signal
  const disconnectSignal = yield* Deferred.make<void, never>();

  // Create SSE stream with simulated NATS consumer
  const sseStream = createSSEStream<string>(
    (emit) =>
      simulateNatsConsumer(
        {
          single: (msg) => emit.single(msg),
          end: () => emit.end(),
          fail: (e) => emit.fail(e),
        },
        500
      ),
    {
      disconnectSignal,
      heartbeatInterval: '2 seconds',
    }
  );

  // Encode as SSE text
  const textStream = encodeSSEStream(sseStream);

  // Collect first 10 events
  const events = yield* textStream.pipe(Stream.take(10), Stream.runCollect);

  // Simulate client disconnect
  yield* Deferred.succeed(disconnectSignal, undefined);

  return Chunk.toReadonlyArray(events);
});

// =============================================================================
// Spike: Long-Poll Pattern
// =============================================================================

/**
 * Long-poll pattern: fetch with timeout.
 *
 * If no messages arrive within timeout, returns empty array.
 * Otherwise, returns buffered messages.
 */
export const longPoll = <A, E, R>(
  stream: Stream.Stream<A, E, R>,
  options: {
    readonly timeout: Duration.DurationInput;
    readonly maxMessages?: number;
  }
): Effect.Effect<ReadonlyArray<A>, E, R> =>
  stream.pipe(
    Stream.take(options.maxMessages ?? 100),
    // Timeout on the stream - returns Option.none() on timeout
    Stream.timeoutTo(options.timeout, Stream.empty),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );

// =============================================================================
// Spike: Replay + Live Pattern
// =============================================================================

/**
 * Combines replay (historical) stream with live stream.
 *
 * Used for SSE clients that reconnect with an offset - they first
 * receive missed messages, then switch to live stream.
 */
export const replayThenLive = <A, E, R>(
  replayStream: Stream.Stream<A, E, R>,
  liveStream: Stream.Stream<A, E, R>
): Stream.Stream<A, E, R> => Stream.concat(replayStream, liveStream);
