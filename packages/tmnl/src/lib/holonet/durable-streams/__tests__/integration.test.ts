/**
 * Durable-Streams Integration Tests
 *
 * Tests the full durable-streams ↔ NATS bridge with real NATS server.
 * Covers:
 * - Schema registration and lookup
 * - Codec encode/decode with headers
 * - JetStream publish with schema headers
 * - Consumer offset tracking
 * - Schema passthrough via headers
 *
 * Requires NATS server with JetStream enabled (docker compose up nats)
 *
 * @module holonet/durable-streams/__tests__/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Schema, pipe } from 'effect';

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

// Helper to convert SchemaHeaders to Record<string, string> for NATS
const headersToRecord = (headers: SchemaHeaders): Record<string, string> => ({
  [HEADER_SCHEMA_ID]: headers[HEADER_SCHEMA_ID],
  [HEADER_CONTENT_TYPE]: headers[HEADER_CONTENT_TYPE],
});

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';

// Create test connection layer
const TestConnectionLayer = NatsConnectionServiceCustom({
  servers: TEST_SERVERS,
  name: 'durable-streams-integration-test',
  debug: false,
});

// Unique test identifiers to avoid conflicts
const timestamp = Date.now();
const uniqueId = () => `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
const testStreamName = () => `TEST_DS_${uniqueId()}`.toUpperCase();

// =============================================================================
// Test Schemas
// =============================================================================

/**
 * Domain event - sensor reading for testing schema validation
 */
const SensorReading = Schema.Struct({
  _tag: Schema.Literal('SensorReading'),
  sensorId: Schema.String,
  value: Schema.Number,
  unit: Schema.String,
  timestamp: Schema.Number,
});

type SensorReading = typeof SensorReading.Type;

/**
 * Domain event - alert for testing multiple schemas
 */
const AlertEvent = Schema.Struct({
  _tag: Schema.Literal('AlertEvent'),
  alertId: Schema.String,
  severity: Schema.Literal('low', 'medium', 'high', 'critical'),
  message: Schema.String,
  timestamp: Schema.Number,
});

type AlertEvent = typeof AlertEvent.Type;

// =============================================================================
// Test Layer
// =============================================================================

/**
 * Full integration test layer with all services
 */
const IntegrationTestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
).pipe(
  Layer.provideMerge(NatsStreamService.Default),
  Layer.provideMerge(NatsInnerService.Default),
  Layer.provideMerge(TestConnectionLayer)
);

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test sensor reading
 */
const createSensorReading = (
  sensorId: string,
  value: number
): SensorReading => ({
  _tag: 'SensorReading',
  sensorId,
  value,
  unit: 'celsius',
  timestamp: Date.now(),
});

/**
 * Create a test alert
 */
const createAlert = (
  alertId: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string
): AlertEvent => ({
  _tag: 'AlertEvent',
  alertId,
  severity,
  message,
  timestamp: Date.now(),
});

/**
 * Cleanup helper - delete stream if exists
 */
const cleanupStream = (streamName: string) =>
  Effect.gen(function* () {
    const nats = yield* NatsStreamService;
    yield* pipe(
      nats.deleteStream(streamName),
      Effect.catchAll(() => Effect.void)
    );
  });

// =============================================================================
// Integration Tests
// =============================================================================

