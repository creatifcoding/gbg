/**
 * NATS Stream Bridge Spike Tests
 *
 * Validates the NATS consumer → Effect.Stream bridge patterns.
 */

import { describe, it, expect } from 'vitest';
import { Effect, Stream, Schema, Layer, Chunk } from 'effect';

import {
  jsMessageToMsgLike,
  createTypedMessage,
  decodeJsMessage,
  decodeJsMessageWithKnownSchema,
  fromConsumerMessages,
  fromConsumerMessagesWithSchema,
  createMockJsMsg,
  createMockConsumerMessages,
} from '../nats-stream-bridge';
import {
  StreamCodecService,
  MissingSchemaHeaderError,
  SchemaValidationError,
  HEADER_SCHEMA_ID,
} from '@/lib/holonet/durable-streams/services/StreamCodecService';
import { SchemaRegistry, SchemaNotFoundError } from '@/lib/holonet/core/schema';

// =============================================================================
// Test Schemas
// =============================================================================

const TestEvent = Schema.Struct({
  _tag: Schema.Literal('TestEvent'),
  id: Schema.String,
  value: Schema.Number,
});

type TestEvent = typeof TestEvent.Type;

const AnotherEvent = Schema.Struct({
  _tag: Schema.Literal('AnotherEvent'),
  name: Schema.String,
});

type AnotherEvent = typeof AnotherEvent.Type;

// =============================================================================
// Test Layer
// =============================================================================

const TestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
);

// Helper to run with registered schemas
const withRegisteredSchemas = <A, E, R>(
  effect: Effect.Effect<A, E, R | StreamCodecService | SchemaRegistry>
) =>
  Effect.gen(function* () {
    const registry = yield* SchemaRegistry;
    yield* registry.registerOrUpdate('TestEvent', TestEvent);
    yield* registry.registerOrUpdate('AnotherEvent', AnotherEvent);
    return yield* effect;
  }).pipe(Effect.provide(TestLayer));

// =============================================================================
// Tests
// =============================================================================

