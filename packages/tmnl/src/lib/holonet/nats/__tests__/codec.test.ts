/**
 * NatsCodecService Unit Tests
 *
 * Tests the stream-native, parallelizable codec service.
 * These tests do NOT require a running NATS server.
 *
 * @module holonet/nats/__tests__/codec
 */

import { describe, it, expect } from 'vitest';
import { Effect, Chunk, Stream, Schema, pipe } from 'effect';

import { NatsCodecService, NatsCodec } from '../codec';

// =============================================================================
// Test Schemas
// =============================================================================

const SimpleMessage = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});
type SimpleMessage = typeof SimpleMessage.Type;

const ComplexMessage = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(Schema.Struct({
    key: Schema.String,
    count: Schema.Number,
  })),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});
type ComplexMessage = typeof ComplexMessage.Type;

// =============================================================================
// Static Codec Tests (NatsCodec)
// =============================================================================

describe('NatsCodec (static functions)', () => {
  describe('encodeJson', () => {
    it('encodes a simple message to Uint8Array', async () => {
      const data: SimpleMessage = { id: 'test-1', value: 42 };

      const result = await Effect.runPromise(
        NatsCodec.encodeJson(SimpleMessage, data)
      );

      expect(result).toBeInstanceOf(Uint8Array);

      // Verify it's valid JSON
      const text = new TextDecoder().decode(result);
      const parsed = JSON.parse(text);
      expect(parsed.id).toBe('test-1');
      expect(parsed.value).toBe(42);
    });

    it('encodes a complex message with nested data', async () => {
      const data: ComplexMessage = {
        name: 'test',
        items: [
          { key: 'a', count: 1 },
          { key: 'b', count: 2 },
        ],
        metadata: { foo: 'bar' },
      };

      const result = await Effect.runPromise(
        NatsCodec.encodeJson(ComplexMessage, data)
      );

      const text = new TextDecoder().decode(result);
      const parsed = JSON.parse(text);
      expect(parsed.name).toBe('test');
      expect(parsed.items).toHaveLength(2);
      expect(parsed.metadata.foo).toBe('bar');
    });

    it('fails with EncodeError for invalid data', async () => {
      // @ts-expect-error - intentionally invalid
      const data: SimpleMessage = { id: 123, value: 'not a number' };

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.encodeJson(SimpleMessage, data),
          Effect.either
        )
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('Codec/Encode');
      }
    });
  });

  describe('decodeJson', () => {
    it('decodes valid JSON Uint8Array to typed value', async () => {
      const json = JSON.stringify({ id: 'decoded-1', value: 100 });
      const bytes = new TextEncoder().encode(json);

      const result = await Effect.runPromise(
        NatsCodec.decodeJson(SimpleMessage, { subject: 'test.subject' })(bytes)
      );

      expect(result.id).toBe('decoded-1');
      expect(result.value).toBe(100);
    });

    it('fails with DecodeError for invalid JSON', async () => {
      const invalidJson = new TextEncoder().encode('not valid json {');

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.decodeJson(SimpleMessage, { subject: 'test.subject' })(invalidJson),
          Effect.either
        )
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('Codec/Decode');
        expect(result.left.message).toContain('Failed to parse JSON');
        expect(result.left.subject).toBe('test.subject');
      }
    });

    it('fails with DecodeError for schema validation errors', async () => {
      const wrongSchema = JSON.stringify({ id: 'test', value: 'not a number' });
      const bytes = new TextEncoder().encode(wrongSchema);

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.decodeJson(SimpleMessage, { subject: 'test.subject' })(bytes),
          Effect.either
        )
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('Codec/Decode');
        expect(result.left.message).toContain('Schema validation failed');
      }
    });

    it('includes seq in error context when provided', async () => {
      const invalidJson = new TextEncoder().encode('{}');

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.decodeJson(SimpleMessage, { subject: 'test.subject', seq: 42 })(invalidJson),
          Effect.either
        )
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left.message).toContain('seq: 42');
      }
    });
  });

  describe('roundtrip', () => {
    it('encode then decode returns original value', async () => {
      const original: SimpleMessage = { id: 'roundtrip', value: 999 };

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.encodeJson(SimpleMessage, original),
          Effect.flatMap((bytes) => NatsCodec.decodeJson(SimpleMessage)(bytes))
        )
      );

      expect(result).toEqual(original);
    });

    it('handles complex nested structures in roundtrip', async () => {
      const original: ComplexMessage = {
        name: 'complex',
        items: [
          { key: 'first', count: 10 },
          { key: 'second', count: 20 },
        ],
        metadata: { type: 'test', version: '1.0' },
      };

      const result = await Effect.runPromise(
        pipe(
          NatsCodec.encodeJson(ComplexMessage, original),
          Effect.flatMap((bytes) => NatsCodec.decodeJson(ComplexMessage)(bytes))
        )
      );

      expect(result).toEqual(original);
    });
  });
});

