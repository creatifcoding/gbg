/**
 * NatsPubSubService Comprehensive Tests
 *
 * Tests the high-level pub/sub service with Schema codecs.
 * NATS should be running on localhost:9222 (WebSocket port).
 *
 * Test scenarios per plan:
 * - Fire-and-forget publish
 * - Subscribe stream
 * - Request-reply with typed request/response
 *
 * Run with: pnpm vitest run src/lib/holonet/nats/__tests__/pubsub.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module holonet/nats/__tests__/pubsub
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Effect, Layer, Schema, Stream, Chunk, Fiber, Duration, pipe } from 'effect';
import { connect } from 'nats.ws';

import { NatsPubSubService } from '../pubsub';
import { NatsHubService } from '../hub';
import { NatsInnerService } from '../inner';
import { NatsConnectionService } from '../connection';
import { HolonetConfigTag } from '../../schemas/config';
import { Inner, Codec, PubSub as PubSubErrors } from '../errors';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Unique test prefix for this run
const TEST_RUN_ID = Date.now();
const TEST_PREFIX = `test.pubsub.${TEST_RUN_ID}`;

// Config layer for tests
const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'nats-pubsub-test',
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

const SimpleMessage = Schema.Struct({
  id: Schema.String,
  content: Schema.String,
  timestamp: Schema.DateFromSelf,
});
type SimpleMessage = typeof SimpleMessage.Type;

const RequestMessage = Schema.Struct({
  requestId: Schema.String,
  query: Schema.String,
});
type RequestMessage = typeof RequestMessage.Type;

const ResponseMessage = Schema.Struct({
  requestId: Schema.String,
  result: Schema.String,
  success: Schema.Boolean,
});
type ResponseMessage = typeof ResponseMessage.Type;

const SensorReading = Schema.Struct({
  sensorId: Schema.String,
  temperature: Schema.Number,
  humidity: Schema.Number,
  timestamp: Schema.DateFromSelf,
});
type SensorReading = typeof SensorReading.Type;

// Note: Using Schema.String for status to avoid type inference issues in tests
// In production, Schema.Literal would provide stricter validation
const OrderEvent = Schema.Struct({
  orderId: Schema.String,
  status: Schema.String,
  amount: Schema.Number,
  updatedAt: Schema.DateFromSelf,
});
type OrderEvent = typeof OrderEvent.Type;

// =============================================================================
// Integration Tests
// =============================================================================

describe('NatsPubSubService Integration', () => {
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
  // Fire-and-forget publish
  // ---------------------------------------------------------------------------

  describe('publish', () => {
    it('publishes message with Schema encoding', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.publish.basic`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        // Subscribe first to receive the message
        const stream = yield* pubsub.subscribe(subject, SimpleMessage);

        // Collect first message
        const collectFiber = yield* pipe(
          stream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        // Publish message
        const msg: SimpleMessage = {
          id: 'msg-1',
          content: 'Hello, NATS!',
          timestamp: new Date(),
        };
        yield* pubsub.publish(subject, SimpleMessage, msg);

        // Wait for message
        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(1);
        const received = Chunk.toArray(messages)[0];
        expect(received.data.id).toBe('msg-1');
        expect(received.data.content).toBe('Hello, NATS!');
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('publishes multiple messages in sequence', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.publish.multi`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const stream = yield* pubsub.subscribe(subject, SimpleMessage);

        const collectFiber = yield* pipe(
          stream,
          Stream.take(3),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        // Publish 3 messages
        for (let i = 1; i <= 3; i++) {
          yield* pubsub.publish(subject, SimpleMessage, {
            id: `multi-${i}`,
            content: `Message ${i}`,
            timestamp: new Date(),
          });
        }

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(3);
        const arr = Chunk.toArray(messages);
        expect(arr[0].data.id).toBe('multi-1');
        expect(arr[1].data.id).toBe('multi-2');
        expect(arr[2].data.id).toBe('multi-3');
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('encode error for invalid data', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.publish.invalid`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        // Try to publish with invalid data (missing required fields)
        const result = yield* pipe(
          pubsub.publish(subject, SimpleMessage, {
            id: 'invalid',
            // Missing 'content' and 'timestamp'
          } as any),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Codec/Encode');
        }
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Subscribe stream
  // ---------------------------------------------------------------------------

  describe('subscribe', () => {
    it('subscribe returns a Stream of typed messages', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.subscribe.typed`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const stream = yield* pubsub.subscribe(subject, SensorReading);

        const collectFiber = yield* pipe(
          stream,
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        // Publish sensor readings
        yield* pubsub.publish(subject, SensorReading, {
          sensorId: 'sensor-1',
          temperature: 22.5,
          humidity: 65.0,
          timestamp: new Date(),
        });
        yield* pubsub.publish(subject, SensorReading, {
          sensorId: 'sensor-2',
          temperature: 23.1,
          humidity: 62.5,
          timestamp: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        const arr = Chunk.toArray(messages);
        expect(arr.length).toBe(2);
        expect(arr[0].data.sensorId).toBe('sensor-1');
        expect(arr[0].data.temperature).toBe(22.5);
        expect(arr[1].data.sensorId).toBe('sensor-2');
        expect(arr[1].data.temperature).toBe(23.1);
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('subscribe with wildcard pattern receives matching messages', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const pattern = `${TEST_PREFIX}.subscribe.orders.*`;
      const subject1 = `${TEST_PREFIX}.subscribe.orders.created`;
      const subject2 = `${TEST_PREFIX}.subscribe.orders.updated`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const stream = yield* pubsub.subscribe(pattern, OrderEvent);

        const collectFiber = yield* pipe(
          stream,
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        yield* pubsub.publish(subject1, OrderEvent, {
          orderId: 'order-1',
          status: 'pending',
          amount: 99.99,
          updatedAt: new Date(),
        });
        yield* pubsub.publish(subject2, OrderEvent, {
          orderId: 'order-2',
          status: 'completed',
          amount: 149.99,
          updatedAt: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        const arr = Chunk.toArray(messages);
        expect(arr.length).toBe(2);
        expect(arr.map((m) => m.data.orderId).sort()).toEqual([
          'order-1',
          'order-2',
        ]);
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('subscribe with > wildcard receives all nested messages', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const pattern = `${TEST_PREFIX}.events.>`;
      const subject1 = `${TEST_PREFIX}.events.user.created`;
      const subject2 = `${TEST_PREFIX}.events.order.payment.processed`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const stream = yield* pubsub.subscribe(pattern, SimpleMessage);

        const collectFiber = yield* pipe(
          stream,
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        yield* pubsub.publish(subject1, SimpleMessage, {
          id: 'user-event',
          content: 'User created',
          timestamp: new Date(),
        });
        yield* pubsub.publish(subject2, SimpleMessage, {
          id: 'order-event',
          content: 'Payment processed',
          timestamp: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        expect(Chunk.size(messages)).toBe(2);
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('multiple subscribers receive same message', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.subscribe.fanout`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        // Create two subscribers
        const stream1 = yield* pubsub.subscribe(subject, SimpleMessage);
        const stream2 = yield* pubsub.subscribe(subject, SimpleMessage);

        const fiber1 = yield* pipe(
          stream1,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );
        const fiber2 = yield* pipe(
          stream2,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        yield* pubsub.publish(subject, SimpleMessage, {
          id: 'fanout-1',
          content: 'Broadcast message',
          timestamp: new Date(),
        });

        const [messages1, messages2] = yield* Effect.all([
          Fiber.join(fiber1).pipe(Effect.timeout(Duration.seconds(5))),
          Fiber.join(fiber2).pipe(Effect.timeout(Duration.seconds(5))),
        ]);

        expect(Chunk.size(messages1)).toBe(1);
        expect(Chunk.size(messages2)).toBe(1);
        expect(Chunk.toArray(messages1)[0].data.id).toBe('fanout-1');
        expect(Chunk.toArray(messages2)[0].data.id).toBe('fanout-1');
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Request-reply
  // ---------------------------------------------------------------------------

  describe('request', () => {
    it('request-reply with typed schemas', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      // Use a subject outside the test.> JetStream pattern to avoid interference
      // with JetStream capturing the request-reply messages
      const subject = `reqreply.pubsub.${TEST_RUN_ID}.typed`;

      // Create layer that includes both PubSub and Inner service
      const fullTestLayer = Layer.merge(testPubSubLayer, testInnerLayer);

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;
        const inner = yield* NatsInnerService;

        // Set up responder using direct NATS subscription (bypasses hub)
        // This tests pubsub.request while avoiding hub timing issues
        const sub = yield* inner.core.subscribe(subject);

        // Responder fiber - use async for-await pattern like inner.test.ts
        yield* Effect.fork(
          Effect.promise(async () => {
            const textEncoder = new TextEncoder();
            const textDecoder = new TextDecoder();

            for await (const msg of sub) {
              if (msg.reply) {
                // Decode request
                const reqData = JSON.parse(textDecoder.decode(msg.data));

                // Encode response
                const response: ResponseMessage = {
                  requestId: reqData.requestId,
                  result: `Processed: ${reqData.query}`,
                  success: true,
                };
                const responseBytes = textEncoder.encode(JSON.stringify(response));

                // Use Effect.runSync to execute the publish
                Effect.runSync(inner.core.publish(msg.reply, responseBytes));
              }
            }
          })
        );

        yield* Effect.sleep(Duration.millis(100));

        // Make request using pubsub.request (the actual method being tested)
        const response = yield* pubsub.request(
          subject,
          RequestMessage,
          ResponseMessage,
          {
            requestId: 'req-1',
            query: 'Hello',
          },
          { timeout: 5000 }
        );

        expect(response.requestId).toBe('req-1');
        expect(response.result).toBe('Processed: Hello');
        expect(response.success).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(fullTestLayer));

      await Effect.runPromise(program);
    });

    it('request timeout returns error when no responder', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.request.timeout.${Date.now()}`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const result = yield* pipe(
          pubsub.request(
            subject,
            RequestMessage,
            ResponseMessage,
            { requestId: 'req-timeout', query: 'No one home' },
            { timeout: 500 }
          ),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          // Should be a timeout error
          expect(result.left._tag).toBe('Inner/Core/Timeout');
        }
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });

    it('request encode error for invalid request data', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.request.invalid`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const result = yield* pipe(
          pubsub.request(
            subject,
            RequestMessage,
            ResponseMessage,
            { requestId: 'invalid' } as any, // Missing 'query'
            { timeout: 1000 }
          ),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Codec/Encode');
        }
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Flush
  // ---------------------------------------------------------------------------

  describe('flush', () => {
    it('flush completes pending publishes', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        // Flush should complete without error
        yield* pubsub.flush();
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // TypedMessage structure
  // ---------------------------------------------------------------------------

  describe('TypedMessage', () => {
    it('message includes subject and raw message', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const subject = `${TEST_PREFIX}.message.structure`;

      const program = Effect.gen(function* () {
        const pubsub = yield* NatsPubSubService;

        const stream = yield* pubsub.subscribe(subject, SimpleMessage);

        const collectFiber = yield* pipe(
          stream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(100));

        yield* pubsub.publish(subject, SimpleMessage, {
          id: 'structure-test',
          content: 'Testing structure',
          timestamp: new Date(),
        });

        const messages = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(5))
        );

        const msg = Chunk.toArray(messages)[0];

        // TypedMessage structure
        expect(msg.subject).toBe(subject);
        expect(msg.data).toBeDefined();
        expect(msg.data.id).toBe('structure-test');
        expect(msg.raw).toBeDefined();
      }).pipe(Effect.scoped, Effect.provide(testPubSubLayer));

      await Effect.runPromise(program);
    });
  });
});

// =============================================================================
// Unit Tests (no NATS required)
// =============================================================================

describe('NatsPubSubService Unit', () => {
  describe('error types', () => {
    it('PubSub.PublishError union includes correct types', () => {
      // The publish error type is a union of Inner.Core.PublishError | Codec.EncodeError
      const coreError = new Inner.Core.PublishError({
        message: 'Publish failed',
        subject: 'test.subject',
      });

      const encodeError = new Codec.EncodeError({
        message: 'Encode failed',
      });

      expect(coreError._tag).toBe('Inner/Core/Publish');
      expect(encodeError._tag).toBe('Codec/Encode');
    });

    it('PubSub.SubscribeError union includes correct types', () => {
      const coreError = new Inner.Core.SubscribeError({
        message: 'Subscribe failed',
        subject: 'test.subject',
      });

      const decodeError = new Codec.DecodeError({
        message: 'Decode failed',
        subject: 'test.subject',
      });

      expect(coreError._tag).toBe('Inner/Core/Subscribe');
      expect(decodeError._tag).toBe('Codec/Decode');
    });

    it('PubSub.RequestError union includes timeout', () => {
      const timeoutError = new Inner.Core.TimeoutError({
        subject: 'test.subject',
        timeoutMs: 5000,
      });

      expect(timeoutError._tag).toBe('Inner/Core/Timeout');
      expect(timeoutError.timeoutMs).toBe(5000);
    });
  });

  describe('schema validation', () => {
    it('SimpleMessage schema validates correct data', () => {
      const valid: SimpleMessage = {
        id: 'test',
        content: 'hello',
        timestamp: new Date(),
      };

      const result = Schema.decodeUnknownSync(SimpleMessage)(valid);
      expect(result.id).toBe('test');
      expect(result.content).toBe('hello');
    });

    it('RequestMessage schema validates correct data', () => {
      const valid: RequestMessage = {
        requestId: 'req-1',
        query: 'test query',
      };

      const result = Schema.decodeUnknownSync(RequestMessage)(valid);
      expect(result.requestId).toBe('req-1');
      expect(result.query).toBe('test query');
    });

    it('ResponseMessage schema validates correct data', () => {
      const valid: ResponseMessage = {
        requestId: 'req-1',
        result: 'success',
        success: true,
      };

      const result = Schema.decodeUnknownSync(ResponseMessage)(valid);
      expect(result.success).toBe(true);
    });

    it('OrderEvent schema validates correct data', () => {
      const valid: OrderEvent = {
        orderId: 'order-1',
        status: 'completed',
        amount: 100,
        updatedAt: new Date(),
      };

      const result = Schema.decodeUnknownSync(OrderEvent)(valid);
      expect(result.status).toBe('completed');
      expect(result.orderId).toBe('order-1');
      expect(result.amount).toBe(100);
    });
  });
});
