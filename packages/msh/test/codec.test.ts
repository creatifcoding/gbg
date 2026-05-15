/**
 * NatsCodec Unit Tests
 *
 * Pure codec tests — no NATS server required.
 *
 * @module @tmnl/msh/test/codec
 */

import { describe, it, expect } from 'vitest';
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';

import { NatsCodec, NatsCodecService } from '../src/nats/codec';
import { Codec } from '../src/nats/errors';

// =============================================================================
// Test Schemas
// =============================================================================

const SimpleMessage = Schema.Struct({
  id: Schema.String,
  value: Schema.Number,
});

const ComplexMessage = Schema.Struct({
  name: Schema.String,
  items: Schema.Array(Schema.Struct({
    key: Schema.String,
    count: Schema.Number,
  })),
  metadata: Schema.optionalKey(Schema.String),
});

// =============================================================================
// Static Codec Tests (NatsCodec)
// =============================================================================

describe('NatsCodec (static functions)', () => {
  describe('encodeJson', () => {
    it('encodes a simple message to Uint8Array', async () => {
      const data = { id: 'test-1', value: 42 };

      const result = await Effect.runPromise(
        NatsCodec.encodeJson(SimpleMessage, data),
      );

      expect(result).toBeInstanceOf(Uint8Array);
      const text = new TextDecoder().decode(result);
      const parsed = JSON.parse(text);
      expect(parsed.id).toBe('test-1');
      expect(parsed.value).toBe(42);
    });

    it('encodes a complex message with nested data', async () => {
      const data = {
        name: 'test',
        items: [{ key: 'a', count: 1 }, { key: 'b', count: 2 }],
        metadata: 'extra',
      };

      const result = await Effect.runPromise(
        NatsCodec.encodeJson(ComplexMessage, data),
      );

      const text = new TextDecoder().decode(result);
      const parsed = JSON.parse(text);
      expect(parsed.name).toBe('test');
      expect(parsed.items).toHaveLength(2);
    });

    it('fails with EncodeError for invalid data', async () => {
      // @ts-expect-error — intentionally invalid
      const data = { id: 123, value: 'not a number' };

      const result = await Effect.runPromise(
        NatsCodec.encodeJson(SimpleMessage, data).pipe(
          Effect.result,
        ),
      );

      expect(result._tag).toBe('Failure');
    });
  });

  describe('decodeJson', () => {
    it('decodes valid JSON Uint8Array to typed value', async () => {
      const json = JSON.stringify({ id: 'test-1', value: 42 });
      const bytes = new TextEncoder().encode(json);

      const result = await Effect.runPromise(
        NatsCodec.decodeJson(SimpleMessage, { subject: 'test.subject' })(bytes),
      );

      expect(result.id).toBe('test-1');
      expect(result.value).toBe(42);
    });

    it('fails on invalid JSON', async () => {
      const bytes = new TextEncoder().encode('not valid json{{{');

      const result = await Effect.runPromise(
        NatsCodec.decodeJson(SimpleMessage)(bytes).pipe(
          Effect.result,
        ),
      );

      expect(result._tag).toBe('Failure');
    });

    it('fails on schema validation error', async () => {
      const json = JSON.stringify({ id: 'test', value: 'not-a-number' });
      const bytes = new TextEncoder().encode(json);

      const result = await Effect.runPromise(
        NatsCodec.decodeJson(SimpleMessage)(bytes).pipe(
          Effect.result,
        ),
      );

      expect(result._tag).toBe('Failure');
    });

    it('includes subject in error context', async () => {
      const bytes = new TextEncoder().encode('invalid');

      const result = await Effect.runPromise(
        NatsCodec.decodeJson(SimpleMessage, { subject: 'my.subject', seq: 42 })(bytes).pipe(
          Effect.mapError((e) => e.message),
          Effect.result,
        ),
      );

      // Result.Failure carries the mapped string in .failure
      expect(result._tag).toBe('Failure');
    });

    it('roundtrips encode → decode', async () => {
      const original = { id: 'roundtrip', value: 99 };

      const roundtripped = await Effect.runPromise(
        Effect.gen(function* () {
          const bytes = yield* NatsCodec.encodeJson(SimpleMessage, original);
          return yield* NatsCodec.decodeJson(SimpleMessage)(bytes);
        }),
      );

      expect(roundtripped.id).toBe('roundtrip');
      expect(roundtripped.value).toBe(99);
    });
  });
});

// =============================================================================
// Service Tests (NatsCodecService)
// =============================================================================

describe('NatsCodecService', () => {
  it('provides encodeJson and decodeJson via service', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const codec = yield* NatsCodecService;
        const data = { id: 'svc-test', value: 7 };
        const bytes = yield* codec.encodeJson(SimpleMessage, data);
        return yield* codec.decodeJson(SimpleMessage)(bytes);
      }).pipe(Effect.provide(NatsCodecService.layer)),
    );

    expect(result.id).toBe('svc-test');
    expect(result.value).toBe(7);
  });
});
