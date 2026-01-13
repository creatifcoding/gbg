/**
 * NatsStreamService Integration Tests
 *
 * Tests high-level JetStream operations with Schema codecs.
 * Requires NATS server with JetStream enabled.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Stream, pipe, Schema, Duration } from 'effect';

import { NatsStreamService } from '../stream';
import { NatsInnerService } from '../inner';
import { NatsConnectionServiceCustom } from '../connection';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

// Create a test connection layer
const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'stream-test-client',
  debug: false,
});

// Full layer stack for tests
const TestLayer = NatsStreamService.Default.pipe(
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

// Unique test identifiers
const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;

// =============================================================================
// Test Schemas
// =============================================================================

const SensorEvent = Schema.Struct({
  sensorId: Schema.String,
  value: Schema.Number,
  unit: Schema.String,
  timestamp: Schema.Date,
});
type SensorEvent = typeof SensorEvent.Type;

const CommandEvent = Schema.Struct({
  commandId: Schema.String,
  action: Schema.Literal('start', 'stop', 'pause', 'resume'),
  parameters: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});
type CommandEvent = typeof CommandEvent.Type;

// =============================================================================
// Test Helpers
// =============================================================================

/** Create a unique stream name for each test */
const testStreamName = () => `TEST_STREAM_${uniqueId()}`.toUpperCase();

/** Create test sensor event */
const createSensorEvent = (sensorId: string, value: number): SensorEvent => ({
  sensorId,
  value,
  unit: 'celsius',
  timestamp: new Date(),
});

/** Cleanup helper - delete stream if exists */
const cleanupStream = (streamName: string) =>
  Effect.gen(function* () {
    const stream = yield* NatsStreamService;
    yield* pipe(
      stream.deleteStream(streamName),
      Effect.catchAll(() => Effect.void)
    );
  });

// =============================================================================
// Tests
// =============================================================================

