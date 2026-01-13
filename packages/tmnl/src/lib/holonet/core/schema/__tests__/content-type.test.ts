/**
 * Content-Type Parser Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseContentType,
  formatContentType,
  extractSchemaId,
  createContentType,
  isJsonContentType,
} from '../content-type';

describe('parseContentType', () => {
  it('parses simple MIME type', () => {
    const result = parseContentType('application/json');

    expect(result.mimeType).toBe('application/json');
    expect(result.schemaId).toBeUndefined();
    expect(result.version).toBeUndefined();
    expect(result.params).toEqual({});
  });

  it('parses MIME type with schema parameter', () => {
    const result = parseContentType('application/json; schema=BlockEvent');

    expect(result.mimeType).toBe('application/json');
    expect(result.schemaId).toBe('BlockEvent');
    expect(result.version).toBeUndefined();
  });

  it('parses MIME type with schema and version', () => {
    const result = parseContentType('application/json; schema=BlockEvent; version=2');

    expect(result.mimeType).toBe('application/json');
    expect(result.schemaId).toBe('BlockEvent');
    expect(result.version).toBe(2);
  });

  it('parses MIME type with extra parameters', () => {
    const result = parseContentType('application/json; schema=BlockEvent; charset=utf-8');

    expect(result.mimeType).toBe('application/json');
    expect(result.schemaId).toBe('BlockEvent');
    expect(result.params).toEqual({ charset: 'utf-8' });
  });

  it('handles quoted parameter values', () => {
    const result = parseContentType('application/json; schema="BlockEvent"');

    expect(result.schemaId).toBe('BlockEvent');
  });

  it('handles case-insensitive parameter keys', () => {
    const result = parseContentType('application/json; Schema=BlockEvent; VERSION=1');

    expect(result.schemaId).toBe('BlockEvent');
    expect(result.version).toBe(1);
  });

  it('handles empty content type', () => {
    const result = parseContentType('');

    expect(result.mimeType).toBe('application/octet-stream');
  });

  it('handles whitespace around semicolons', () => {
    const result = parseContentType('application/json ;  schema=BlockEvent  ;  version=1');

    expect(result.mimeType).toBe('application/json');
    expect(result.schemaId).toBe('BlockEvent');
    expect(result.version).toBe(1);
  });
});

describe('formatContentType', () => {
  it('formats simple MIME type', () => {
    const result = formatContentType({
      mimeType: 'application/json',
      params: {},
    });

    expect(result).toBe('application/json');
  });

  it('formats MIME type with schema', () => {
    const result = formatContentType({
      mimeType: 'application/json',
      schemaId: 'BlockEvent',
      params: {},
    });

    expect(result).toBe('application/json; schema=BlockEvent');
  });

  it('formats MIME type with schema and version', () => {
    const result = formatContentType({
      mimeType: 'application/json',
      schemaId: 'BlockEvent',
      version: 2,
      params: {},
    });

    expect(result).toBe('application/json; schema=BlockEvent; version=2');
  });

  it('includes extra params', () => {
    const result = formatContentType({
      mimeType: 'application/json',
      schemaId: 'BlockEvent',
      params: { charset: 'utf-8' },
    });

    expect(result).toBe('application/json; schema=BlockEvent; charset=utf-8');
  });
});

describe('extractSchemaId', () => {
  it('extracts schema ID from Content-Type', () => {
    expect(extractSchemaId('application/json; schema=BlockEvent')).toBe('BlockEvent');
  });

  it('returns undefined when no schema', () => {
    expect(extractSchemaId('application/json')).toBeUndefined();
  });
});

describe('createContentType', () => {
  it('creates Content-Type with schema', () => {
    expect(createContentType('application/json', 'BlockEvent')).toBe(
      'application/json; schema=BlockEvent'
    );
  });

  it('creates Content-Type with schema and version', () => {
    expect(createContentType('application/json', 'BlockEvent', 2)).toBe(
      'application/json; schema=BlockEvent; version=2'
    );
  });

  it('creates simple Content-Type', () => {
    expect(createContentType('application/json')).toBe('application/json');
  });
});

describe('isJsonContentType', () => {
  it('returns true for application/json', () => {
    expect(isJsonContentType('application/json')).toBe(true);
  });

  it('returns true for application/json with params', () => {
    expect(isJsonContentType('application/json; schema=Test')).toBe(true);
  });

  it('returns true for +json suffix', () => {
    expect(isJsonContentType('application/vnd.api+json')).toBe(true);
  });

  it('returns false for non-JSON types', () => {
    expect(isJsonContentType('text/plain')).toBe(false);
    expect(isJsonContentType('application/xml')).toBe(false);
  });
});