// =============================================================================
// Service Tests (NatsCodecService)
// =============================================================================

describe('NatsCodecService', () => {
  const TestLayer = NatsCodecService.Default;

  describe('single-item operations', () => {
    it('encodeJson works through service', async () => {
      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        const data: SimpleMessage = { id: 'svc-1', value: 50 };
        return yield* codec.encodeJson(SimpleMessage, data);
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('decodeJson works through service', async () => {
      const json = JSON.stringify({ id: 'svc-2', value: 75 });
      const bytes = new TextEncoder().encode(json);

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        return yield* codec.decodeJson(SimpleMessage)(bytes);
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);
      expect(result.id).toBe('svc-2');
      expect(result.value).toBe(75);
    });
  });

  describe('stream transforms', () => {
    it('encodeJsonStream transforms stream of values to encoded items', async () => {
      const items: SimpleMessage[] = [
        { id: 'stream-1', value: 1 },
        { id: 'stream-2', value: 2 },
        { id: 'stream-3', value: 3 },
      ];

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;

        const results = yield* pipe(
          Stream.fromIterable(items),
          codec.encodeJsonStream(SimpleMessage),
          Stream.runCollect
        );

        return Chunk.toArray(results);
      }).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);

      expect(results).toHaveLength(3);
      expect(results[0].original.id).toBe('stream-1');
      expect(results[0].bytes).toBeInstanceOf(Uint8Array);
      expect(results[2].original.id).toBe('stream-3');
    });

    it('decodeJsonStream transforms stream of bytes to decoded values', async () => {
      const items: SimpleMessage[] = [
        { id: 'decode-1', value: 10 },
        { id: 'decode-2', value: 20 },
      ];
      const byteStreams = items.map((item) =>
        new TextEncoder().encode(JSON.stringify(item))
      );

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;

        const results = yield* pipe(
          Stream.fromIterable(byteStreams),
          codec.decodeJsonStream(SimpleMessage, { subject: 'test' }),
          Stream.runCollect
        );

        return Chunk.toArray(results);
      }).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('decode-1');
      expect(results[1].id).toBe('decode-2');
    });

    it('encodeJsonStream respects concurrency option', async () => {
      // Create enough items to test parallelism
      const items: SimpleMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `parallel-${i}`,
        value: i,
      }));

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;

        const results = yield* pipe(
          Stream.fromIterable(items),
          codec.encodeJsonStream(SimpleMessage, { concurrency: 4 }),
          Stream.runCollect
        );

        return Chunk.toArray(results);
      }).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);
      expect(results).toHaveLength(10);
    });
  });

  describe('batch operations', () => {
    it('encodeBatch encodes chunk of values in parallel', async () => {
      const items = Chunk.fromIterable([
        { id: 'batch-1', value: 100 },
        { id: 'batch-2', value: 200 },
        { id: 'batch-3', value: 300 },
      ] as SimpleMessage[]);

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        return yield* codec.encodeBatch(SimpleMessage, items, { concurrency: 2 });
      }).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);
      const arr = Chunk.toArray(results);

      expect(arr).toHaveLength(3);
      arr.forEach((item) => {
        expect(item.bytes).toBeInstanceOf(Uint8Array);
        expect(item.original).toHaveProperty('id');
      });
    });

    it('decodeBatch decodes chunk of bytes in parallel', async () => {
      const items = [
        { id: 'dbatch-1', value: 111 },
        { id: 'dbatch-2', value: 222 },
      ] as SimpleMessage[];
      const bytes = Chunk.fromIterable(
        items.map((item) => new TextEncoder().encode(JSON.stringify(item)))
      );

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        return yield* codec.decodeBatch(SimpleMessage, bytes, { subject: 'batch' });
      }).pipe(Effect.provide(TestLayer));

      const results = await Effect.runPromise(program);
      const arr = Chunk.toArray(results);

      expect(arr).toHaveLength(2);
      expect(arr[0].value.id).toBe('dbatch-1');
      expect(arr[0].index).toBe(0);
      expect(arr[1].value.id).toBe('dbatch-2');
      expect(arr[1].index).toBe(1);
    });

    it('decodeBatch fails on first decode error', async () => {
      const bytes = Chunk.fromIterable([
        new TextEncoder().encode(JSON.stringify({ id: 'valid', value: 1 })),
        new TextEncoder().encode('invalid json'),
        new TextEncoder().encode(JSON.stringify({ id: 'also-valid', value: 2 })),
      ]);

      const program = Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        return yield* pipe(
          codec.decodeBatch(SimpleMessage, bytes),
          Effect.either
        );
      }).pipe(Effect.provide(TestLayer));

      const result = await Effect.runPromise(program);

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('Codec/Decode');
      }
    });
  });
});
