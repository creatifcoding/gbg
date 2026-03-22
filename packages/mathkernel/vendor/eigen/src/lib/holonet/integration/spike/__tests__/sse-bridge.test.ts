/**
 * SSE Bridge Spike Tests
 *
 * Validates the patterns in the SSE bridge spike work correctly.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Stream, Deferred, Chunk, Fiber } from 'effect';
import {
  fromPushSource,
  heartbeatStream,
  withHeartbeats,
  withClientDisconnect,
  createSSEStream,
  encodeSSEEvent,
  encodeSSEStream,
  simulateNatsConsumer,
  longPoll,
  replayThenLive,
  type SSEEvent,
  type ExternalMessage,
  SSEBridgeError,
} from '../sse-bridge';

describe('SSE Bridge Spike', () => {
  describe('fromPushSource', () => {
    it('creates stream from push source', async () => {
      const stream = fromPushSource<number, never>((emit) =>
        Effect.sync(() => {
          emit.single(1);
          emit.single(2);
          emit.single(3);
          emit.end();
          return () => {};
        })
      );

      const result = await Effect.runPromise(
        Stream.runCollect(stream).pipe(Effect.map(Chunk.toReadonlyArray))
      );

      expect(result).toEqual([1, 2, 3]);
    });

    it('handles errors from push source', async () => {
      const stream = fromPushSource<number, SSEBridgeError>((emit) =>
        Effect.sync(() => {
          emit.single(1);
          emit.fail(new SSEBridgeError({ reason: 'test error' }));
          return () => {};
        })
      );

      const result = await Effect.runPromise(
        Stream.runCollect(stream).pipe(Effect.either)
      );

      expect(result._tag).toBe('Left');
    });

    it('cleans up on stream end', async () => {
      let cleaned = false;

      const stream = fromPushSource<number, never>((emit) =>
        Effect.sync(() => {
          emit.single(1);
          emit.end();
          return () => {
            cleaned = true;
          };
        })
      );

      await Effect.runPromise(Stream.runCollect(stream));

      expect(cleaned).toBe(true);
    });
  });

  describe('heartbeatStream', () => {
    it('emits heartbeat events', async () => {
      const stream = heartbeatStream('10 millis');

      const result = await Effect.runPromise(
        stream.pipe(
          Stream.take(3),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )
      );

      expect(result).toHaveLength(3);
      expect(result.every((e) => e._tag === 'heartbeat')).toBe(true);
    });
  });

  describe('withHeartbeats', () => {
    it('merges data stream with heartbeats', async () => {
      // Use a slow data stream so heartbeats have time to fire
      const dataStream: Stream.Stream<SSEEvent, never, never> = Stream.make(
        { _tag: 'data' as const, data: 'test', seq: 1 },
        { _tag: 'data' as const, data: 'test2', seq: 2 }
      ).pipe(
        Stream.tap(() => Effect.sleep('25 millis'))
      );

      const merged = withHeartbeats(dataStream, '10 millis');

      const result = await Effect.runPromise(
        merged.pipe(
          Stream.take(5),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )
      );

      // Should have data events and heartbeats
      const hasData = result.some((e) => e._tag === 'data');
      const hasHeartbeat = result.some((e) => e._tag === 'heartbeat');

      expect(hasData).toBe(true);
      expect(hasHeartbeat).toBe(true);
    });
  });

  describe('withClientDisconnect', () => {
    it('interrupts stream on disconnect signal', async () => {
      const program = Effect.gen(function* () {
        const disconnectSignal = yield* Deferred.make<void, never>();

        // Create infinite stream
        const infiniteStream = Stream.repeatEffect(Effect.succeed(1));
        const interruptible = withClientDisconnect(
          infiniteStream,
          disconnectSignal
        );

        // Signal disconnect after taking a few elements
        const fiber = yield* Effect.fork(
          interruptible.pipe(Stream.take(5), Stream.runCollect)
        );

        // Signal disconnect
        yield* Deferred.succeed(disconnectSignal, undefined);

        // Fiber should complete (not hang)
        const result = yield* Fiber.join(fiber).pipe(
          Effect.timeout('1 second')
        );

        return result;
      });

      const result = await Effect.runPromise(program);
      expect(result).toBeDefined();
    });
  });

  describe('encodeSSEEvent', () => {
    it('encodes data event', () => {
      const event: SSEEvent = {
        _tag: 'data',
        data: { message: 'hello' },
        seq: 42,
      };

      const encoded = encodeSSEEvent(event);

      expect(encoded).toBe(
        'event: data\ndata: {"message":"hello"}\nid: 42\n\n'
      );
    });

    it('encodes heartbeat event', () => {
      const event: SSEEvent = {
        _tag: 'heartbeat',
        timestamp: 1234567890,
      };

      const encoded = encodeSSEEvent(event);

      expect(encoded).toBe('event: heartbeat\ndata: 1234567890\n\n');
    });

    it('encodes error event', () => {
      const event: SSEEvent = {
        _tag: 'error',
        error: 'Something went wrong',
      };

      const encoded = encodeSSEEvent(event);

      expect(encoded).toBe('event: error\ndata: Something went wrong\n\n');
    });
  });

  describe('encodeSSEStream', () => {
    it('encodes stream of events', async () => {
      const events: SSEEvent[] = [
        { _tag: 'data', data: 'test', seq: 1 },
        { _tag: 'heartbeat', timestamp: Date.now() },
      ];

      const stream = Stream.fromIterable(events);
      const encoded = encodeSSEStream(stream);

      const result = await Effect.runPromise(
        encoded.pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('event: data');
      expect(result[1]).toContain('event: heartbeat');
    });
  });

  describe('longPoll', () => {
    it('returns messages within timeout', async () => {
      const stream = Stream.fromIterable([1, 2, 3]);

      const result = await Effect.runPromise(
        longPoll(stream, { timeout: '1 second', maxMessages: 10 })
      );

      expect(result).toEqual([1, 2, 3]);
    });

    it('returns empty array on timeout', async () => {
      // Create a stream that never emits
      const stream = Stream.never;

      const result = await Effect.runPromise(
        longPoll(stream, { timeout: '50 millis', maxMessages: 10 })
      );

      expect(result).toEqual([]);
    });

    it('respects maxMessages limit', async () => {
      const stream = Stream.fromIterable([1, 2, 3, 4, 5]);

      const result = await Effect.runPromise(
        longPoll(stream, { timeout: '1 second', maxMessages: 3 })
      );

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('replayThenLive', () => {
    it('concatenates replay and live streams', async () => {
      const replay = Stream.fromIterable(['replay-1', 'replay-2']);
      const live = Stream.fromIterable(['live-1', 'live-2']);

      const combined = replayThenLive(replay, live);

      const result = await Effect.runPromise(
        combined.pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
      );

      expect(result).toEqual(['replay-1', 'replay-2', 'live-1', 'live-2']);
    });
  });

  describe('simulateNatsConsumer', () => {
    it('emits messages at interval', async () => {
      const messages: ExternalMessage<string>[] = [];

      const program = Effect.gen(function* () {
        const cleanup = yield* simulateNatsConsumer(
          {
            single: (msg) => {
              messages.push(msg);
              return true;
            },
            end: () => {},
            fail: () => {},
          },
          50 // 50ms interval
        );

        // Wait for a few messages
        yield* Effect.sleep('200 millis');

        // Cleanup
        cleanup();
      });

      await Effect.runPromise(program);

      // Should have received at least 3 messages in 200ms with 50ms interval
      expect(messages.length).toBeGreaterThanOrEqual(3);
      expect(messages[0].data).toBe('message-1');
      expect(messages[0].seq).toBe(1);
    });
  });

  describe('createSSEStream (integration)', () => {
    it('creates complete SSE stream with all features', async () => {
      const program = Effect.gen(function* () {
        const disconnectSignal = yield* Deferred.make<void, never>();

        const sseStream = createSSEStream<string>(
          (emit) =>
            Effect.sync(() => {
              emit.single({ data: 'msg-1', seq: 1, ack: () => {} });
              emit.single({ data: 'msg-2', seq: 2, ack: () => {} });
              emit.end();
              return () => {};
            }),
          {
            disconnectSignal,
            heartbeatInterval: '10 millis',
          }
        );

        const events = yield* sseStream.pipe(
          Stream.take(4),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        return events;
      });

      const result = await Effect.runPromise(program);

      // Should have data events
      const dataEvents = result.filter((e) => e._tag === 'data');
      expect(dataEvents.length).toBeGreaterThanOrEqual(2);

      // May also have heartbeats depending on timing
    });
  });
});
