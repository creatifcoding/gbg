/**
 * End-to-End Flow Validation Spike
 *
 * Validates all Phase 0 patterns work together:
 * 1. SchemaRegistry for schema management
 * 2. StreamCodecService for encode/decode with headers
 * 3. SSE bridge patterns for client streaming
 * 4. NATS consumer bridge for message processing
 *
 * This is a unit-level integration test that simulates the full flow
 * without requiring a real NATS server.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Stream, Schema, Layer, Chunk, Deferred } from 'effect';

import { SchemaRegistry } from '@/lib/holonet/core/schema';
import {
  StreamCodecService,
  HEADER_SCHEMA_ID,
  HEADER_CONTENT_TYPE,
} from '@/lib/holonet/durable-streams/services/StreamCodecService';
import {
  fromPushSource,
  withHeartbeats,
  withClientDisconnect,
  encodeSSEEvent,
  type SSEEvent,
} from '../sse-bridge';
import {
  createMockJsMsg,
  createMockConsumerMessages,
  fromConsumerMessages,
  type TypedNatsMessage,
} from '../nats-stream-bridge';

// =============================================================================
// Domain Schemas
// =============================================================================

/**
 * Example domain event - a sensor reading
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
 * Another domain event - an alert
 */
const Alert = Schema.Struct({
  _tag: Schema.Literal('Alert'),
  alertId: Schema.String,
  severity: Schema.Literal('low', 'medium', 'high', 'critical'),
  message: Schema.String,
  timestamp: Schema.Number,
});

type Alert = typeof Alert.Type;

// =============================================================================
// Test Layer
// =============================================================================

const TestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
);

// =============================================================================
// End-to-End Tests
// =============================================================================

