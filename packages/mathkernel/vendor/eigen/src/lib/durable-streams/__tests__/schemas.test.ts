/**
 * Durable Streams Schemas Tests
 */

import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  Offset,
  OFFSET_START,
  LiveMode,
  StreamCreateConfig,
  StreamConnectConfig,
  StreamReadConfig,
  StreamMetadata,
  StreamOpened,
  StreamClosed,
  StreamError,
  StreamDataReceived,
  StreamLifecycleEvent,
} from '../schemas';

describe('Durable Streams Schemas', () => {
  describe('Offset', () => {
    it('should accept valid offset strings', () => {
      const result = Schema.decodeUnknownSync(Offset)('abc123_456');
      expect(result).toBe('abc123_456');
    });

    it('should have OFFSET_START constant as -1', () => {
      expect(OFFSET_START).toBe('-1');
    });
  });

  describe('LiveMode', () => {
    it('should accept false', () => {
      const result = Schema.decodeUnknownSync(LiveMode)(false);
      expect(result).toBe(false);
    });

    it('should accept "auto"', () => {
      const result = Schema.decodeUnknownSync(LiveMode)('auto');
      expect(result).toBe('auto');
    });

    it('should accept "long-poll"', () => {
      const result = Schema.decodeUnknownSync(LiveMode)('long-poll');
      expect(result).toBe('long-poll');
    });

    it('should accept "sse"', () => {
      const result = Schema.decodeUnknownSync(LiveMode)('sse');
      expect(result).toBe('sse');
    });

    it('should reject invalid values', () => {
      expect(() => Schema.decodeUnknownSync(LiveMode)('invalid')).toThrow();
    });
  });

  describe('StreamCreateConfig', () => {
    it('should decode minimal config', () => {
      const result = Schema.decodeUnknownSync(StreamCreateConfig)({
        url: 'https://example.com/stream/test',
      });
      expect(result.url).toBe('https://example.com/stream/test');
    });

    it('should decode full config', () => {
      const result = Schema.decodeUnknownSync(StreamCreateConfig)({
        url: 'https://example.com/stream/test',
        contentType: 'application/json',
        ttlSeconds: 3600,
        expiresAt: '2025-01-01T00:00:00Z',
        body: { initial: 'data' },
      });
      expect(result.url).toBe('https://example.com/stream/test');
      expect(result.contentType).toBe('application/json');
      expect(result.ttlSeconds).toBe(3600);
    });
  });

  describe('StreamConnectConfig', () => {
    it('should decode config with headers', () => {
      const result = Schema.decodeUnknownSync(StreamConnectConfig)({
        url: 'https://example.com/stream/test',
        headers: { Authorization: 'Bearer token123' },
      });
      expect(result.url).toBe('https://example.com/stream/test');
      expect(result.headers?.Authorization).toBe('Bearer token123');
    });
  });

  describe('StreamReadConfig', () => {
    it('should decode read config', () => {
      const result = Schema.decodeUnknownSync(StreamReadConfig)({
        offset: 'abc123',
        live: 'auto',
        json: true,
      });
      expect(result.offset).toBe('abc123');
      expect(result.live).toBe('auto');
      expect(result.json).toBe(true);
    });
  });

  describe('StreamMetadata', () => {
    it('should decode metadata', () => {
      const result = Schema.decodeUnknownSync(StreamMetadata)({
        exists: true,
        contentType: 'application/json',
        offset: 'abc123',
        etag: '"12345"',
        cacheControl: 'public, max-age=60',
      });
      expect(result.exists).toBe(true);
      expect(result.contentType).toBe('application/json');
    });
  });

  describe('StreamLifecycleEvent', () => {
    it('should decode StreamOpened', () => {
      const event = {
        _tag: 'StreamOpened',
        url: 'https://example.com/stream/test',
        contentType: 'application/json',
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(StreamLifecycleEvent)(event);
      expect(result._tag).toBe('StreamOpened');
    });

    it('should decode StreamClosed', () => {
      const event = {
        _tag: 'StreamClosed',
        url: 'https://example.com/stream/test',
        reason: 'User initiated',
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(StreamLifecycleEvent)(event);
      expect(result._tag).toBe('StreamClosed');
    });

    it('should decode StreamError', () => {
      const event = {
        _tag: 'StreamError',
        url: 'https://example.com/stream/test',
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(StreamLifecycleEvent)(event);
      expect(result._tag).toBe('StreamError');
    });

    it('should decode StreamDataReceived', () => {
      const event = {
        _tag: 'StreamDataReceived',
        url: 'https://example.com/stream/test',
        offset: 'abc123',
        itemCount: 5,
        upToDate: true,
        timestamp: Date.now(),
      };
      const result = Schema.decodeUnknownSync(StreamLifecycleEvent)(event);
      expect(result._tag).toBe('StreamDataReceived');
    });
  });
});
