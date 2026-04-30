/**
 * Protocol Schemas Tests
 */

import { describe, it, expect } from 'vitest';
import { Schema } from 'effect';
import {
  StreamConfig,
  StreamMetadata,
  ReadParams,
  StreamMessage,
  ReadResponse,
  AppendRequest,
  ProducerHeaders,
  AppendResult,
  SSEDataEvent,
  SSEHeartbeatEvent,
  SSEErrorEvent,
  SSEEndEvent,
  SSEEvent,
  HealthResponse,
  StreamId,
  Offset,
} from '../protocol';

describe('Protocol Schemas', () => {
  describe('StreamConfig', () => {
    it('decodes minimal config', () => {
      const input = { contentType: 'application/json' };
      const result = Schema.decodeUnknownSync(StreamConfig)(input);
      expect(result.contentType).toBe('application/json');
    });

    it('decodes full config', () => {
      const input = {
        contentType: 'application/json; schema=BlockEvent',
        retention: 'limits',
        maxAge: 86400000,
        maxMessages: 1000,
        maxBytes: 1024 * 1024 * 100,
      };
      const result = Schema.decodeUnknownSync(StreamConfig)(input);
      expect(result.retention).toBe('limits');
      expect(result.maxAge).toBe(86400000);
    });

    it('rejects invalid retention', () => {
      const input = { contentType: 'application/json', retention: 'invalid' };
      expect(() => Schema.decodeUnknownSync(StreamConfig)(input)).toThrow();
    });

    it('rejects negative maxAge', () => {
      const input = { contentType: 'application/json', maxAge: -1 };
      expect(() => Schema.decodeUnknownSync(StreamConfig)(input)).toThrow();
    });
  });

  describe('StreamMetadata', () => {
    it('decodes full metadata', () => {
      const input = {
        id: 'my-stream',
        contentType: 'application/json',
        schemaId: 'BlockEvent',
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        messageCount: 100,
        firstSeq: 1,
        lastSeq: 100,
        bytes: 50000,
      };
      const result = Schema.decodeUnknownSync(StreamMetadata)(input);
      expect(result.id).toBe('my-stream');
      expect(result.schemaId).toBe('BlockEvent');
    });

    it('decodes metadata without optional fields', () => {
      const input = {
        id: 'my-stream',
        contentType: 'application/json',
        createdAt: Date.now(),
        messageCount: 0,
        firstSeq: 0,
        lastSeq: 0,
        bytes: 0,
      };
      const result = Schema.decodeUnknownSync(StreamMetadata)(input);
      expect(result.schemaId).toBeUndefined();
      expect(result.lastMessageAt).toBeUndefined();
    });
  });

  describe('ReadParams', () => {
    it('decodes numeric offset', () => {
      const input = { offset: 100 };
      const result = Schema.decodeUnknownSync(ReadParams)(input);
      expect(result.offset).toBe(100);
    });

    it('decodes special offset -1', () => {
      const input = { offset: '-1' };
      const result = Schema.decodeUnknownSync(ReadParams)(input);
      expect(result.offset).toBe('-1');
    });

    it('decodes special offset -2', () => {
      const input = { offset: '-2' };
      const result = Schema.decodeUnknownSync(ReadParams)(input);
      expect(result.offset).toBe('-2');
    });

    it('decodes with all options', () => {
      const input = {
        offset: 0,
        limit: 50,
        live: 'long-poll',
        timeout: 30000,
      };
      const result = Schema.decodeUnknownSync(ReadParams)(input);
      expect(result.limit).toBe(50);
      expect(result.live).toBe('long-poll');
      expect(result.timeout).toBe(30000);
    });

    it('rejects invalid live mode', () => {
      const input = { offset: 0, live: 'invalid' };
      expect(() => Schema.decodeUnknownSync(ReadParams)(input)).toThrow();
    });
  });

  describe('StreamMessage', () => {
    it('decodes message', () => {
      const input = {
        seq: 42,
        data: { type: 'test', value: 123 },
        timestamp: Date.now(),
        schemaId: 'TestEvent',
      };
      const result = Schema.decodeUnknownSync(StreamMessage)(input);
      expect(result.seq).toBe(42);
      expect(result.data).toEqual({ type: 'test', value: 123 });
    });
  });

  describe('ReadResponse', () => {
    it('decodes response', () => {
      const input = {
        items: [
          { seq: 1, data: { a: 1 }, timestamp: 1000 },
          { seq: 2, data: { a: 2 }, timestamp: 2000 },
        ],
        nextOffset: 3,
        upToDate: false,
      };
      const result = Schema.decodeUnknownSync(ReadResponse)(input);
      expect(result.items).toHaveLength(2);
      expect(result.nextOffset).toBe(3);
      expect(result.upToDate).toBe(false);
    });

    it('decodes empty response', () => {
      const input = {
        items: [],
        nextOffset: 0,
        upToDate: true,
      };
      const result = Schema.decodeUnknownSync(ReadResponse)(input);
      expect(result.items).toHaveLength(0);
      expect(result.upToDate).toBe(true);
    });
  });

  describe('AppendRequest', () => {
    it('decodes any data', () => {
      const input = { data: { event: 'created', id: 'abc' } };
      const result = Schema.decodeUnknownSync(AppendRequest)(input);
      expect(result.data).toEqual({ event: 'created', id: 'abc' });
    });
  });

  describe('ProducerHeaders', () => {
    it('decodes producer headers', () => {
      const input = { producerId: 'p1', producerSeq: 5 };
      const result = Schema.decodeUnknownSync(ProducerHeaders)(input);
      expect(result.producerId).toBe('p1');
      expect(result.producerSeq).toBe(5);
    });

    it('decodes empty headers', () => {
      const result = Schema.decodeUnknownSync(ProducerHeaders)({});
      expect(result.producerId).toBeUndefined();
      expect(result.producerSeq).toBeUndefined();
    });
  });

  describe('AppendResult', () => {
    it('decodes append result', () => {
      const input = { seq: 100, stream: 'my-stream', duplicate: false };
      const result = Schema.decodeUnknownSync(AppendResult)(input);
      expect(result.seq).toBe(100);
      expect(result.stream).toBe('my-stream');
      expect(result.duplicate).toBe(false);
    });
  });

  describe('SSE Events', () => {
    it('decodes SSEDataEvent', () => {
      const input = { _tag: 'data', data: { value: 1 }, seq: 42 };
      const result = Schema.decodeUnknownSync(SSEDataEvent)(input);
      expect(result._tag).toBe('data');
      expect(result.seq).toBe(42);
    });

    it('decodes SSEHeartbeatEvent', () => {
      const input = { _tag: 'heartbeat', timestamp: Date.now() };
      const result = Schema.decodeUnknownSync(SSEHeartbeatEvent)(input);
      expect(result._tag).toBe('heartbeat');
    });

    it('decodes SSEErrorEvent', () => {
      const input = { _tag: 'error', error: 'stream_not_found', message: 'Stream not found' };
      const result = Schema.decodeUnknownSync(SSEErrorEvent)(input);
      expect(result._tag).toBe('error');
      expect(result.error).toBe('stream_not_found');
    });

    it('decodes SSEEndEvent', () => {
      const input = { _tag: 'end', lastSeq: 100, reason: 'Stream ended' };
      const result = Schema.decodeUnknownSync(SSEEndEvent)(input);
      expect(result._tag).toBe('end');
      expect(result.lastSeq).toBe(100);
    });

    it('decodes SSEEvent union', () => {
      const dataEvent = { _tag: 'data', data: {}, seq: 1 };
      const heartbeatEvent = { _tag: 'heartbeat', timestamp: 1000 };

      expect(Schema.decodeUnknownSync(SSEEvent)(dataEvent)._tag).toBe('data');
      expect(Schema.decodeUnknownSync(SSEEvent)(heartbeatEvent)._tag).toBe('heartbeat');
    });
  });

  describe('HealthResponse', () => {
    it('decodes healthy response', () => {
      const input = {
        status: 'healthy',
        nats: { connected: true, latency: 5 },
        uptime: 86400,
        version: '1.0.0',
      };
      const result = Schema.decodeUnknownSync(HealthResponse)(input);
      expect(result.status).toBe('healthy');
      expect(result.nats.connected).toBe(true);
    });

    it('decodes unhealthy response', () => {
      const input = {
        status: 'unhealthy',
        nats: { connected: false },
        uptime: 0,
        version: '1.0.0',
      };
      const result = Schema.decodeUnknownSync(HealthResponse)(input);
      expect(result.status).toBe('unhealthy');
      expect(result.nats.connected).toBe(false);
    });
  });

  describe('StreamId', () => {
    it('accepts valid stream IDs', () => {
      const validIds = ['my-stream', 'Stream1', 'test_stream', 'a', 'A123'];
      for (const id of validIds) {
        const result = Schema.decodeUnknownSync(StreamId)(id);
        expect(result).toBe(id);
      }
    });

    it('rejects invalid stream IDs', () => {
      const invalidIds = [
        '123start', // Starts with number
        '-dash-start', // Starts with dash
        '_underscore_start', // Starts with underscore
        '', // Empty
        'a'.repeat(65), // Too long
        'has space', // Contains space
        'has.dot', // Contains dot
      ];
      for (const id of invalidIds) {
        expect(() => Schema.decodeUnknownSync(StreamId)(id)).toThrow();
      }
    });
  });

  describe('Offset', () => {
    it('accepts positive integers', () => {
      expect(Schema.decodeUnknownSync(Offset)(0)).toBe(0);
      expect(Schema.decodeUnknownSync(Offset)(100)).toBe(100);
    });

    it('transforms -1 string to number', () => {
      expect(Schema.decodeUnknownSync(Offset)('-1')).toBe(-1);
    });

    it('transforms -2 string to number', () => {
      expect(Schema.decodeUnknownSync(Offset)('-2')).toBe(-2);
    });

    it('rejects negative numbers other than -1 and -2', () => {
      expect(() => Schema.decodeUnknownSync(Offset)(-3)).toThrow();
      expect(() => Schema.decodeUnknownSync(Offset)(-10)).toThrow();
    });

    it('rejects non-integers', () => {
      expect(() => Schema.decodeUnknownSync(Offset)(1.5)).toThrow();
    });
  });
});