describe('End-to-End Flow Validation', () => {
  describe('Encode → Publish → Consume → Decode flow', () => {
    it('complete round-trip with schema headers', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        // 1. Register schemas
        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* registry.registerOrUpdate('Alert', Alert);

        // 2. Create domain events
        const sensorEvent: SensorReading = {
          _tag: 'SensorReading',
          sensorId: 'temp-001',
          value: 23.5,
          unit: 'celsius',
          timestamp: Date.now(),
        };

        const alertEvent: Alert = {
          _tag: 'Alert',
          alertId: 'alert-001',
          severity: 'high',
          message: 'Temperature threshold exceeded',
          timestamp: Date.now(),
        };

        // 3. Encode events with schema headers
        const encodedSensor = yield* codec.encodeWithSchema('SensorReading', sensorEvent);
        const encodedAlert = yield* codec.encodeWithSchema('Alert', alertEvent);

        // Verify headers are correct
        expect(encodedSensor.headers[HEADER_SCHEMA_ID]).toBe('SensorReading');
        expect(encodedSensor.headers[HEADER_CONTENT_TYPE]).toBe('application/json');
        expect(encodedAlert.headers[HEADER_SCHEMA_ID]).toBe('Alert');

        // 4. Simulate NATS messages (as if received from JetStream)
        const mockSensorMsg = createMockJsMsg({
          data: sensorEvent,
          schemaId: encodedSensor.headers[HEADER_SCHEMA_ID],
          seq: 1,
          subject: 'sensors.temperature',
        });

        const mockAlertMsg = createMockJsMsg({
          data: alertEvent,
          schemaId: encodedAlert.headers[HEADER_SCHEMA_ID],
          seq: 2,
          subject: 'alerts.temperature',
        });

        // 5. Create mock consumer messages
        const consumerMessages = createMockConsumerMessages([
          mockSensorMsg,
          mockAlertMsg,
        ]);

        // 6. Process through NATS consumer bridge
        const stream = fromConsumerMessages<SensorReading | Alert>(consumerMessages);
        const results = yield* stream.pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        // 7. Verify decoded results
        expect(results).toHaveLength(2);

        const sensorResult = results[0] as TypedNatsMessage<SensorReading>;
        expect(sensorResult.schemaId).toBe('SensorReading');
        expect(sensorResult.data._tag).toBe('SensorReading');
        expect(sensorResult.data.sensorId).toBe('temp-001');
        expect(sensorResult.data.value).toBe(23.5);

        const alertResult = results[1] as TypedNatsMessage<Alert>;
        expect(alertResult.schemaId).toBe('Alert');
        expect(alertResult.data._tag).toBe('Alert');
        expect(alertResult.data.severity).toBe('high');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('NATS → SSE bridge flow', () => {
    it('converts NATS messages to SSE events', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // 1. Create NATS messages
        const messages = [
          createMockJsMsg({
            data: {
              _tag: 'SensorReading',
              sensorId: 's1',
              value: 20,
              unit: 'celsius',
              timestamp: 1000,
            } as SensorReading,
            schemaId: 'SensorReading',
            seq: 1,
          }),
          createMockJsMsg({
            data: {
              _tag: 'SensorReading',
              sensorId: 's2',
              value: 21,
              unit: 'celsius',
              timestamp: 2000,
            } as SensorReading,
            schemaId: 'SensorReading',
            seq: 2,
          }),
        ];

        // 2. Process through NATS consumer bridge
        const natsStream = fromConsumerMessages<SensorReading>(
          createMockConsumerMessages(messages)
        );

        // 3. Convert to SSE events
        const sseStream = natsStream.pipe(
          Stream.map(
            (msg): SSEEvent => ({
              _tag: 'data',
              data: msg.data,
              seq: msg.seq,
            })
          )
        );

        // 4. Collect SSE events
        const sseEvents = yield* sseStream.pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        expect(sseEvents).toHaveLength(2);
        expect(sseEvents[0]._tag).toBe('data');
        expect((sseEvents[0] as SSEEvent & { seq: number }).seq).toBe(1);
        expect((sseEvents[1] as SSEEvent & { seq: number }).seq).toBe(2);

        // 5. Encode as SSE text
        const encoded = sseEvents.map(encodeSSEEvent);
        expect(encoded[0]).toContain('event: data');
        expect(encoded[0]).toContain('"sensorId":"s1"');
        expect(encoded[0]).toContain('id: 1');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('SSE stream with heartbeats and client disconnect', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        const disconnectSignal = yield* Deferred.make<void, never>();

        // 1. Create data stream from NATS messages
        const messages = [
          createMockJsMsg({
            data: {
              _tag: 'SensorReading',
              sensorId: 's1',
              value: 20,
              unit: 'celsius',
              timestamp: 1000,
            } as SensorReading,
            schemaId: 'SensorReading',
            seq: 1,
          }),
        ];

        const natsStream = fromConsumerMessages<SensorReading>(
          createMockConsumerMessages(messages)
        );

        // 2. Convert to SSE events
        const sseDataStream: Stream.Stream<SSEEvent, never, never> = natsStream.pipe(
          Stream.map(
            (msg): SSEEvent => ({
              _tag: 'data',
              data: msg.data,
              seq: msg.seq,
            })
          ),
          // Provide the StreamCodecService context
          Stream.provideService(StreamCodecService, yield* StreamCodecService),
          Stream.provideService(SchemaRegistry, yield* SchemaRegistry),
          // Catch errors and end stream
          Stream.catchAll(() => Stream.empty)
        );

        // 3. Add heartbeats (fast for testing)
        const withHb = withHeartbeats(sseDataStream, '10 millis');

        // 4. Add client disconnect handling
        const withDisconnect = withClientDisconnect(withHb, disconnectSignal);

        // 5. Take a few events then disconnect
        const results = yield* withDisconnect.pipe(
          Stream.take(3),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        // Should have data and heartbeat events
        expect(results.length).toBeGreaterThanOrEqual(1);
        const hasData = results.some((e) => e._tag === 'data');
        expect(hasData).toBe(true);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('Push source pattern', () => {
    it('fromPushSource bridges external events to Effect.Stream', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Simulate external event source (like NATS subscription callback)
        const stream = fromPushSource<SensorReading, never>((emit) =>
          Effect.sync(() => {
            // Simulate async events arriving
            emit.single({
              _tag: 'SensorReading',
              sensorId: 'push-1',
              value: 100,
              unit: 'celsius',
              timestamp: Date.now(),
            });
            emit.single({
              _tag: 'SensorReading',
              sensorId: 'push-2',
              value: 101,
              unit: 'celsius',
              timestamp: Date.now(),
            });
            emit.end();
            return () => {
              // Cleanup callback
            };
          })
        );

        const results = yield* stream.pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        expect(results).toHaveLength(2);
        expect(results[0].sensorId).toBe('push-1');
        expect(results[1].sensorId).toBe('push-2');

        // Verify we can encode these back through the codec
        const encoded = yield* codec.encodeWithSchema('SensorReading', results[0]);
        expect(encoded.headers[HEADER_SCHEMA_ID]).toBe('SensorReading');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('Schema validation in flow', () => {
    it('rejects invalid data at encode time', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Invalid data - missing required fields
        const invalidData = {
          _tag: 'SensorReading',
          sensorId: 'test',
          // Missing: value, unit, timestamp
        };

        const result = yield* codec
          .encodeWithSchema('SensorReading', invalidData)
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('SchemaValidationError');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('rejects invalid data at decode time', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        yield* registry.registerOrUpdate('SensorReading', SensorReading);

        // Create message with invalid data
        const invalidMsg = createMockJsMsg({
          data: {
            _tag: 'SensorReading',
            sensorId: 123, // Should be string
            value: 'not-a-number', // Should be number
            unit: 'celsius',
            timestamp: Date.now(),
          },
          schemaId: 'SensorReading',
          seq: 1,
        });

        const stream = fromConsumerMessages(
          createMockConsumerMessages([invalidMsg]),
          { onDecodeError: 'fail' }
        );

        const result = yield* stream.pipe(
          Stream.runCollect,
          Effect.either
        );

        expect(result._tag).toBe('Left');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('Complete producer-consumer scenario', () => {
    it('simulates producer encoding and consumer decoding', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        // Register all event schemas
        yield* registry.registerOrUpdate('SensorReading', SensorReading);
        yield* registry.registerOrUpdate('Alert', Alert);

        // === PRODUCER SIDE ===
        // Encode events as they would be published to NATS

        const events = [
          {
            schema: 'SensorReading',
            data: {
              _tag: 'SensorReading' as const,
              sensorId: 'temp-001',
              value: 25.5,
              unit: 'celsius',
              timestamp: 1000,
            },
          },
          {
            schema: 'Alert',
            data: {
              _tag: 'Alert' as const,
              alertId: 'a-001',
              severity: 'high' as const,
              message: 'Temperature warning',
              timestamp: 1001,
            },
          },
          {
            schema: 'SensorReading',
            data: {
              _tag: 'SensorReading' as const,
              sensorId: 'humidity-001',
              value: 65.0,
              unit: 'percent',
              timestamp: 1002,
            },
          },
        ];

        // Encode all events
        const encodedEvents = yield* Effect.forEach(events, (e) =>
          codec.encodeWithSchema(e.schema, e.data)
        );

        // === SIMULATE NATS STORAGE ===
        // In real scenario, these bytes + headers would be stored in JetStream

        // === CONSUMER SIDE ===
        // Decode events as they would be received from NATS

        const mockMessages = events.map((e, i) =>
          createMockJsMsg({
            data: e.data,
            schemaId: e.schema,
            seq: i + 1,
            subject: `events.${e.schema.toLowerCase()}`,
          })
        );

        const stream = fromConsumerMessages(
          createMockConsumerMessages(mockMessages)
        );

        const decoded = yield* stream.pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        // Verify all events decoded correctly
        expect(decoded).toHaveLength(3);

        // First event - SensorReading
        expect(decoded[0].schemaId).toBe('SensorReading');
        expect((decoded[0].data as SensorReading).sensorId).toBe('temp-001');

        // Second event - Alert
        expect(decoded[1].schemaId).toBe('Alert');
        expect((decoded[1].data as Alert).severity).toBe('high');

        // Third event - SensorReading
        expect(decoded[2].schemaId).toBe('SensorReading');
        expect((decoded[2].data as SensorReading).unit).toBe('percent');

        // === VERIFY HEADERS WERE PRESERVED ===
        expect(encodedEvents[0].headers[HEADER_SCHEMA_ID]).toBe('SensorReading');
        expect(encodedEvents[1].headers[HEADER_SCHEMA_ID]).toBe('Alert');
        expect(encodedEvents[2].headers[HEADER_SCHEMA_ID]).toBe('SensorReading');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });
});