describe('Durable-Streams Integration Tests', () => {
  const streamsToCleanup: string[] = [];

  beforeEach(() => {
    streamsToCleanup.length = 0;
  });

  afterEach(async () => {
    // Clean up any streams created during tests
    for (const streamName of streamsToCleanup) {
      await Effect.runPromise(
        cleanupStream(streamName).pipe(Effect.provide(IntegrationTestLayer))
      );
    }
  });

  describe('SchemaRegistry Integration', () => {
    it('registers and retrieves schemas', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        // Register schemas
        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* registry.registerOrUpdate('AlertEvent', AlertEvent);

        // Retrieve and verify
        const sensorSchema = yield* registry.get('SensorReading');
        const alertSchema = yield* registry.get('AlertEvent');

        expect(sensorSchema).toBeDefined();
        expect(alertSchema).toBeDefined();

        // List all registered schemas
        const all = yield* registry.listIds();
        expect(all).toContain('SensorReading');
        expect(all).toContain('AlertEvent');
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));

    it('returns error for unknown schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        const result = yield* pipe(
          registry.get('NonExistentSchema'),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SchemaNotFoundError');
        }
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));
  });

  describe('StreamCodecService Integration', () => {
    it('encodes and decodes with schema headers', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        // Register schema
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Create and encode event
        const event = createSensorReading('sensor-001', 23.5);
        const encoded = yield* codec.encodeWithSchema('SensorReading', event);

        // Verify headers
        expect(encoded.headers[HEADER_SCHEMA_ID]).toBe('SensorReading');
        expect(encoded.bytes).toBeInstanceOf(Uint8Array);
        expect(encoded.bytes.length).toBeGreaterThan(0);

        // Create mock message for decode
        const mockMsg = {
          data: encoded.bytes,
          headers: { get: (key: string) => encoded.headers[key as keyof typeof encoded.headers] ?? null },
        };

        // Decode and verify
        const decoded = yield* codec.decodeWithSchema(mockMsg);

        expect(decoded.schemaId).toBe('SensorReading');
        expect((decoded.data as SensorReading).sensorId).toBe('sensor-001');
        expect((decoded.data as SensorReading).value).toBe(23.5);
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));

    it('validates data against schema on encode', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Invalid data - missing required fields
        const invalidEvent = {
          _tag: 'SensorReading' as const,
          sensorId: 'test',
          // Missing: value, unit, timestamp
        };

        const result = yield* pipe(
          codec.encodeWithSchema('SensorReading', invalidEvent),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SchemaValidationError');
        }
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));
  });

  describe('NATS JetStream Integration', () => {
    it('creates stream and publishes with schema headers', () =>
      Effect.gen(function* () {
        const nats = yield* NatsStreamService;
        const inner = yield* NatsInnerService;
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        // Register schema
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Create stream
        yield* nats.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
        });

        // Encode event
        const event = createSensorReading('sensor-001', 25.0);
        const encoded = yield* codec.encodeWithSchema('SensorReading', event);

        // Publish with headers via NatsInnerService.jsPublish
        const subject = `${streamName.toLowerCase()}.sensors.temp`;
        const pubAck = yield* inner.jsPublish(subject, encoded.bytes, {
          headers: headersToRecord(encoded.headers),
        });

        expect(pubAck.seq).toBeGreaterThan(0);
        expect(pubAck.stream).toBe(streamName);
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));

    it('fetches messages with schema headers preserved', () =>
      Effect.gen(function* () {
        const nats = yield* NatsStreamService;
        const inner = yield* NatsInnerService;
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        // Setup
        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* nats.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
        });

        // Publish multiple events
        const subject = `${streamName.toLowerCase()}.sensors`;
        const events = [
          createSensorReading('s1', 20.0),
          createSensorReading('s2', 21.0),
          createSensorReading('s3', 22.0),
        ];

        for (const event of events) {
          const encoded = yield* codec.encodeWithSchema('SensorReading', event);
          yield* inner.jsPublish(subject, encoded.bytes, {
            headers: headersToRecord(encoded.headers),
          });
        }

        // Create consumer and fetch
        const consumerName = `consumer_${uniqueId()}`;
        const consumer = yield* nats.getConsumer(streamName, consumerName, {
          durableName: consumerName,
          ackPolicy: 'explicit',
          deliverPolicy: 'all',
        });

        // Fetch with Schema (typed fetch)
        const messages = yield* nats.fetch(consumer, SensorReading, { max: 10 });

        expect(messages.length).toBe(3);

        // Verify first message
        expect(messages[0].data.sensorId).toBe('s1');
        expect(messages[0].data.value).toBe(20.0);

        // Ack all messages
        for (const msg of messages) {
          yield* msg.ack();
        }
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));
  });

  describe('Schema Passthrough End-to-End', () => {
    it('complete producer-consumer flow with schema headers', () =>
      Effect.gen(function* () {
        const nats = yield* NatsStreamService;
        const inner = yield* NatsInnerService;
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        // Register multiple schemas
        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* registry.registerOrUpdate('AlertEvent', AlertEvent);

        // Create stream with wildcard subject
        yield* nats.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
        });

        // === PRODUCER: Publish mixed event types ===
        const mixedEvents = [
          { schema: 'SensorReading', data: createSensorReading('temp-1', 22.5) },
          {
            schema: 'AlertEvent',
            data: createAlert('a1', 'high', 'Temperature rising'),
          },
          { schema: 'SensorReading', data: createSensorReading('temp-2', 24.0) },
          {
            schema: 'AlertEvent',
            data: createAlert('a2', 'critical', 'Threshold exceeded'),
          },
        ];

        for (const event of mixedEvents) {
          const encoded = yield* codec.encodeWithSchema(event.schema, event.data);
          const subject = `${streamName.toLowerCase()}.${event.schema.toLowerCase()}`;
          yield* inner.jsPublish(subject, encoded.bytes, {
            headers: headersToRecord(encoded.headers),
          });
        }

        // === CONSUMER: Fetch and decode with schema dispatch ===
        // Fetch raw via inner consumer to get headers
        const consumer = yield* inner.consumers.get(streamName);
        const messagesIter = yield* inner.consumers.consume(consumer);

        // Collect messages manually
        const rawMessages: Array<{
          data: Uint8Array;
          headers: { get(key: string): string | null };
          ack: () => void;
        }> = [];

        // Use async iteration to collect
        const collected = yield* Effect.promise(async () => {
          const results: typeof rawMessages = [];
          let count = 0;
          for await (const msg of messagesIter) {
            results.push({
              data: msg.data,
              headers: { get: (key: string) => msg.headers?.get(key) ?? null },
              ack: () => msg.ack(),
            });
            count++;
            if (count >= 4) break;
          }
          return results;
        });

        expect(collected.length).toBe(4);

        // Decode each message using its schema header
        const decodedEvents: Array<{
          schemaId: string;
          data: SensorReading | AlertEvent;
        }> = [];

        for (const msg of collected) {
          const decoded = yield* codec.decodeWithSchema(msg);
          decodedEvents.push(decoded as { schemaId: string; data: SensorReading | AlertEvent });
          msg.ack();
        }

        // Verify schema dispatch worked correctly
        expect(decodedEvents[0].schemaId).toBe('SensorReading');
        expect((decodedEvents[0].data as SensorReading)._tag).toBe('SensorReading');

        expect(decodedEvents[1].schemaId).toBe('AlertEvent');
        expect((decodedEvents[1].data as AlertEvent)._tag).toBe('AlertEvent');
        expect((decodedEvents[1].data as AlertEvent).severity).toBe('high');

        expect(decodedEvents[2].schemaId).toBe('SensorReading');
        expect(decodedEvents[3].schemaId).toBe('AlertEvent');
        expect((decodedEvents[3].data as AlertEvent).severity).toBe('critical');
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));
  });

  describe('Consumer Offset Tracking', () => {
    it('resumes from last acknowledged offset', { timeout: 15000 }, () =>
      Effect.gen(function* () {
        const nats = yield* NatsStreamService;
        const inner = yield* NatsInnerService;
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        const streamName = testStreamName();
        streamsToCleanup.push(streamName);

        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* nats.ensureStream({
          name: streamName,
          subjects: [`${streamName.toLowerCase()}.>`],
        });

        // Publish 5 events
        const subject = `${streamName.toLowerCase()}.sensors`;
        for (let i = 1; i <= 5; i++) {
          const encoded = yield* codec.encodeWithSchema(
            'SensorReading',
            createSensorReading(`s${i}`, i * 10)
          );
          yield* inner.jsPublish(subject, encoded.bytes, {
            headers: headersToRecord(encoded.headers),
          });
        }

        const consumerName = `consumer_${uniqueId()}`;

        // First fetch: get 3 messages and ack them
        const consumer1 = yield* nats.getConsumer(streamName, consumerName, {
          durableName: consumerName,
          ackPolicy: 'explicit',
          deliverPolicy: 'all',
        });

        const batch1 = yield* nats.fetch(consumer1, SensorReading, { max: 3 });
        expect(batch1.length).toBe(3);

        for (const msg of batch1) {
          yield* msg.ack();
        }

        // Small delay to ensure acks are processed
        yield* Effect.sleep('100 millis');

        // Second fetch: should get remaining 2 messages
        // Reconnect to consumer (simulates client reconnection)
        const consumer2 = yield* nats.getConsumer(streamName, consumerName);

        const batch2 = yield* nats.fetch(consumer2, SensorReading, { max: 10 });
        expect(batch2.length).toBe(2);

        // Verify we got messages 4 and 5
        expect(batch2[0].data.sensorId).toBe('s4');
        expect(batch2[1].data.sensorId).toBe('s5');
      }).pipe(Effect.provide(IntegrationTestLayer), Effect.runPromise));
  });
});
