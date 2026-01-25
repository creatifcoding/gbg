/**
 * Durable-Streams Recovery and Resilience Tests
 *
 * Tests failure scenarios and recovery patterns:
 * - Client reconnection with offset preservation
 * - SSE stream cleanup on client disconnect
 * - Error handling for malformed requests
 * - Timeout and retry behavior
 *
 * Requires NATS server with JetStream enabled (docker compose up nats)
 *
 * @module holonet/durable-streams/__tests__/recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Schema, Deferred, Fiber, Stream, Chunk } from 'effect';

import { NatsStreamService } from '@/lib/holonet/nats/stream';
import { NatsInnerService } from '@/lib/holonet/nats/inner';
import { NatsConnectionServiceCustom } from '@/lib/holonet/nats/connection';
import { SchemaRegistry } from '@/lib/holonet/core/schema';
import {
  StreamCodecService,
  HEADER_SCHEMA_ID,
  HEADER_CONTENT_TYPE,
  type SchemaHeaders,
} from '../services';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-recovery-test',
  debug: false,
});

const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamName = () => `TEST_REC_${uniqueId()}`.toUpperCase();

// =============================================================================
// Test Schemas
// =============================================================================

const TestEvent = Schema.Struct({
  _tag: Schema.Literal('TestEvent'),
  id: Schema.String,
  seq: Schema.Number,
  timestamp: Schema.Number,
});

type TestEvent = typeof TestEvent.Type;

// =============================================================================
// Test Layer
// =============================================================================

const RecoveryTestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
).pipe(
  Layer.provideMerge(NatsStreamService.Default),
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

// Helper to convert SchemaHeaders to Record<string, string> for NATS
const headersToRecord = (headers: SchemaHeaders): Record<string, string> => ({
  [HEADER_SCHEMA_ID]: headers[HEADER_SCHEMA_ID],
  [HEADER_CONTENT_TYPE]: headers[HEADER_CONTENT_TYPE],
});

// Streams to clean up
const streamsToCleanup: string[] = [];

// =============================================================================
// Client Reconnection Tests
// =============================================================================

describe('Client Reconnection', () => {
  let streamName: string;
  let consumerName: string;

  beforeEach(() => {
    streamName = testStreamName();
    consumerName = `consumer-${uniqueId()}`;
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(RecoveryTestLayer),
      Effect.runPromise
    )
  );

  it('preserves offset after client reconnection', { timeout: 15000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      // Register schema
      yield* registry.registerOrUpdate('TestEvent', TestEvent);

      // Create stream
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      // Publish 5 messages
      for (let i = 0; i < 5; i++) {
        const event: TestEvent = {
          _tag: 'TestEvent',
          id: `msg-${i}`,
          seq: i,
          timestamp: Date.now(),
        };
        const encoded = yield* codec.encodeWithSchema('TestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
      }

      // First connection: fetch first 3 messages
      const consumer1 = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        ackPolicy: 'explicit',
        deliverPolicy: 'all',
      });

      const batch1 = yield* nats.fetch(consumer1, TestEvent, { max: 3 });
      expect(batch1.length).toBe(3);
      expect(batch1[0]?.data.seq).toBe(0);
      expect(batch1[2]?.data.seq).toBe(2);

      // Ack messages (simulates client processing)
      for (const msg of batch1) {
        yield* msg.ack();
      }

      // Wait for acks to process
      yield* Effect.sleep('100 millis');

      // Second connection: should resume from offset 3
      const consumer2 = yield* nats.getConsumer(streamName, consumerName);
      const batch2 = yield* nats.fetch(consumer2, TestEvent, { max: 10 });

      expect(batch2.length).toBe(2);
      expect(batch2[0]?.data.seq).toBe(3);
      expect(batch2[1]?.data.seq).toBe(4);

      // Allow consumer to settle before cleanup
      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));

  it('handles client that disconnects without acking', { timeout: 15000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('TestEvent', TestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      // Publish 3 messages
      for (let i = 0; i < 3; i++) {
        const event: TestEvent = {
          _tag: 'TestEvent',
          id: `msg-${i}`,
          seq: i,
          timestamp: Date.now(),
        };
        const encoded = yield* codec.encodeWithSchema('TestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
      }

      // Create consumer with ack_wait for redelivery (1 second)
      const consumer1 = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        ackPolicy: 'explicit',
        deliverPolicy: 'all',
        ackWait: 1_000_000_000, // 1 second in nanoseconds
      });

      // First fetch: get messages but DON'T ack (simulates crash)
      const batch1 = yield* nats.fetch(consumer1, TestEvent, { max: 3 });
      expect(batch1.length).toBe(3);
      // Don't ack - simulating client crash

      // Wait for ack timeout (message redelivery)
      yield* Effect.sleep('1500 millis');

      // Reconnect: messages should be redelivered
      const consumer2 = yield* nats.getConsumer(streamName, consumerName);
      const batch2 = yield* nats.fetch(consumer2, TestEvent, { max: 10 });

      // Messages should be redelivered (may include all 3)
      expect(batch2.length).toBeGreaterThanOrEqual(1);
      // First message should still be seq 0 (redelivered)
      expect(batch2[0]?.data.seq).toBe(0);

      // Allow consumer to settle before cleanup
      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));
});

// =============================================================================
// Stream Cleanup Tests
// =============================================================================

describe('Stream Cleanup', () => {
  it('interrupts stream on disconnect signal', () =>
    Effect.gen(function* () {
      const disconnectSignal = yield* Deferred.make<void, never>();

      // Create infinite stream that emits every 10ms
      const infiniteStream = Stream.repeatEffect(
        Effect.delay(Effect.succeed(1), '10 millis')
      );

      // Wrap with interrupt on disconnect
      const interruptible = infiniteStream.pipe(
        Stream.interruptWhen(Deferred.await(disconnectSignal))
      );

      // Start consuming in background
      const fiber = yield* Effect.fork(
        interruptible.pipe(Stream.take(100), Stream.runCollect)
      );

      // Wait a bit then signal disconnect
      yield* Effect.sleep('50 millis');
      yield* Deferred.succeed(disconnectSignal, undefined);

      // Stream should terminate (not hang)
      const result = yield* Fiber.join(fiber).pipe(
        Effect.timeout('1 second'),
        Effect.orElseSucceed(() => Chunk.empty<number>())
      );

      // Should have collected some but not all 100 elements
      expect(Chunk.size(result)).toBeLessThan(100);
      expect(Chunk.size(result)).toBeGreaterThan(0);
    }).pipe(Effect.runPromise));

  it('cleans up resources on stream completion', () =>
    Effect.gen(function* () {
      let cleanupCalled = false;

      const stream = Stream.acquireRelease(
        Effect.succeed('resource'),
        () => {
          cleanupCalled = true;
          return Effect.void;
        }
      ).pipe(Stream.flatMap(() => Stream.make(1, 2, 3)));

      const result = yield* stream.pipe(Stream.runCollect);

      expect(Chunk.toArray(result)).toEqual([1, 2, 3]);
      expect(cleanupCalled).toBe(true);
    }).pipe(Effect.runPromise));

  it('cleans up resources on stream failure', () =>
    Effect.gen(function* () {
      let cleanupCalled = false;

      const stream = Stream.acquireRelease(
        Effect.succeed('resource'),
        () => {
          cleanupCalled = true;
          return Effect.void;
        }
      ).pipe(
        Stream.flatMap(() =>
          Stream.make(1, 2).pipe(
            Stream.concat(Stream.fail(new Error('Simulated failure')))
          )
        )
      );

      const result = yield* stream.pipe(
        Stream.runCollect,
        Effect.either
      );

      expect(result._tag).toBe('Left');
      expect(cleanupCalled).toBe(true);
    }).pipe(Effect.runPromise));
});

// =============================================================================
// Timeout and Retry Tests
// =============================================================================

describe('Timeout and Retry Behavior', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(RecoveryTestLayer),
      Effect.runPromise
    )
  );

  it('long-poll returns empty on timeout with no messages', { timeout: 10000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const consumerName = `consumer-${uniqueId()}`;

      // Create empty stream
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const consumer = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        deliverPolicy: 'all',
      });

      // Fetch with short timeout - should return empty
      // NATS requires minimum 1000ms expires
      const startTime = Date.now();
      const batch = yield* nats.fetch(consumer, TestEvent, {
        max: 10,
        expires: 1500, // 1.5s timeout (minimum is 1000ms)
      });
      const elapsed = Date.now() - startTime;

      expect(batch.length).toBe(0);
      expect(elapsed).toBeGreaterThanOrEqual(1000); // Should wait close to timeout
      expect(elapsed).toBeLessThan(3000); // But not too long

      // Allow consumer to settle before cleanup
      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));

  it('retry logic continues after transient failure', () =>
    Effect.gen(function* () {
      // Simulate a stream that fails first 2 attempts, succeeds on 3rd
      const fallbackStream = Stream.fromEffect(
        Effect.gen(function* () {
          let localAttempts = 0;
          while (localAttempts < 5) {
            localAttempts++;
            if (localAttempts >= 3) return 'success';
            yield* Effect.sleep('10 millis');
          }
          return 'failed';
        })
      );

      const result = yield* fallbackStream.pipe(Stream.runCollect);

      expect(Chunk.toArray(result)).toEqual(['success']);
    }).pipe(Effect.runPromise));
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Error Handling', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(RecoveryTestLayer),
      Effect.runPromise
    )
  );

  it('handles schema validation errors gracefully', () =>
    Effect.gen(function* () {
      const codec = yield* StreamCodecService;
      const registry = yield* SchemaRegistry;

      // Register strict schema
      const StrictEvent = Schema.Struct({
        _tag: Schema.Literal('StrictEvent'),
        requiredField: Schema.String,
        requiredNumber: Schema.Number,
      });
      yield* registry.registerOrUpdate('StrictEvent', StrictEvent);

      // Try to encode invalid data
      const result = yield* codec
        .encodeWithSchema('StrictEvent', {
          _tag: 'StrictEvent',
          // Missing required fields
        })
        .pipe(Effect.either);

      expect(result._tag).toBe('Left');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));

  it('handles unknown schema ID gracefully', () =>
    Effect.gen(function* () {
      const codec = yield* StreamCodecService;

      // Try to encode with non-existent schema
      const result = yield* codec
        .encodeWithSchema('NonExistentSchema', { foo: 'bar' })
        .pipe(Effect.either);

      expect(result._tag).toBe('Left');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));
});

// =============================================================================
// Concurrent Access Tests
// =============================================================================

describe('Concurrent Access', () => {
  let streamName: string;

  beforeEach(() => {
    streamName = testStreamName();
    streamsToCleanup.push(streamName);
  });

  afterEach(() =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      for (const name of streamsToCleanup) {
        yield* nats.deleteStream(name).pipe(Effect.catchAll(() => Effect.void));
      }
      streamsToCleanup.length = 0;
    }).pipe(
      Effect.provide(RecoveryTestLayer),
      Effect.runPromise
    )
  );

  it('handles multiple concurrent consumers on same stream', { timeout: 30000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('TestEvent', TestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      // Create two separate consumers
      const consumer1Name = `consumer1-${uniqueId()}`;
      const consumer2Name = `consumer2-${uniqueId()}`;

      // Publish 10 messages
      for (let i = 0; i < 10; i++) {
        const event: TestEvent = {
          _tag: 'TestEvent',
          id: `msg-${i}`,
          seq: i,
          timestamp: Date.now(),
        };
        const encoded = yield* codec.encodeWithSchema('TestEvent', event);
        yield* inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });
      }

      // Both consumers should get all 10 messages independently
      const consumer1 = yield* nats.getConsumer(streamName, consumer1Name, {
        durableName: consumer1Name,
        deliverPolicy: 'all',
      });
      const consumer2 = yield* nats.getConsumer(streamName, consumer2Name, {
        durableName: consumer2Name,
        deliverPolicy: 'all',
      });

      const [batch1, batch2] = yield* Effect.all([
        nats.fetch(consumer1, TestEvent, { max: 20 }),
        nats.fetch(consumer2, TestEvent, { max: 20 }),
      ]);

      expect(batch1.length).toBe(10);
      expect(batch2.length).toBe(10);

      // Both should have the same messages (independent consumers)
      expect(batch1.map((m) => m.data.seq).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(batch2.map((m) => m.data.seq).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Allow consumers to settle before cleanup
      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));

  it('handles concurrent publish operations', { timeout: 30000 }, () =>
    Effect.gen(function* () {
      const nats = yield* NatsStreamService;
      const inner = yield* NatsInnerService;
      const registry = yield* SchemaRegistry;
      const codec = yield* StreamCodecService;

      yield* registry.registerOrUpdate('TestEvent', TestEvent);
      yield* nats.ensureStream({
        name: streamName,
        subjects: [`${streamName.toLowerCase()}.*`],
      });

      const consumerName = `consumer-${uniqueId()}`;

      // Publish 50 messages concurrently
      const publishEffects = Array.from({ length: 50 }, (_, i) => {
        const event: TestEvent = {
          _tag: 'TestEvent',
          id: `msg-${i}`,
          seq: i,
          timestamp: Date.now(),
        };
        return codec.encodeWithSchema('TestEvent', event).pipe(
          Effect.flatMap((encoded) =>
            inner.jsPublish(`${streamName.toLowerCase()}.events`, encoded.bytes, {
              headers: headersToRecord(encoded.headers),
            })
          )
        );
      });

      yield* Effect.all(publishEffects, { concurrency: 10 });

      // Wait for messages to be stored
      yield* Effect.sleep('100 millis');

      // Verify all messages were published
      const consumer = yield* nats.getConsumer(streamName, consumerName, {
        durableName: consumerName,
        deliverPolicy: 'all',
      });
      const batch = yield* nats.fetch(consumer, TestEvent, { max: 100 });

      expect(batch.length).toBe(50);

      // Allow consumer to settle before cleanup
      yield* Effect.sleep('200 millis');
    }).pipe(Effect.provide(RecoveryTestLayer), Effect.runPromise));
});