describe('NatsStreamService Integration', () => {
  // Track streams to clean up
  const streamsToCleanup: string[] = [];

  beforeEach(() => {
    streamsToCleanup.length = 0;
  });

  afterEach(async () => {
    // Clean up any streams created during tests
    for (const streamName of streamsToCleanup) {
      await Effect.runPromise(
        cleanupStream(streamName).pipe(Effect.provide(TestLayer))
      );
    }
  });

  describe('stream management', () => {
    it('ensureStream creates stream if not exists', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        const info = yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.*`],
          storage: 'memory',
        });

        expect(info.config.name).toBe(streamName);
        expect(info.config.subjects).toContain(`${streamName.toLowerCase()}.*`);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('ensureStream returns existing stream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        // Create stream
        const info1 = yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.*`],
          storage: 'memory',
        });

        // Ensure again - should return same stream
        const info2 = yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.*`],
          storage: 'memory',
        });

        expect(info2.config.name).toBe(info1.config.name);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('getStreamInfo returns info for existing stream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        // Create stream first
        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.*`],
          storage: 'memory',
        });

        const info = yield* stream.getStreamInfo(streamName);
        expect(info).not.toBeNull();
        expect(info?.config.name).toBe(streamName);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('getStreamInfo returns null for nonexistent stream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const info = yield* stream.getStreamInfo('NONEXISTENT_STREAM_12345');
        expect(info).toBeNull();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('deleteStream removes stream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();

        // Create stream
        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.*`],
          storage: 'memory',
        });

        // Delete it
        const deleted = yield* stream.deleteStream(streamName);
        expect(deleted).toBe(true);

        // Verify it's gone
        const info = yield* stream.getStreamInfo(streamName);
        expect(info).toBeNull();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('publishing', () => {
    it('publish sends typed message to JetStream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        streamsToCleanup.push(streamName);

        // Create stream
        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Publish message
        const event = createSensorEvent('sensor-001', 23.5);
        const ack = yield* stream.publish(subject, SensorEvent, event);

        expect(ack.stream).toBe(streamName);
        expect(ack.seq).toBeGreaterThan(0);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('publish with msgId enables deduplication', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        streamsToCleanup.push(streamName);

        // Create stream with duplicate window
        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
          duplicateWindow: 60_000_000_000, // 60 seconds in nanos
        });

        const event = createSensorEvent('sensor-001', 23.5);
        const msgId = `msg-${uniqueId()}`;

        // Publish first time
        const ack1 = yield* stream.publish(subject, SensorEvent, event, { msgId });
        expect(ack1.duplicate).toBeFalsy();

        // Publish same message again - should be flagged as duplicate
        const ack2 = yield* stream.publish(subject, SensorEvent, event, { msgId });
        expect(ack2.duplicate).toBe(true);
        expect(ack2.seq).toBe(ack1.seq);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('publish fails with encode error for invalid data', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Try to publish invalid data (missing required field)
        const invalidEvent = { sensorId: 'sensor-001' } as any;
        const result = yield* pipe(
          stream.publish(subject, SensorEvent, invalidEvent),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Codec/Encode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('pull-based consumption', () => {
    it('getConsumer creates durable consumer', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        expect(consumer).toBeDefined();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fetch retrieves typed messages', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        // Create stream and publish messages
        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        const events = [
          createSensorEvent('sensor-001', 23.5),
          createSensorEvent('sensor-002', 24.0),
          createSensorEvent('sensor-003', 22.8),
        ];

        for (const event of events) {
          yield* stream.publish(subject, SensorEvent, event);
        }

        // Create consumer and fetch
        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        const messages = yield* stream.fetch(consumer, SensorEvent, {
          max: 10,
          expires: 1000,
        });

        expect(messages.length).toBe(3);
        expect(messages[0].data.sensorId).toBe('sensor-001');
        expect(messages[1].data.sensorId).toBe('sensor-002');
        expect(messages[2].data.sensorId).toBe('sensor-003');

        // Ack the messages
        for (const msg of messages) {
          yield* msg.ack();
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('next retrieves single typed message', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Publish one message
        const event = createSensorEvent('sensor-001', 23.5);
        yield* stream.publish(subject, SensorEvent, event);

        // Create consumer and get next
        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        const msg = yield* stream.next(consumer, SensorEvent, { expires: 1000 });

        expect(msg).not.toBeNull();
        expect(msg?.data.sensorId).toBe('sensor-001');
        expect(msg?.data.value).toBe(23.5);

        // Ack it
        yield* msg!.ack();

        // Next should return null (no more messages) - min 1000ms required by NATS
        const msg2 = yield* stream.next(consumer, SensorEvent, { expires: 1000 });
        expect(msg2).toBeNull();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fetch with decode error for invalid schema', () =>
      Effect.gen(function* () {
        const inner = yield* NatsInnerService;
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Publish invalid JSON directly via inner service
        const invalidJson = new TextEncoder().encode('{"invalid": "data"}');
        yield* inner.jsPublish(subject, invalidJson);

        // Create consumer and try to fetch with wrong schema
        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        const result = yield* pipe(
          stream.fetch(consumer, SensorEvent, { max: 1, expires: 1000 }),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Codec/Decode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('subscribe (push-based)', () => {
    it('subscribe receives typed messages as stream', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Publish messages first
        const events = [
          createSensorEvent('sensor-001', 23.5),
          createSensorEvent('sensor-002', 24.0),
          createSensorEvent('sensor-003', 22.8),
        ];

        for (const event of events) {
          yield* stream.publish(subject, SensorEvent, event);
        }

        // Subscribe with deliverPolicy 'all' to get existing messages
        const msgStream = yield* stream.subscribe(streamName, SensorEvent, {
          consumer: consumerName,
          filterSubject: subject,
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        // Collect messages with timeout
        const received: SensorEvent[] = [];
        yield* pipe(
          msgStream,
          Stream.tap((msg) =>
            Effect.gen(function* () {
              received.push(msg.data);
              yield* msg.ack();
            })
          ),
          Stream.take(3),
          Stream.runDrain,
          Effect.timeout(Duration.seconds(5))
        );

        expect(received.length).toBe(3);
        expect(received[0].sensorId).toBe('sensor-001');
        expect(received[1].sensorId).toBe('sensor-002');
        expect(received[2].sensorId).toBe('sensor-003');
      }).pipe(Effect.scoped, Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('complex schema types', () => {
    it('handles CommandEvent with union and optional fields', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.commands`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        // Publish different command types
        const commands: CommandEvent[] = [
          { commandId: 'cmd-1', action: 'start' },
          { commandId: 'cmd-2', action: 'pause', parameters: { delay: 1000 } },
          { commandId: 'cmd-3', action: 'stop' },
        ];

        for (const cmd of commands) {
          yield* stream.publish(subject, CommandEvent, cmd);
        }

        // Fetch and verify
        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        const messages = yield* stream.fetch(consumer, CommandEvent, {
          max: 10,
          expires: 1000,
        });

        expect(messages.length).toBe(3);
        expect(messages[0].data.action).toBe('start');
        expect(messages[1].data.action).toBe('pause');
        expect(messages[1].data.parameters).toEqual({ delay: 1000 });
        expect(messages[2].data.action).toBe('stop');

        for (const msg of messages) {
          yield* msg.ack();
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('handles Date serialization correctly', () =>
      Effect.gen(function* () {
        const stream = yield* NatsStreamService;
        const streamName = testStreamName();
        const subject = `${streamName.toLowerCase()}.sensor.temp`;
        const consumerName = `consumer-${uniqueId()}`;
        streamsToCleanup.push(streamName);

        yield* stream.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
          storage: 'memory',
        });

        const now = new Date();
        const event: SensorEvent = {
          sensorId: 'sensor-001',
          value: 23.5,
          unit: 'celsius',
          timestamp: now,
        };

        yield* stream.publish(subject, SensorEvent, event);

        const consumer = yield* stream.getConsumer(streamName, consumerName, {
          deliverPolicy: 'all',
          ackPolicy: 'explicit',
        });

        const messages = yield* stream.fetch(consumer, SensorEvent, {
          max: 1,
          expires: 1000,
        });

        expect(messages.length).toBe(1);
        expect(messages[0].data.timestamp).toBeInstanceOf(Date);
        expect(messages[0].data.timestamp.getTime()).toBe(now.getTime());

        yield* messages[0].ack();
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });
});
