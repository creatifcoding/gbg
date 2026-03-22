/**
 * LiveStreamService Tests
 *
 * Tests for real-time streaming operations.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Stream, Duration, Layer } from 'effect';
import {
  LiveStreamService,
  LongPollTimeoutError,
  type LongPollOptions,
  type SSEOptions,
  type SubscribeOptions,
  type SSEEvent,
} from '../LiveStreamService';
import { StreamBridgeService } from '../StreamBridgeService';
import type { ReadResponse, StreamMessage } from '../../schemas/protocol';

// =============================================================================
// Test Layer
// =============================================================================

/**
 * Each test gets a fresh layer to avoid state pollution.
 *
 * We need to provide both LiveStreamService and StreamBridgeService to tests.
 * The key is that they must share the SAME StreamBridgeService instance.
 *
 * Layer composition:
 * 1. Create StreamBridgeService.Default (shared)
 * 2. Create LiveStreamService.Live that uses the shared bridge
 * 3. Merge both so tests can access either service
 */
const getTestLayer = () => {
  // Create the shared bridge layer
  const bridgeLayer = StreamBridgeService.Default;

  // Create LiveStreamService that uses the shared bridge
  const liveLayer = LiveStreamService.Live.pipe(Layer.provide(bridgeLayer));

  // Merge both layers so tests can access either service
  return Layer.mergeAll(bridgeLayer, liveLayer);
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Setup a stream with messages for testing
 */
const setupStreamWithMessages = (streamId: string, messageCount: number) =>
  Effect.gen(function* () {
    const bridge = yield* StreamBridgeService;

    yield* bridge.create(streamId, { contentType: 'application/json' });

    const seqs: number[] = [];
    for (let i = 1; i <= messageCount; i++) {
      const result = yield* bridge.append(streamId, { n: i, msg: `Message ${i}` });
      seqs.push(result.seq);
    }

    return seqs;
  });

/**
 * Collect N items from a stream
 */
const collectN = <A, E>(stream: Stream.Stream<A, E>, n: number) =>
  stream.pipe(Stream.take(n), Stream.runCollect, Effect.map((chunk) => [...chunk]));

// =============================================================================
// Tests
// =============================================================================

describe('LiveStreamService', () => {
  describe('longPoll', () => {
    it('returns immediately when data is available', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const bridge = yield* StreamBridgeService;

        // Setup stream with data
        yield* bridge.create('poll-stream', { contentType: 'application/json' });
        yield* bridge.append('poll-stream', { event: 'test' });

        const options: LongPollOptions = {
          offset: 0,
          timeout: Duration.seconds(5),
        };

        const result: ReadResponse = yield* live.longPoll('poll-stream', options);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].data).toEqual({ event: 'test' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns all available messages up to limit', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('multi-poll-stream', 5);

        const result = yield* live.longPoll('multi-poll-stream', {
          offset: 0,
          limit: 10,
          timeout: Duration.seconds(5),
        });

        expect(result.items).toHaveLength(5);
        expect(result.items[4].data).toEqual({ n: 5, msg: 'Message 5' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('respects limit parameter', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('limited-poll-stream', 10);

        const result = yield* live.longPoll('limited-poll-stream', {
          offset: 0,
          limit: 3,
          timeout: Duration.seconds(5),
        });

        expect(result.items).toHaveLength(3);
        expect(result.upToDate).toBe(false);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('times out when no data available', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const bridge = yield* StreamBridgeService;

        // Create empty stream
        yield* bridge.create('empty-poll-stream', { contentType: 'application/json' });

        const options: LongPollOptions = {
          offset: 0,
          timeout: Duration.millis(200), // Short timeout for test
        };

        const result = yield* live.longPoll('empty-poll-stream', options).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(LongPollTimeoutError);
          expect((result.left as LongPollTimeoutError).streamId).toBe('empty-poll-stream');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;

        const result = yield* live
          .longPoll('nonexistent-stream', {
            offset: 0,
            timeout: Duration.seconds(1),
          })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('StreamNotFoundError');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('reads from specific offset', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const seqs = yield* setupStreamWithMessages('offset-poll-stream', 5);

        // Read from offset after first 2 messages
        const result = yield* live.longPoll('offset-poll-stream', {
          offset: seqs[1], // After second message
          timeout: Duration.seconds(5),
        });

        expect(result.items).toHaveLength(3);
        expect(result.items[0].data).toEqual({ n: 3, msg: 'Message 3' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('sse', () => {
    it('returns stream for existing stream', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('sse-stream', { contentType: 'application/json' });
        yield* bridge.append('sse-stream', { event: 'test1' });

        const options: SSEOptions = { offset: 0 };
        const sseStream = yield* live.sse('sse-stream', options);

        // Collect first event (should be data event)
        const events = yield* collectN(sseStream, 1);

        expect(events).toHaveLength(1);
        expect(events[0]._tag).toBe('data');
        if (events[0]._tag === 'data') {
          expect(events[0].data).toEqual({ event: 'test1' });
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('emits multiple data events', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('multi-sse-stream', 3);

        const sseStream = yield* live.sse('multi-sse-stream', { offset: 0 });

        // Collect 3 data events
        const events = yield* collectN(sseStream, 3);

        const dataEvents = events.filter((e): e is Extract<SSEEvent, { _tag: 'data' }> => e._tag === 'data');
        expect(dataEvents).toHaveLength(3);
        expect(dataEvents[0].seq).toBeGreaterThan(0);
        expect(dataEvents[2].data).toEqual({ n: 3, msg: 'Message 3' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;

        const result = yield* live.sse('nonexistent-sse-stream', { offset: 0 }).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('StreamNotFoundError');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('starts from specified offset', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const seqs = yield* setupStreamWithMessages('offset-sse-stream', 5);

        // Start from after message 2
        const sseStream = yield* live.sse('offset-sse-stream', { offset: seqs[1] });

        const events = yield* collectN(sseStream, 3);
        const dataEvents = events.filter((e): e is Extract<SSEEvent, { _tag: 'data' }> => e._tag === 'data');

        expect(dataEvents).toHaveLength(3);
        expect(dataEvents[0].data).toEqual({ n: 3, msg: 'Message 3' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('subscribe', () => {
    it('returns buffered message stream', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('sub-stream', { contentType: 'application/json' });
        yield* bridge.append('sub-stream', { msg: 'test' });

        const options: SubscribeOptions = { offset: 0 };
        const msgStream = yield* live.subscribe('sub-stream', options);

        const messages = yield* collectN(msgStream, 1);

        expect(messages).toHaveLength(1);
        expect(messages[0].data).toEqual({ msg: 'test' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns StreamMessage objects', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('msg-stream', 2);

        const msgStream = yield* live.subscribe('msg-stream', { offset: 0 });
        const messages: StreamMessage[] = yield* collectN(msgStream, 2);

        expect(messages).toHaveLength(2);
        // Check StreamMessage shape
        expect(messages[0]).toHaveProperty('seq');
        expect(messages[0]).toHaveProperty('data');
        expect(messages[0]).toHaveProperty('timestamp');
        expect(messages[0].seq).toBeGreaterThan(0);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;

        const result = yield* live.subscribe('nonexistent-sub-stream', { offset: 0 }).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('StreamNotFoundError');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('respects buffer capacity option', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('buffered-stream', 5);

        // Use custom buffer capacity
        const msgStream = yield* live.subscribe('buffered-stream', {
          offset: 0,
          bufferCapacity: 50,
        });

        const messages = yield* collectN(msgStream, 5);
        expect(messages).toHaveLength(5);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('starts from specified offset', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        const seqs = yield* setupStreamWithMessages('offset-sub-stream', 5);

        // Start from after message 3
        const msgStream = yield* live.subscribe('offset-sub-stream', { offset: seqs[2] });

        const messages = yield* collectN(msgStream, 2);

        expect(messages).toHaveLength(2);
        expect(messages[0].data).toEqual({ n: 4, msg: 'Message 4' });
        expect(messages[1].data).toEqual({ n: 5, msg: 'Message 5' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('integration', () => {
    it('longPoll and subscribe return consistent data', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('consistency-stream', 3);

        // Get via longPoll
        const pollResult = yield* live.longPoll('consistency-stream', {
          offset: 0,
          timeout: Duration.seconds(5),
        });

        // Get via subscribe
        const subStream = yield* live.subscribe('consistency-stream', { offset: 0 });
        const subMessages = yield* collectN(subStream, 3);

        // Compare
        expect(pollResult.items).toHaveLength(subMessages.length);
        for (let i = 0; i < pollResult.items.length; i++) {
          expect(pollResult.items[i].seq).toBe(subMessages[i].seq);
          expect(pollResult.items[i].data).toEqual(subMessages[i].data);
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('SSE data events match subscribe messages', () =>
      Effect.gen(function* () {
        const live = yield* LiveStreamService;
        yield* setupStreamWithMessages('sse-sub-stream', 2);

        // Get via SSE
        const sseStream = yield* live.sse('sse-sub-stream', { offset: 0 });
        const sseEvents = yield* collectN(sseStream, 2);
        const sseData = sseEvents
          .filter((e): e is Extract<SSEEvent, { _tag: 'data' }> => e._tag === 'data')
          .map((e) => e.data);

        // Get via subscribe
        const subStream = yield* live.subscribe('sse-sub-stream', { offset: 0 });
        const subMessages = yield* collectN(subStream, 2);
        const subData = subMessages.map((m) => m.data);

        // Compare
        expect(sseData).toEqual(subData);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });
});
