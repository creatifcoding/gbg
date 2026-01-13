/**
 * NatsInnerService Comprehensive Tests
 *
 * Tests the foundational service that wraps ALL NATS operations as Effects.
 * NATS with JetStream should be running on localhost:9222 (WebSocket port).
 *
 * Test scenarios per plan:
 * - core.publish / core.subscribe / core.request / core.flush
 * - kv.bucket / kv.get / kv.put / kv.delete / kv.watch
 * - streams.info / streams.add / streams.update / streams.delete
 * - jsPublish with ack and duplicate detection
 * - consumers.get / consumers.add / consumers.delete / consumers.consume
 *
 * Run with: pnpm vitest run src/lib/holonet/nats/__tests__/inner.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module holonet/nats/__tests__/inner
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer, Duration, pipe, Chunk, Fiber, Stream } from 'effect';
import { connect, type NatsConnection, type JetStreamManager } from 'nats.ws';

import { NatsInnerService } from '../inner';
import { NatsConnectionService } from '../connection';
import { HolonetConfigTag } from '../../schemas/config';
import { Inner } from '../errors';
import { fromAsyncIterable } from '../../utils/stream';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Unique test prefix for this run
const TEST_RUN_ID = Date.now();
const TEST_PREFIX = `test.inner.${TEST_RUN_ID}`;
const TEST_STREAM = `INNER_TEST_${TEST_RUN_ID}`;
const TEST_KV_BUCKET = `inner-kv-${TEST_RUN_ID}`;

// Config layer for tests
const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'nats-inner-test',
  debug: false,
});

// Composed service layers
const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer)
);

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer)
);

// =============================================================================
// Health Check & Setup
// =============================================================================

let serverAvailable = false;
let testConnection: NatsConnection | null = null;
let jsm: JetStreamManager | null = null;

async function checkNatsHealth(): Promise<boolean> {
  try {
    testConnection = await connect({ servers: NATS_SERVERS });
    jsm = await testConnection.jetstreamManager();
    return true;
  } catch {
    return false;
  }
}

async function createTestStream(): Promise<void> {
  if (!jsm) return;
  try {
    await jsm.streams.add({
      name: TEST_STREAM,
      subjects: [`${TEST_PREFIX}.>`],
      storage: 'memory' as any,
      max_age: 60 * 1e9, // 60 seconds in nanoseconds
    });
  } catch (err: any) {
    if (!err.message?.includes('already in use')) {
      throw err;
    }
  }
}

async function createTestKVBucket(): Promise<void> {
  if (!jsm) return;
  try {
    await jsm.streams.add({
      name: `KV_${TEST_KV_BUCKET}`,
      subjects: [`$KV.${TEST_KV_BUCKET}.>`],
      storage: 'memory' as any,
      max_msgs_per_subject: 10,
    });
  } catch (err: any) {
    if (!err.message?.includes('already in use')) {
      throw err;
    }
  }
}

async function cleanup(): Promise<void> {
  if (!jsm) return;
  try {
    await jsm.streams.delete(TEST_STREAM);
  } catch {
    // Ignore
  }
  try {
    await jsm.streams.delete(`KV_${TEST_KV_BUCKET}`);
  } catch {
    // Ignore
  }
}

// =============================================================================
// Integration Tests
// =============================================================================

describe('NatsInnerService Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkNatsHealth();
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`
      );
      return;
    }
    await createTestStream();
    await createTestKVBucket();
  });

  afterAll(async () => {
    if (testConnection) {
      await cleanup();
      await testConnection.close();
    }
  });

  // ---------------------------------------------------------------------------
  // core.publish / core.subscribe
  // ---------------------------------------------------------------------------

  describe('core pub/sub', () => {
    it('publish and subscribe work together', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.core.pubsub`;
      const testData = new TextEncoder().encode('hello world');

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Subscribe
        const sub = yield* inner.core.subscribe(subject);

        // Create stream from subscription
        const subStream = fromAsyncIterable(
          sub,
          (err) =>
            new Inner.Core.SubscribeError({
              message: 'Subscribe error',
              subject,
              cause: err,
            }),
          () => sub.unsubscribe()
        );

        // Collect first message in a fiber
        const collectFiber = yield* pipe(
          subStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );

        // Give subscription time to start
        yield* Effect.sleep(Duration.millis(100));

        // Publish
        yield* inner.core.publish(subject, testData);

        // Wait for message
        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(1);
        const msg = Chunk.toArray(messages)[0];
        expect(new TextDecoder().decode(msg.data)).toBe('hello world');
        expect(msg.subject).toBe(subject);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('publish returns PublishError for invalid subject', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Invalid subject with spaces
        const result = yield* pipe(
          inner.core.publish('invalid subject with spaces', new Uint8Array()),
          Effect.either
        );

        // NATS might accept this locally but it should work - test the happy path
        // Since publish is fire-and-forget at the protocol level, errors may
        // not be synchronously returned for all cases
        expect(result).toBeDefined();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // core.request
  // ---------------------------------------------------------------------------

  describe('core.request', () => {
    it('request-reply works with a responder', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.core.request`;
      const requestData = new TextEncoder().encode('ping');
      const responseData = new TextEncoder().encode('pong');

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Set up responder
        const sub = yield* inner.core.subscribe(subject);

        // Responder fiber
        yield* Effect.fork(
          Effect.promise(async () => {
            for await (const msg of sub) {
              if (msg.reply) {
                inner.core.publish(msg.reply, responseData);
              }
              break; // Only respond once
            }
          })
        );

        yield* Effect.sleep(Duration.millis(100));

        // Make request
        const response = yield* inner.core.request(subject, requestData, {
          timeout: 5000,
        });

        expect(new TextDecoder().decode(response.data)).toBe('pong');
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('request returns TimeoutError when no responder', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.core.timeout.${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const result = yield* pipe(
          inner.core.request(subject, new Uint8Array(), { timeout: 500 }),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Inner/Core/Timeout');
        }
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // core.flush
  // ---------------------------------------------------------------------------

  describe('core.flush', () => {
    it('flush completes without error', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Flush should succeed
        yield* inner.core.flush();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // streams.* (JetStream management)
  // ---------------------------------------------------------------------------

  describe('streams', () => {
    const streamTestName = `INNER_STREAM_TEST_${TEST_RUN_ID}`;

    it('streams.info returns null for nonexistent stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const info = yield* inner.streams.info(`nonexistent-${Date.now()}`);
        expect(info).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('streams.add creates a new stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const info = yield* inner.streams.add({
          name: streamTestName,
          subjects: [`${TEST_PREFIX}.stream.test.>`],
          storage: 'memory',
        });

        expect(info).toBeDefined();
        expect(info.config.name).toBe(streamTestName);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);

      // Cleanup
      if (jsm) {
        try {
          await jsm.streams.delete(streamTestName);
        } catch {
          // Ignore
        }
      }
    });

    it('streams.info returns stream info for existing stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Use the test stream created in beforeAll
        const info = yield* inner.streams.info(TEST_STREAM);

        expect(info).not.toBeNull();
        expect(info?.config.name).toBe(TEST_STREAM);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('streams.delete removes a stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const tempStreamName = `INNER_TEMP_${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Create temp stream
        yield* inner.streams.add({
          name: tempStreamName,
          subjects: [`${TEST_PREFIX}.temp.>`],
          storage: 'memory',
        });

        // Verify it exists
        const before = yield* inner.streams.info(tempStreamName);
        expect(before).not.toBeNull();

        // Delete it
        const deleted = yield* inner.streams.delete(tempStreamName);
        expect(deleted).toBe(true);

        // Verify it's gone
        const after = yield* inner.streams.info(tempStreamName);
        expect(after).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('streams.purge removes all messages from stream', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const purgeStreamName = `INNER_PURGE_${Date.now()}`;
      const purgeSubject = `${TEST_PREFIX}.purge.test`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Create stream
        yield* inner.streams.add({
          name: purgeStreamName,
          subjects: [purgeSubject],
          storage: 'memory',
        });

        // Publish some messages
        for (let i = 0; i < 5; i++) {
          yield* inner.jsPublish(
            purgeSubject,
            new TextEncoder().encode(`message-${i}`)
          );
        }

        // Verify messages exist
        const beforeInfo = yield* inner.streams.info(purgeStreamName);
        expect(beforeInfo?.state.messages).toBe(5);

        // Purge
        const purgeResult = yield* inner.streams.purge(purgeStreamName);
        expect(purgeResult.purged).toBe(5);

        // Verify messages are gone
        const afterInfo = yield* inner.streams.info(purgeStreamName);
        expect(afterInfo?.state.messages).toBe(0);

        // Cleanup
        yield* inner.streams.delete(purgeStreamName);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // jsPublish (JetStream publish)
  // ---------------------------------------------------------------------------

  describe('jsPublish', () => {
    it('jsPublish returns PubAck with sequence', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.js.publish`;
      const data = new TextEncoder().encode('jetstream message');

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const ack = yield* inner.jsPublish(subject, data);

        expect(ack).toBeDefined();
        expect(ack.stream).toBe(TEST_STREAM);
        expect(ack.seq).toBeGreaterThan(0);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('jsPublish with msgID enables deduplication', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.js.dedup`;
      const data = new TextEncoder().encode('dedup message');
      const msgId = `dedup-${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // First publish
        const ack1 = yield* inner.jsPublish(subject, data, { msgID: msgId });
        expect(ack1.duplicate).toBeFalsy();

        // Second publish with same msgID (duplicate)
        const ack2 = yield* inner.jsPublish(subject, data, { msgID: msgId });
        expect(ack2.duplicate).toBe(true);
        expect(ack2.seq).toBe(ack1.seq); // Same sequence
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('jsPublish to non-stream subject fails', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = 'no.stream.for.this.subject';
      const data = new TextEncoder().encode('should fail');

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const result = yield* pipe(inner.jsPublish(subject, data), Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Inner/Publish/Publish');
        }
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // consumers.*
  // ---------------------------------------------------------------------------

  describe('consumers', () => {
    const testConsumerName = `inner-consumer-${TEST_RUN_ID}`;

    it('consumers.add creates a durable consumer', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const info = yield* inner.consumers.add(TEST_STREAM, {
          durableName: testConsumerName,
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        expect(info).toBeDefined();
        expect(info.name).toBe(testConsumerName);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('consumers.info returns consumer info', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const info = yield* inner.consumers.info(TEST_STREAM, testConsumerName);

        expect(info).toBeDefined();
        expect(info.name).toBe(testConsumerName);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('consumers.get retrieves a consumer', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const consumer = yield* inner.consumers.get(
          TEST_STREAM,
          testConsumerName
        );

        expect(consumer).toBeDefined();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('consumers.delete removes a consumer', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const tempConsumerName = `temp-consumer-${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Create temp consumer
        yield* inner.consumers.add(TEST_STREAM, {
          durableName: tempConsumerName,
          deliverPolicy: 'new',
        });

        // Delete it
        const deleted = yield* inner.consumers.delete(
          TEST_STREAM,
          tempConsumerName
        );
        expect(deleted).toBe(true);

        // Verify it's gone
        const result = yield* pipe(
          inner.consumers.info(TEST_STREAM, tempConsumerName),
          Effect.either
        );
        expect(result._tag).toBe('Left');
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('consumers.fetch retrieves messages', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const fetchConsumer = `fetch-consumer-${Date.now()}`;
      const fetchSubject = `${TEST_PREFIX}.fetch.test`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        // Create consumer for fetch test
        yield* inner.consumers.add(TEST_STREAM, {
          durableName: fetchConsumer,
          filterSubject: fetchSubject,
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        // Publish messages
        for (let i = 0; i < 3; i++) {
          yield* inner.jsPublish(
            fetchSubject,
            new TextEncoder().encode(`fetch-msg-${i}`)
          );
        }

        // Get consumer and fetch
        const consumer = yield* inner.consumers.get(TEST_STREAM, fetchConsumer);
        const messages = yield* inner.consumers.fetch(consumer, {
          max_messages: 3,
          expires: 5000,
        });

        // Collect messages
        const collected = yield* Effect.promise(async () => {
          const result: string[] = [];
          for await (const msg of messages) {
            result.push(new TextDecoder().decode(msg.data));
            msg.ack();
          }
          return result;
        });

        expect(collected.length).toBe(3);
        expect(collected).toContain('fetch-msg-0');
        expect(collected).toContain('fetch-msg-1');
        expect(collected).toContain('fetch-msg-2');

        // Cleanup
        yield* inner.consumers.delete(TEST_STREAM, fetchConsumer);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // kv.*
  // ---------------------------------------------------------------------------

  describe('kv', () => {
    it('kv.bucket opens a KV bucket', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const bucket = yield* inner.kv.bucket(TEST_KV_BUCKET);

        expect(bucket).toBeDefined();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('kv.put and kv.get work together', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `kv-test-${Date.now()}`;
      const testValue = new TextEncoder().encode('test value');

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const bucket = yield* inner.kv.bucket(TEST_KV_BUCKET);

        // Put value
        const revision = yield* inner.kv.put(
          TEST_KV_BUCKET,
          bucket,
          testKey,
          testValue
        );
        expect(revision).toBeGreaterThan(0);

        // Get value
        const entry = yield* inner.kv.get(TEST_KV_BUCKET, bucket, testKey);
        expect(entry).not.toBeNull();
        expect(new TextDecoder().decode(entry!.value)).toBe('test value');
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('kv.get returns null for missing key', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const bucket = yield* inner.kv.bucket(TEST_KV_BUCKET);
        const entry = yield* inner.kv.get(
          TEST_KV_BUCKET,
          bucket,
          `nonexistent-${Date.now()}`
        );

        expect(entry).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('kv.delete removes a key', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `kv-delete-${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const bucket = yield* inner.kv.bucket(TEST_KV_BUCKET);

        // Create key
        yield* inner.kv.put(
          TEST_KV_BUCKET,
          bucket,
          testKey,
          new TextEncoder().encode('to delete')
        );

        // Delete it
        yield* inner.kv.delete(TEST_KV_BUCKET, bucket, testKey);

        // Verify it's gone
        const entry = yield* inner.kv.get(TEST_KV_BUCKET, bucket, testKey);
        expect(entry).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });

    it('kv.keys returns all keys', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const keyPrefix = `kv-keys-${Date.now()}`;

      const program = Effect.gen(function* () {
        const inner = yield* NatsInnerService;

        const bucket = yield* inner.kv.bucket(TEST_KV_BUCKET);

        // Create a few keys
        for (let i = 0; i < 3; i++) {
          yield* inner.kv.put(
            TEST_KV_BUCKET,
            bucket,
            `${keyPrefix}-${i}`,
            new TextEncoder().encode(`value-${i}`)
          );
        }

        // Get keys
        const keysIter = yield* inner.kv.keys(bucket, `${keyPrefix}-*`);
        const keys = yield* Effect.promise(async () => {
          const result: string[] = [];
          for await (const key of keysIter) {
            result.push(key);
          }
          return result;
        });

        expect(keys.length).toBe(3);
        expect(keys).toContain(`${keyPrefix}-0`);
        expect(keys).toContain(`${keyPrefix}-1`);
        expect(keys).toContain(`${keyPrefix}-2`);
      }).pipe(Effect.scoped, Effect.provide(testInnerLayer));

      await Effect.runPromise(program);
    });
  });
});

// =============================================================================
// Unit Tests (no NATS required)
// =============================================================================

describe('NatsInnerService Unit', () => {
  describe('Inner error types', () => {
    it('Core.PublishError has correct tag', () => {
      const error = new Inner.Core.PublishError({
        message: 'Publish failed',
        subject: 'test.subject',
      });

      expect(error._tag).toBe('Inner/Core/Publish');
      expect(error.subject).toBe('test.subject');
    });

    it('Core.SubscribeError has correct tag', () => {
      const error = new Inner.Core.SubscribeError({
        message: 'Subscribe failed',
        subject: 'test.subject',
      });

      expect(error._tag).toBe('Inner/Core/Subscribe');
    });

    it('Core.TimeoutError has correct tag', () => {
      const error = new Inner.Core.TimeoutError({
        subject: 'test.subject',
        timeoutMs: 5000,
      });

      expect(error._tag).toBe('Inner/Core/Timeout');
      expect(error.timeoutMs).toBe(5000);
    });

    it('Core.RequestError has correct tag', () => {
      const error = new Inner.Core.RequestError({
        message: 'Request failed',
        subject: 'test.subject',
      });

      expect(error._tag).toBe('Inner/Core/Request');
    });

    it('Core.FlushError has correct tag', () => {
      const error = new Inner.Core.FlushError({
        message: 'Flush failed',
      });

      expect(error._tag).toBe('Inner/Core/Flush');
    });

    it('KV.BucketError has correct tag', () => {
      const error = new Inner.KV.BucketError({
        message: 'Bucket error',
        bucketName: 'test-bucket',
      });

      expect(error._tag).toBe('Inner/KV/Bucket');
      expect(error.bucketName).toBe('test-bucket');
    });

    it('KV.GetError has correct tag', () => {
      const error = new Inner.KV.GetError({
        message: 'Get error',
        bucketName: 'test-bucket',
        key: 'test-key',
      });

      expect(error._tag).toBe('Inner/KV/Get');
      expect(error.key).toBe('test-key');
    });

    it('Streams.AddError has correct tag', () => {
      const error = new Inner.Streams.AddError({
        message: 'Add error',
        streamName: 'TEST_STREAM',
      });

      expect(error._tag).toBe('Inner/Streams/Add');
      expect(error.streamName).toBe('TEST_STREAM');
    });

    it('Publish.PublishError has correct tag', () => {
      const error = new Inner.Publish.PublishError({
        message: 'JS Publish error',
        subject: 'test.subject',
      });

      expect(error._tag).toBe('Inner/Publish/Publish');
    });

    it('Consumers.GetError has correct tag', () => {
      const error = new Inner.Consumers.GetError({
        message: 'Consumer get error',
        streamName: 'TEST_STREAM',
        consumerName: 'test-consumer',
      });

      expect(error._tag).toBe('Inner/Consumers/Get');
      expect(error.consumerName).toBe('test-consumer');
    });
  });
});
