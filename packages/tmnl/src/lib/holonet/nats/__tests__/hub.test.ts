/**
 * NatsHubService Integration Tests
 *
 * Tests the hub-based connection sharing architecture.
 * NATS should be running on localhost:9222 (WebSocket port).
 *
 * Run with: pnpm vitest run src/lib/holonet/nats/__tests__/hub.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module holonet/nats/__tests__/hub
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Effect, Layer, Schema, Stream, Chunk, Fiber, Duration } from 'effect';
import { connect } from 'nats.ws';

import { NatsHubService } from '../hub';
import { NatsPubSubService } from '../pubsub';
import { NatsInnerService } from '../inner';
import { NatsConnectionService } from '../connection';
import { HolonetConfigTag } from '../../schemas/config';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Test subject prefix (unique per test run to avoid conflicts)
const TEST_PREFIX = `test.hub.${Date.now()}`;

// Config layer for tests
const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'nats-hub-test',
  debug: false,
});

// Composed service layers
const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer)
);

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer)
);

const testHubLayer = NatsHubService.Default.pipe(Layer.provide(testInnerLayer));

const testPubSubLayer = NatsPubSubService.Default.pipe(
  Layer.provide(Layer.merge(testInnerLayer, testHubLayer))
);

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false;

async function checkNatsHealth(): Promise<boolean> {
  try {
    const nc = await connect({ servers: NATS_SERVERS });
    await nc.close();
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Test Schemas
// =============================================================================

const TestMessage = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
  timestamp: Schema.DateFromSelf,
});
type TestMessage = typeof TestMessage.Type;

const PositionUpdate = Schema.Struct({
  entityId: Schema.String,
  lat: Schema.Number,
  lon: Schema.Number,
});
type PositionUpdate = typeof PositionUpdate.Type;

// =============================================================================
// Integration Tests
// =============================================================================

describe('NatsHubService Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkNatsHealth();
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // Hub Subscribe/Publish Tests
  // ---------------------------------------------------------------------------

  describe('subscribe and publish', () => {
    it('receives messages through hub subscription', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.basic`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Subscribe to subject
        const stream = yield* hub.subscribe(subject, TestMessage);

        // Collect first message in a fiber
        const collectFiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

        // Give subscription time to start
        yield* Effect.sleep(Duration.millis(100));

        // Publish a message
        const testMsg: TestMessage = {
          id: 'msg-1',
          value: 42,
          timestamp: new Date(),
        };
        yield* hub.publish(subject, TestMessage, testMsg);

        // Wait for the message
        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(1);
        const received = Chunk.toArray(messages)[0];
        expect(received.data.id).toBe('msg-1');
        expect(received.data.value).toBe(42);
        expect(received.subject).toBe(subject);
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });

    it('local echo - subscriber receives own publishes', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.echo`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Subscribe first
        const stream = yield* hub.subscribe(subject, TestMessage);

        // Collect messages
        const collectFiber = yield* stream.pipe(Stream.take(3), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(100));

        // Publish 3 messages - should be echoed back locally
        for (let i = 1; i <= 3; i++) {
          yield* hub.publish(subject, TestMessage, {
            id: `echo-${i}`,
            value: i * 10,
            timestamp: new Date(),
          });
        }

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(3);
        const arr = Chunk.toArray(messages);
        expect(arr[0].data.id).toBe('echo-1');
        expect(arr[1].data.id).toBe('echo-2');
        expect(arr[2].data.id).toBe('echo-3');
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple Subscriber Tests
  // ---------------------------------------------------------------------------

  describe('connection sharing', () => {
    it('multiple subscribers share single NATS subscription', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.shared`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Create two subscribers to same pattern
        const stream1 = yield* hub.subscribe(subject, TestMessage);
        const stream2 = yield* hub.subscribe(subject, TestMessage);

        // Collect from both
        const fiber1 = yield* stream1.pipe(Stream.take(1), Stream.runCollect, Effect.fork);
        const fiber2 = yield* stream2.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(100));

        // Publish once
        yield* hub.publish(subject, TestMessage, {
          id: 'shared-1',
          value: 100,
          timestamp: new Date(),
        });

        // Both should receive the message
        const messages1 = yield* Fiber.join(fiber1).pipe(Effect.timeout(Duration.seconds(5)));
        const messages2 = yield* Fiber.join(fiber2).pipe(Effect.timeout(Duration.seconds(5)));

        expect(Chunk.size(messages1)).toBe(1);
        expect(Chunk.size(messages2)).toBe(1);
        expect(Chunk.toArray(messages1)[0].data.id).toBe('shared-1');
        expect(Chunk.toArray(messages2)[0].data.id).toBe('shared-1');
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Wildcard Pattern Tests
  // ---------------------------------------------------------------------------

  describe('wildcard patterns', () => {
    it('* wildcard matches single token', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const pattern = `${TEST_PREFIX}.position.*.update`;
      const subject1 = `${TEST_PREFIX}.position.entity1.update`;
      const subject2 = `${TEST_PREFIX}.position.entity2.update`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Subscribe to wildcard pattern
        const stream = yield* hub.subscribe(pattern, PositionUpdate);

        // Collect messages
        const collectFiber = yield* stream.pipe(Stream.take(2), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(100));

        // Publish to different entities
        yield* hub.publish(subject1, PositionUpdate, {
          entityId: 'entity1',
          lat: 51.5,
          lon: -0.1,
        });
        yield* hub.publish(subject2, PositionUpdate, {
          entityId: 'entity2',
          lat: 40.7,
          lon: -74.0,
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(2);
        const arr = Chunk.toArray(messages);
        expect(arr.map((m) => m.data.entityId).sort()).toEqual(['entity1', 'entity2']);
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });

    it('> wildcard matches multiple tokens', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const pattern = `${TEST_PREFIX}.events.>`;
      const subject1 = `${TEST_PREFIX}.events.flight.position`;
      const subject2 = `${TEST_PREFIX}.events.vessel.ais.position`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Subscribe to > wildcard
        const stream = yield* hub.subscribe(pattern, TestMessage);

        const collectFiber = yield* stream.pipe(Stream.take(2), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(100));

        yield* hub.publish(subject1, TestMessage, {
          id: 'flight-1',
          value: 1,
          timestamp: new Date(),
        });
        yield* hub.publish(subject2, TestMessage, {
          id: 'vessel-1',
          value: 2,
          timestamp: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(2);
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // PubSub Service Integration Tests
  // ---------------------------------------------------------------------------

  describe('NatsPubSubService via hub', () => {
    it('publish and subscribe work through hub', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.pubsub`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        // Subscribe
        const stream = yield* pubsub.subscribe(subject, TestMessage);

        const collectFiber = yield* stream.pipe(Stream.take(1), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(100));

        // Publish through pubsub service (uses hub internally)
        yield* pubsub.publish(subject, TestMessage, {
          id: 'pubsub-1',
          value: 999,
          timestamp: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(1);
        expect(Chunk.toArray(messages)[0].data.id).toBe('pubsub-1');
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Active Patterns Introspection
  // ---------------------------------------------------------------------------

  describe('introspection', () => {
    it('activePatterns returns subscribed patterns', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const pattern1 = `${TEST_PREFIX}.inspect.one`;
      const pattern2 = `${TEST_PREFIX}.inspect.two`;

      const program = Effect.gen(function* () {
        const hub = yield* NatsHubService;

        // Initially no patterns
        const before = yield* hub.activePatterns();
        const beforeFiltered = before.filter((p) => p.startsWith(TEST_PREFIX));
        expect(beforeFiltered.length).toBe(0);

        // Subscribe to two patterns
        yield* hub.subscribe(pattern1, TestMessage);
        yield* hub.subscribe(pattern2, TestMessage);

        // Should have both patterns
        const after = yield* hub.activePatterns();
        const afterFiltered = after.filter((p) => p.startsWith(TEST_PREFIX));
        expect(afterFiltered.length).toBe(2);
        expect(afterFiltered).toContain(pattern1);
        expect(afterFiltered).toContain(pattern2);
      }).pipe(Effect.scoped, Effect.provide(testHubLayer));

      await Effect.runPromise(program);
    });
  });
});
