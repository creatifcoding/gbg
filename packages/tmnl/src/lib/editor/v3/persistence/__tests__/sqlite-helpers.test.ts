/**
 * SQLite Schema Helpers Tests
 *
 * Unit tests for SQLite-compatible schema transforms.
 * Uses vitest (no SQLite dependency).
 */

import { describe, it, expect } from 'vitest';
import { Option, Schema } from 'effect';

import {
  SqliteBoolean,
  NullableJsonFromString,
  NullableJsonFromStringTyped,
} from '../sqlite-helpers';

describe('SqliteBoolean', () => {
  it('decodes 1 to true', () => {
    const result = Schema.decodeUnknownSync(SqliteBoolean)(1);
    expect(result).toBe(true);
  });

  it('decodes 0 to false', () => {
    const result = Schema.decodeUnknownSync(SqliteBoolean)(0);
    expect(result).toBe(false);
  });

  it('decodes true to true (passthrough)', () => {
    const result = Schema.decodeUnknownSync(SqliteBoolean)(true);
    expect(result).toBe(true);
  });

  it('decodes false to false (passthrough)', () => {
    const result = Schema.decodeUnknownSync(SqliteBoolean)(false);
    expect(result).toBe(false);
  });

  it('encodes true to 1', () => {
    const result = Schema.encodeSync(SqliteBoolean)(true);
    expect(result).toBe(1);
  });

  it('encodes false to 0', () => {
    const result = Schema.encodeSync(SqliteBoolean)(false);
    expect(result).toBe(0);
  });
});

describe('NullableJsonFromString', () => {
  it('decodes null to Option.none()', () => {
    const result = Schema.decodeUnknownSync(NullableJsonFromString)(null);
    expect(Option.isNone(result)).toBe(true);
  });

  it('decodes JSON string to Option.some(value)', () => {
    const result = Schema.decodeUnknownSync(NullableJsonFromString)(
      '{"key":"value"}'
    );
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result)).toEqual({ key: 'value' });
  });

  it('decodes array JSON to Option.some(array)', () => {
    const result = Schema.decodeUnknownSync(NullableJsonFromString)('[1,2,3]');
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result)).toEqual([1, 2, 3]);
  });

  it('decodes primitive JSON to Option.some(primitive)', () => {
    const result = Schema.decodeUnknownSync(NullableJsonFromString)('"hello"');
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result)).toBe('hello');
  });

  it('encodes Option.none() to null', () => {
    const result = Schema.encodeSync(NullableJsonFromString)(Option.none());
    expect(result).toBeNull();
  });

  it('encodes Option.some(object) to JSON string', () => {
    const result = Schema.encodeSync(NullableJsonFromString)(
      Option.some({ key: 'value' })
    );
    expect(result).toBe('{"key":"value"}');
  });

  it('encodes Option.some(array) to JSON string', () => {
    const result = Schema.encodeSync(NullableJsonFromString)(
      Option.some([1, 2, 3])
    );
    expect(result).toBe('[1,2,3]');
  });

  it('roundtrips null correctly', () => {
    const original = null;
    const decoded = Schema.decodeUnknownSync(NullableJsonFromString)(original);
    const encoded = Schema.encodeSync(NullableJsonFromString)(decoded);
    expect(encoded).toBe(original);
  });

  it('roundtrips object correctly', () => {
    const original = '{"foo":"bar","num":42}';
    const decoded = Schema.decodeUnknownSync(NullableJsonFromString)(original);
    const encoded = Schema.encodeSync(NullableJsonFromString)(decoded);
    expect(JSON.parse(encoded as string)).toEqual(JSON.parse(original));
  });
});

describe('NullableJsonFromStringTyped', () => {
  const TagsSchema = NullableJsonFromStringTyped(Schema.Array(Schema.String));

  it('decodes null to Option.none()', () => {
    const result = Schema.decodeUnknownSync(TagsSchema)(null);
    expect(Option.isNone(result)).toBe(true);
  });

  it('decodes JSON array to Option.some(string[])', () => {
    const result = Schema.decodeUnknownSync(TagsSchema)('["a","b","c"]');
    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrThrow(result)).toEqual(['a', 'b', 'c']);
  });

  it('encodes Option.some(string[]) to JSON string', () => {
    const result = Schema.encodeSync(TagsSchema)(Option.some(['x', 'y']));
    expect(result).toBe('["x","y"]');
  });

  it('encodes Option.none() to null', () => {
    const result = Schema.encodeSync(TagsSchema)(Option.none());
    expect(result).toBeNull();
  });
});
