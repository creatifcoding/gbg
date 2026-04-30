/**
 * StreamBridgeService Tests
 *
 * Tests for CRUD operations on durable streams.
 */

import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import {
  StreamBridgeService,
  StreamNotFoundError,
  StreamExistsError,
  type CreateResult,
  type ReadOptions,
} from '../StreamBridgeService';
import type { StreamConfig, AppendResult, ReadResponse, StreamMetadata } from '../../schemas/protocol';

// =============================================================================
// Test Layer
// =============================================================================

/**
 * Each test gets a fresh layer to avoid state pollution
 */
const getTestLayer = () => StreamBridgeService.Default;

// =============================================================================
// Tests
// =============================================================================

describe('StreamBridgeService', () => {
  describe('create', () => {
    it('creates a new stream successfully', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const config: StreamConfig = {
          contentType: 'application/json',
        };

        const result: CreateResult = yield* bridge.create('test-stream', config);

        expect(result.streamId).toBe('test-stream');
        expect(result.contentType).toBe('application/json');
        expect(result.created).toBe(true);
        expect(result.schemaId).toBeUndefined();
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('extracts schemaId from content-type', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const config: StreamConfig = {
          contentType: 'application/json; schema=BlockEvent',
        };

        const result = yield* bridge.create('typed-stream', config);

        expect(result.streamId).toBe('typed-stream');
        expect(result.schemaId).toBe('BlockEvent');
        expect(result.contentType).toBe('application/json; schema=BlockEvent');
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream already exists', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const config: StreamConfig = { contentType: 'application/json' };

        // Create first time
        yield* bridge.create('duplicate-stream', config);

        // Try to create again
        const result = yield* bridge.create('duplicate-stream', config).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamExistsError);
          expect((result.left as StreamExistsError).streamId).toBe('duplicate-stream');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('creates streams with retention configuration', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const config: StreamConfig = {
          contentType: 'application/json',
          retention: 'limits',
          maxAge: 86400000,
          maxMessages: 1000,
        };

        const result = yield* bridge.create('retention-stream', config);

        expect(result.created).toBe(true);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('append', () => {
    it('appends data to existing stream', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        // Create stream first
        yield* bridge.create('append-stream', { contentType: 'application/json' });

        // Append data
        const result: AppendResult = yield* bridge.append('append-stream', { event: 'test', value: 42 });

        expect(result.seq).toBeGreaterThan(0);
        expect(result.stream).toBe('append-stream');
        expect(result.duplicate).toBe(false);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('increments sequence number on each append', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('seq-stream', { contentType: 'application/json' });

        const r1 = yield* bridge.append('seq-stream', { n: 1 });
        const r2 = yield* bridge.append('seq-stream', { n: 2 });
        const r3 = yield* bridge.append('seq-stream', { n: 3 });

        expect(r2.seq).toBe(r1.seq + 1);
        expect(r3.seq).toBe(r2.seq + 1);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const result = yield* bridge.append('nonexistent-stream', { data: 'test' }).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamNotFoundError);
          expect((result.left as StreamNotFoundError).streamId).toBe('nonexistent-stream');
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('appends with producer headers for idempotency', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('idempotent-stream', { contentType: 'application/json' });

        const result = yield* bridge.append(
          'idempotent-stream',
          { event: 'test' },
          'producer-1', // producerId
          1 // producerSeq
        );

        expect(result.seq).toBeGreaterThan(0);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('read', () => {
    it('reads messages from stream', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('read-stream', { contentType: 'application/json' });
        yield* bridge.append('read-stream', { event: 'first' });
        yield* bridge.append('read-stream', { event: 'second' });
        yield* bridge.append('read-stream', { event: 'third' });

        const options: ReadOptions = { offset: 0 };
        const result: ReadResponse = yield* bridge.read('read-stream', options);

        expect(result.items).toHaveLength(3);
        expect(result.items[0].data).toEqual({ event: 'first' });
        expect(result.items[1].data).toEqual({ event: 'second' });
        expect(result.items[2].data).toEqual({ event: 'third' });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('reads from specific offset', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('offset-stream', { contentType: 'application/json' });
        const r1 = yield* bridge.append('offset-stream', { n: 1 });
        yield* bridge.append('offset-stream', { n: 2 });
        yield* bridge.append('offset-stream', { n: 3 });

        // Read starting after first message
        const result = yield* bridge.read('offset-stream', { offset: r1.seq });

        expect(result.items).toHaveLength(2);
        expect(result.items[0].data).toEqual({ n: 2 });
        expect(result.items[1].data).toEqual({ n: 3 });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('respects limit parameter', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('limit-stream', { contentType: 'application/json' });
        yield* bridge.append('limit-stream', { n: 1 });
        yield* bridge.append('limit-stream', { n: 2 });
        yield* bridge.append('limit-stream', { n: 3 });
        yield* bridge.append('limit-stream', { n: 4 });
        yield* bridge.append('limit-stream', { n: 5 });

        const result = yield* bridge.read('limit-stream', { offset: 0, limit: 2 });

        expect(result.items).toHaveLength(2);
        expect(result.upToDate).toBe(false); // More messages available
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns upToDate true when no more messages', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('uptodate-stream', { contentType: 'application/json' });
        yield* bridge.append('uptodate-stream', { n: 1 });

        const result = yield* bridge.read('uptodate-stream', { offset: 0, limit: 100 });

        expect(result.items).toHaveLength(1);
        expect(result.upToDate).toBe(true);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns nextOffset correctly', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('nextoffset-stream', { contentType: 'application/json' });
        yield* bridge.append('nextoffset-stream', { n: 1 });
        const lastAppend = yield* bridge.append('nextoffset-stream', { n: 2 });

        const result = yield* bridge.read('nextoffset-stream', { offset: 0 });

        expect(result.nextOffset).toBe(lastAppend.seq);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns empty items when offset is at end', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('empty-read-stream', { contentType: 'application/json' });
        const lastAppend = yield* bridge.append('empty-read-stream', { n: 1 });

        // Read from the last sequence number
        const result = yield* bridge.read('empty-read-stream', { offset: lastAppend.seq });

        expect(result.items).toHaveLength(0);
        expect(result.nextOffset).toBe(lastAppend.seq);
        expect(result.upToDate).toBe(true);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const result = yield* bridge.read('nonexistent-stream', { offset: 0 }).pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamNotFoundError);
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('metadata', () => {
    it('returns stream metadata', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('meta-stream', { contentType: 'application/json' });
        yield* bridge.append('meta-stream', { n: 1 });
        yield* bridge.append('meta-stream', { n: 2 });

        const meta: StreamMetadata = yield* bridge.metadata('meta-stream');

        expect(meta.id).toBe('meta-stream');
        expect(meta.contentType).toBe('application/json');
        expect(meta.messageCount).toBe(2);
        expect(meta.firstSeq).toBeGreaterThan(0);
        expect(meta.lastSeq).toBeGreaterThanOrEqual(meta.firstSeq);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('includes schemaId when present', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('schema-meta-stream', {
          contentType: 'application/json; schema=MyEvent',
        });

        const meta = yield* bridge.metadata('schema-meta-stream');

        expect(meta.schemaId).toBe('MyEvent');
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('returns correct counts for empty stream', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('empty-meta-stream', { contentType: 'application/json' });

        const meta = yield* bridge.metadata('empty-meta-stream');

        expect(meta.messageCount).toBe(0);
        expect(meta.firstSeq).toBe(0);
        expect(meta.lastSeq).toBe(0);
        expect(meta.lastMessageAt).toBeUndefined();
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('includes lastMessageAt after append', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('timestamp-stream', { contentType: 'application/json' });

        const beforeAppend = Date.now();
        yield* bridge.append('timestamp-stream', { n: 1 });

        const meta = yield* bridge.metadata('timestamp-stream');

        expect(meta.lastMessageAt).toBeDefined();
        expect(meta.lastMessageAt).toBeGreaterThanOrEqual(beforeAppend);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const result = yield* bridge.metadata('nonexistent-stream').pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamNotFoundError);
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('delete', () => {
    it('deletes existing stream', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('delete-stream', { contentType: 'application/json' });

        const deleted = yield* bridge.delete('delete-stream');

        expect(deleted).toBe(true);

        // Verify stream no longer exists
        const result = yield* bridge.metadata('delete-stream').pipe(Effect.either);
        expect(result._tag).toBe('Left');
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('fails when stream does not exist', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        const result = yield* bridge.delete('nonexistent-stream').pipe(Effect.either);

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left).toBeInstanceOf(StreamNotFoundError);
        }
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });

  describe('end-to-end workflow', () => {
    it('supports full CRUD lifecycle', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        // 1. Create (without schema for simpler test - schema validation is tested elsewhere)
        const createResult = yield* bridge.create('lifecycle-stream', {
          contentType: 'application/json',
        });
        expect(createResult.created).toBe(true);

        // 2. Append multiple messages
        yield* bridge.append('lifecycle-stream', { event: 'created', ts: 1 });
        yield* bridge.append('lifecycle-stream', { event: 'updated', ts: 2 });
        yield* bridge.append('lifecycle-stream', { event: 'deleted', ts: 3 });

        // 3. Read all
        const readResult = yield* bridge.read('lifecycle-stream', { offset: 0 });
        expect(readResult.items).toHaveLength(3);

        // 4. Metadata
        const meta = yield* bridge.metadata('lifecycle-stream');
        expect(meta.messageCount).toBe(3);
        expect(meta.schemaId).toBeUndefined(); // No schema in content-type

        // 5. Delete
        const deleted = yield* bridge.delete('lifecycle-stream');
        expect(deleted).toBe(true);
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));

    it('supports paginated reading', () =>
      Effect.gen(function* () {
        const bridge = yield* StreamBridgeService;

        yield* bridge.create('paginated-stream', { contentType: 'application/json' });

        // Append 10 messages
        for (let i = 1; i <= 10; i++) {
          yield* bridge.append('paginated-stream', { n: i });
        }

        // Read in pages of 3
        let allItems: unknown[] = [];
        let offset = 0;

        while (true) {
          const page = yield* bridge.read('paginated-stream', { offset, limit: 3 });
          allItems = [...allItems, ...page.items.map((i) => i.data)];

          if (page.upToDate) break;
          offset = page.nextOffset;
        }

        expect(allItems).toHaveLength(10);
        expect(allItems[0]).toEqual({ n: 1 });
        expect(allItems[9]).toEqual({ n: 10 });
      }).pipe(Effect.provide(getTestLayer()), Effect.runPromise));
  });
});