describe('NATS Stream Bridge Spike', () => {
  describe('jsMessageToMsgLike', () => {
    it('converts JsMsg to JsMsgLike interface', () => {
      const msg = createMockJsMsg({
        data: { test: 'data' },
        schemaId: 'TestSchema',
        seq: 42,
      });

      const msgLike = jsMessageToMsgLike(msg);

      expect(msgLike.data).toEqual(msg.data);
      expect(msgLike.headers?.get(HEADER_SCHEMA_ID)).toBe('TestSchema');
    });

    it('handles messages without headers', () => {
      const msg = createMockJsMsg({
        data: { test: 'data' },
        // No schemaId = no headers
      });

      const msgLike = jsMessageToMsgLike(msg);

      expect(msgLike.data).toBeDefined();
      expect(msgLike.headers).toBeUndefined();
    });
  });

  describe('createTypedMessage', () => {
    it('creates TypedNatsMessage from JsMsg and decoded data', () => {
      const msg = createMockJsMsg({
        data: { _tag: 'TestEvent', id: 'test-1', value: 100 },
        schemaId: 'TestEvent',
        seq: 10,
        subject: 'events.test',
      });

      const decoded: TestEvent = { _tag: 'TestEvent', id: 'test-1', value: 100 };
      const typed = createTypedMessage(msg, decoded, 'TestEvent');

      expect(typed.data).toEqual(decoded);
      expect(typed.schemaId).toBe('TestEvent');
      expect(typed.seq).toBe(10);
      expect(typed.subject).toBe('events.test');
      expect(typeof typed.ack).toBe('function');
      expect(typeof typed.nak).toBe('function');
    });
  });

  describe('decodeJsMessage', () => {
    it('decodes message using schema from headers', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const msg = createMockJsMsg({
            data: { _tag: 'TestEvent', id: 'decode-test', value: 42 },
            schemaId: 'TestEvent',
          });

          const result = yield* decodeJsMessage<TestEvent>(msg);

          expect(result.data).toEqual({
            _tag: 'TestEvent',
            id: 'decode-test',
            value: 42,
          });
          expect(result.schemaId).toBe('TestEvent');
        })
      ).pipe(Effect.runPromise));

    it('fails on missing schema header', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const msg = createMockJsMsg({
            data: { test: 'data' },
            // No schemaId
          });

          const result = yield* decodeJsMessage(msg).pipe(Effect.either);

          expect(result._tag).toBe('Left');
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(MissingSchemaHeaderError);
          }
        })
      ).pipe(Effect.runPromise));

    it('fails on unknown schema', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const msg = createMockJsMsg({
            data: { test: 'data' },
            schemaId: 'UnknownSchema',
          });

          const result = yield* decodeJsMessage(msg).pipe(Effect.either);

          expect(result._tag).toBe('Left');
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(SchemaNotFoundError);
          }
        })
      ).pipe(Effect.runPromise));

    it('fails on validation error', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const msg = createMockJsMsg({
            data: { _tag: 'TestEvent', id: 123, value: 'not-a-number' }, // Wrong types
            schemaId: 'TestEvent',
          });

          const result = yield* decodeJsMessage(msg).pipe(Effect.either);

          expect(result._tag).toBe('Left');
          if (result._tag === 'Left') {
            expect(result.left).toBeInstanceOf(SchemaValidationError);
          }
        })
      ).pipe(Effect.runPromise));
  });

  describe('decodeJsMessageWithKnownSchema', () => {
    it('decodes message with explicit schema', () =>
      Effect.gen(function* () {
        const msg = createMockJsMsg({
          data: { _tag: 'TestEvent', id: 'known-schema', value: 99 },
          // No schemaId header needed
        });

        const result = yield* decodeJsMessageWithKnownSchema(
          msg,
          TestEvent,
          'TestEvent'
        );

        expect(result.data).toEqual({
          _tag: 'TestEvent',
          id: 'known-schema',
          value: 99,
        });
        expect(result.schemaId).toBe('TestEvent');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on validation error', () =>
      Effect.gen(function* () {
        const msg = createMockJsMsg({
          data: { invalid: 'data' },
        });

        const result = yield* decodeJsMessageWithKnownSchema(
          msg,
          TestEvent,
          'TestEvent'
        ).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaValidationError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('fromConsumerMessages', () => {
    it('decodes stream of messages', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const messages = createMockConsumerMessages([
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'msg-1', value: 1 },
              schemaId: 'TestEvent',
              seq: 1,
            }),
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'msg-2', value: 2 },
              schemaId: 'TestEvent',
              seq: 2,
            }),
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'msg-3', value: 3 },
              schemaId: 'TestEvent',
              seq: 3,
            }),
          ]);

          const stream = fromConsumerMessages<TestEvent>(messages);
          const results = yield* stream.pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          );

          expect(results).toHaveLength(3);
          expect(results[0].data.id).toBe('msg-1');
          expect(results[1].data.id).toBe('msg-2');
          expect(results[2].data.id).toBe('msg-3');
        })
      ).pipe(Effect.runPromise));

    it('skips messages without schema when configured', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const messages = createMockConsumerMessages([
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'msg-1', value: 1 },
              schemaId: 'TestEvent',
              seq: 1,
            }),
            createMockJsMsg({
              data: { no: 'schema' },
              // No schemaId - will be skipped
              seq: 2,
            }),
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'msg-3', value: 3 },
              schemaId: 'TestEvent',
              seq: 3,
            }),
          ]);

          const stream = fromConsumerMessages<TestEvent>(messages, {
            onSchemaNotFound: 'skip',
          });
          const results = yield* stream.pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          );

          expect(results).toHaveLength(2);
          expect(results[0].seq).toBe(1);
          expect(results[1].seq).toBe(3);
        })
      ).pipe(Effect.runPromise));

    it('fails on missing schema when configured to fail', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const messages = createMockConsumerMessages([
            createMockJsMsg({
              data: { no: 'schema' },
              seq: 1,
            }),
          ]);

          const stream = fromConsumerMessages(messages, {
            onSchemaNotFound: 'fail',
          });
          const result = yield* stream.pipe(
            Stream.runCollect,
            Effect.either
          );

          expect(result._tag).toBe('Left');
        })
      ).pipe(Effect.runPromise));

    it('handles mixed schemas', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const messages = createMockConsumerMessages([
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'test-1', value: 10 },
              schemaId: 'TestEvent',
              seq: 1,
            }),
            createMockJsMsg({
              data: { _tag: 'AnotherEvent', name: 'Alice' },
              schemaId: 'AnotherEvent',
              seq: 2,
            }),
          ]);

          const stream = fromConsumerMessages(messages);
          const results = yield* stream.pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          );

          expect(results).toHaveLength(2);
          expect(results[0].schemaId).toBe('TestEvent');
          expect(results[1].schemaId).toBe('AnotherEvent');
        })
      ).pipe(Effect.runPromise));
  });

  describe('fromConsumerMessagesWithSchema', () => {
    it('decodes all messages with known schema', () =>
      Effect.gen(function* () {
        const messages = createMockConsumerMessages([
          createMockJsMsg({
            data: { _tag: 'TestEvent', id: 'known-1', value: 100 },
            seq: 1,
          }),
          createMockJsMsg({
            data: { _tag: 'TestEvent', id: 'known-2', value: 200 },
            seq: 2,
          }),
        ]);

        const stream = fromConsumerMessagesWithSchema(
          messages,
          TestEvent,
          'TestEvent'
        );
        const results = yield* stream.pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        );

        expect(results).toHaveLength(2);
        expect(results[0].data.value).toBe(100);
        expect(results[1].data.value).toBe(200);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('concurrency options', () => {
    it('processes messages with concurrency', () =>
      withRegisteredSchemas(
        Effect.gen(function* () {
          const messages = createMockConsumerMessages([
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'c1', value: 1 },
              schemaId: 'TestEvent',
              seq: 1,
            }),
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'c2', value: 2 },
              schemaId: 'TestEvent',
              seq: 2,
            }),
            createMockJsMsg({
              data: { _tag: 'TestEvent', id: 'c3', value: 3 },
              schemaId: 'TestEvent',
              seq: 3,
            }),
          ]);

          const stream = fromConsumerMessages<TestEvent>(messages, {
            concurrency: 3,
            ordered: true,
          });
          const results = yield* stream.pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          );

          expect(results).toHaveLength(3);
          // With ordered: true, results should maintain order
          expect(results[0].seq).toBe(1);
          expect(results[1].seq).toBe(2);
          expect(results[2].seq).toBe(3);
        })
      ).pipe(Effect.runPromise));
  });
});
