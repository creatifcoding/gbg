/**
 * StreamCodecService Tests
 */

import { describe, it, expect } from 'vitest';
import { Effect, Schema, Layer } from 'effect';
import {
  StreamCodecService,
  CodecError,
  SchemaValidationError,
  MissingSchemaHeaderError,
  HEADER_SCHEMA_ID,
  HEADER_CONTENT_TYPE,
  createSchemaHeaders,
  extractSchemaId,
  hasSchemaHeaders,
  type JsMsgLike,
} from '../StreamCodecService';
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

// =============================================================================
// Test Helpers
// =============================================================================

const textEncoder = new TextEncoder();

/**
 * Create a mock JsMsg-like object
 */
const createMockMsg = (
  data: unknown,
  headers?: Record<string, string>
): JsMsgLike => ({
  data: textEncoder.encode(JSON.stringify(data)),
  headers: headers
    ? {
        get: (key: string) => headers[key] ?? null,
      }
    : undefined,
});

/**
 * Test layer with SchemaRegistry and StreamCodecService
 */
const TestLayer = Layer.mergeAll(
  SchemaRegistry.Default,
  StreamCodecService.Default
);

// =============================================================================
// Tests
// =============================================================================

describe('StreamCodecService', () => {
  describe('encodeJson', () => {
    it('encodes data to JSON bytes', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;
        const data = { hello: 'world', count: 42 };

        const bytes = yield* codec.encodeJson(data);

        const decoded = JSON.parse(new TextDecoder().decode(bytes));
        expect(decoded).toEqual(data);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on circular reference', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;
        const circular: Record<string, unknown> = { value: 1 };
        circular['self'] = circular;

        const result = yield* codec.encodeJson(circular).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(CodecError);
          expect((result.left as CodecError).operation).toBe('encode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('decodeJson', () => {
    it('decodes JSON bytes to data', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;
        const original = { hello: 'world', count: 42 };
        const bytes = textEncoder.encode(JSON.stringify(original));

        const decoded = yield* codec.decodeJson(bytes);

        expect(decoded).toEqual(original);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on invalid JSON', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;
        const invalidJson = textEncoder.encode('{ not valid json }');

        const result = yield* codec.decodeJson(invalidJson).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(CodecError);
          expect((result.left as CodecError).operation).toBe('decode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('encodeWithSchema', () => {
    it('encodes valid data with schema headers', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        // Register test schema
        yield* registry.registerOrUpdate('TestEvent', TestEvent);

        const data: TestEvent = {
          _tag: 'TestEvent',
          id: 'test-123',
          value: 42,
        };

        const result = yield* codec.encodeWithSchema('TestEvent', data);

        // Check bytes
        const decoded = JSON.parse(new TextDecoder().decode(result.bytes));
        expect(decoded).toEqual(data);

        // Check headers
        expect(result.headers[HEADER_SCHEMA_ID]).toBe('TestEvent');
        expect(result.headers[HEADER_CONTENT_TYPE]).toBe('application/json');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on schema validation error', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        yield* registry.registerOrUpdate('TestEvent', TestEvent);

        // Invalid data (missing required field)
        const invalidData = { _tag: 'TestEvent', id: 'test-123' };

        const result = yield* codec
          .encodeWithSchema('TestEvent', invalidData)
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaValidationError);
          expect((result.left as SchemaValidationError).operation).toBe('encode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on unknown schema', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;

        const result = yield* codec
          .encodeWithSchema('UnknownSchema', { data: 'test' })
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaNotFoundError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('decodeWithSchema', () => {
    it('decodes message using schema from headers', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        yield* registry.registerOrUpdate('TestEvent', TestEvent);

        const data: TestEvent = {
          _tag: 'TestEvent',
          id: 'test-456',
          value: 100,
        };

        const msg = createMockMsg(data, {
          [HEADER_SCHEMA_ID]: 'TestEvent',
          [HEADER_CONTENT_TYPE]: 'application/json',
        });

        const result = yield* codec.decodeWithSchema<TestEvent>(msg);

        expect(result.data).toEqual(data);
        expect(result.schemaId).toBe('TestEvent');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on missing schema header', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;

        const msg = createMockMsg({ data: 'test' }); // No headers

        const result = yield* codec.decodeWithSchema(msg).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(MissingSchemaHeaderError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on schema validation error', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        yield* registry.registerOrUpdate('TestEvent', TestEvent);

        // Invalid data
        const msg = createMockMsg(
          { _tag: 'TestEvent', id: 123 }, // id should be string
          { [HEADER_SCHEMA_ID]: 'TestEvent' }
        );

        const result = yield* codec.decodeWithSchema(msg).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaValidationError);
          expect((result.left as SchemaValidationError).operation).toBe('decode');
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('decodeWithKnownSchema', () => {
    it('decodes message with explicit schema', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;

        const data: TestEvent = {
          _tag: 'TestEvent',
          id: 'test-789',
          value: 200,
        };

        const msg = createMockMsg(data); // No headers needed

        const result = yield* codec.decodeWithKnownSchema(msg, TestEvent);

        expect(result).toEqual(data);
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));

    it('fails on schema validation error', () =>
      Effect.gen(function* () {
        const codec = yield* StreamCodecService;

        const msg = createMockMsg({ invalid: 'data' });

        const result = yield* codec
          .decodeWithKnownSchema(msg, TestEvent)
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaValidationError);
        }
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });

  describe('utilities', () => {
    it('createSchemaHeaders creates proper headers', () => {
      const headers = createSchemaHeaders('TestEvent');

      expect(headers[HEADER_SCHEMA_ID]).toBe('TestEvent');
      expect(headers[HEADER_CONTENT_TYPE]).toBe('application/json');
    });

    it('createSchemaHeaders with version', () => {
      const headers = createSchemaHeaders('TestEvent', 'application/json', '2');

      expect(headers[HEADER_SCHEMA_ID]).toBe('TestEvent');
      expect(headers['X-Schema-Version']).toBe('2');
    });

    it('extractSchemaId extracts from headers', () => {
      const msg = createMockMsg({}, { [HEADER_SCHEMA_ID]: 'MySchema' });

      expect(extractSchemaId(msg)).toBe('MySchema');
    });

    it('extractSchemaId returns null when no headers', () => {
      const msg = createMockMsg({});

      expect(extractSchemaId(msg)).toBeNull();
    });

    it('hasSchemaHeaders returns true when present', () => {
      const msg = createMockMsg({}, { [HEADER_SCHEMA_ID]: 'MySchema' });

      expect(hasSchemaHeaders(msg)).toBe(true);
    });

    it('hasSchemaHeaders returns false when absent', () => {
      const msg = createMockMsg({});

      expect(hasSchemaHeaders(msg)).toBe(false);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('encode then decode produces original data', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;
        const codec = yield* StreamCodecService;

        yield* registry.registerOrUpdate('TestEvent', TestEvent);

        const original: TestEvent = {
          _tag: 'TestEvent',
          id: 'round-trip-test',
          value: 999,
        };

        // Encode
        const encoded = yield* codec.encodeWithSchema('TestEvent', original);

        // Create mock message from encoded result
        const msg: JsMsgLike = {
          data: encoded.bytes,
          headers: {
            get: (key: string) =>
              (encoded.headers as unknown as Record<string, string>)[key] ?? null,
          },
        };

        // Decode
        const decoded = yield* codec.decodeWithSchema<TestEvent>(msg);

        expect(decoded.data).toEqual(original);
        expect(decoded.schemaId).toBe('TestEvent');
      }).pipe(Effect.provide(TestLayer), Effect.runPromise));
  });
});
