/**
 * Schema Registry Service Tests
 */

import { describe, expect } from 'vitest';
import { it } from '@effect/vitest';
import { Effect, Schema } from 'effect';
import {
  SchemaRegistry,
  SchemaNotFoundError,
  SchemaAlreadyRegisteredError,
  StreamSchemaNotFoundError,
} from '../index';

// Test schemas
const TestEventSchema = Schema.Struct({
  _tag: Schema.Literal('TestEvent'),
  id: Schema.String,
  timestamp: Schema.Number,
});

const AnotherSchema = Schema.Struct({
  name: Schema.String,
  value: Schema.Number,
});

describe('SchemaRegistry', () => {
  describe('register', () => {
    it.effect('registers a schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.register('TestEvent', TestEventSchema);

        const exists = yield* registry.has('TestEvent');
        expect(exists).toBe(true);
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );

    it.effect('fails on duplicate registration', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.register('DuplicateTest', TestEventSchema);

        const result = yield* registry
          .register('DuplicateTest', AnotherSchema)
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaAlreadyRegisteredError);
        }
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('registerOrUpdate', () => {
    it.effect('registers new schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.registerOrUpdate('NewSchema', TestEventSchema);

        const exists = yield* registry.has('NewSchema');
        expect(exists).toBe(true);
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );

    it.effect('updates existing schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.registerOrUpdate('UpdateTest', TestEventSchema);
        yield* registry.registerOrUpdate('UpdateTest', AnotherSchema);

        // Should succeed without error
        const exists = yield* registry.has('UpdateTest');
        expect(exists).toBe(true);
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('get', () => {
    it.effect('retrieves registered schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.registerOrUpdate('GetTest', TestEventSchema);

        const schema = yield* registry.get('GetTest');
        expect(schema).toBeDefined();
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );

    it.effect('fails for non-existent schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        const result = yield* registry.get('NonExistent').pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(SchemaNotFoundError);
        }
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('getOrNull', () => {
    it.effect('returns null for non-existent schema', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        const schema = yield* registry.getOrNull('NonExistent');
        expect(schema).toBeNull();
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('listIds', () => {
    it.effect('lists all registered schema IDs', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.registerOrUpdate('Schema1', TestEventSchema);
        yield* registry.registerOrUpdate('Schema2', AnotherSchema);

        const ids = yield* registry.listIds();
        expect(ids).toContain('Schema1');
        expect(ids).toContain('Schema2');
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('stream metadata', () => {
    it.effect('sets and retrieves stream metadata', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.setForStream('stream-1', {
          schemaId: 'TestEvent',
          contentType: 'application/json',
          registeredAt: Date.now(),
        });

        const meta = yield* registry.getForStream('stream-1');
        expect(meta.schemaId).toBe('TestEvent');
        expect(meta.contentType).toBe('application/json');
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );

    it.effect('fails for non-existent stream', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        const result = yield* registry
          .getForStream('non-existent-stream')
          .pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamSchemaNotFoundError);
        }
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );

    it.effect('sets metadata from Content-Type header', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.setForStreamFromContentType(
          'stream-ct',
          'application/json; schema=BlockEvent; version=2'
        );

        const meta = yield* registry.getForStream('stream-ct');
        expect(meta.schemaId).toBe('BlockEvent');
        expect(meta.contentType).toBe('application/json');
        expect(meta.version).toBe(2);
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('toStandardSchema', () => {
    it.effect('converts to Standard Schema V1', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        yield* registry.registerOrUpdate('StandardTest', TestEventSchema);

        const standardSchema = yield* registry.toStandardSchema('StandardTest');
        expect(standardSchema).toBeDefined();
        // Standard Schema V1 has a specific structure
        expect(standardSchema).toHaveProperty('~standard');
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });

  describe('parseContentType', () => {
    it.effect('parses Content-Type correctly', () =>
      Effect.gen(function* () {
        const registry = yield* SchemaRegistry;

        const parsed = registry.parseContentType('application/json; schema=Test');
        expect(parsed.mimeType).toBe('application/json');
        expect(parsed.schemaId).toBe('Test');
      }).pipe(Effect.provide(SchemaRegistry.Default))
    );
  });
});
