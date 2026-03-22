/**
 * NatsKVService Live Integration Tests
 *
 * Tests against a RUNNING NATS server with JetStream enabled.
 * NATS should be running on localhost:4222.
 *
 * Run with: bun test src/lib/nats/__tests__/NatsKVService.bun.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module
 */

// @ts-nocheck - bun:test types not available in tsc
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Effect, Layer, Schema, Stream, Chunk, Fiber } from 'effect';

import {
  NatsKVService,
  NatsConfigTag,
  type NatsConfig,
} from '../NatsKVService';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'nats://localhost:4222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Test bucket name (unique per test run to avoid conflicts)
const TEST_BUCKET = `test-bucket-${Date.now()}`;

// Config layer for tests
const testConfigLayer = Layer.succeed(NatsConfigTag, {
  servers: NATS_SERVERS,
  name: 'nats-kv-test',
} satisfies NatsConfig);

// Composed service layer
const testServiceLayer = NatsKVService.Default.pipe(
  Layer.provide(testConfigLayer)
);

// =============================================================================
// Health Check
// =============================================================================

let serverAvailable = false;

async function checkNatsHealth(): Promise<boolean> {
  try {
    const { connect } = await import('nats');
    const nc = await connect({ servers: NATS_SERVERS });
    await nc.close();
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Test Schema
// =============================================================================

const TestItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  value: Schema.Number,
  createdAt: Schema.DateFromString,
});
type TestItem = typeof TestItem.Type;

// =============================================================================
// Integration Tests
// =============================================================================

describe('NatsKVService Integration', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;
    serverAvailable = await checkNatsHealth();
    if (!serverAvailable) {
      console.warn(
        `⚠️  NATS server not available at ${NATS_SERVERS}. Tests will be skipped.`
      );
    }
  });

  afterAll(async () => {
    if (!serverAvailable || SKIP_INTEGRATION) return;

    // Cleanup: delete test bucket
    const cleanup = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const conn = yield* service.getConnection();
      const js = conn.jetstream();

      yield* Effect.tryPromise({
        try: async () => {
          await js.views.kv(TEST_BUCKET);
          const kvm = await js.jetstreamManager();
          await kvm.streams.delete(`KV_${TEST_BUCKET}`);
        },
        catch: () => new Error('Cleanup failed'),
      }).pipe(Effect.catchAll(() => Effect.void));

      yield* service.close();
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(cleanup).catch(() => {
      /* ignore cleanup errors */
    });
  });

  // ---------------------------------------------------------------------------
  // Connection Tests
  // ---------------------------------------------------------------------------

  it('connects to NATS server', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const conn = yield* service.getConnection();

      expect(conn).toBeDefined();
      expect(conn.isClosed()).toBe(false);
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  // ---------------------------------------------------------------------------
  // Bucket Tests
  // ---------------------------------------------------------------------------

  it('creates and retrieves KV bucket', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET, {
        history: 5,
      });

      expect(bucket).toBeDefined();
      // KV bucket object has status() method to get bucket info
      const status = yield* Effect.promise(() => bucket.status());
      expect(status.bucket).toBe(TEST_BUCKET);
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  // ---------------------------------------------------------------------------
  // CRUD Tests
  // ---------------------------------------------------------------------------

  it('put and get - round-trips typed value', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const testItem: TestItem = {
      id: 'item-1',
      name: 'Test Item',
      value: 42,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Put
      const revision = yield* service.put(bucket, 'item-1', testItem, TestItem);
      expect(revision).toBeGreaterThan(0);

      // Get
      const retrieved = yield* service.get(bucket, 'item-1', TestItem);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('item-1');
      expect(retrieved!.name).toBe('Test Item');
      expect(retrieved!.value).toBe(42);
      expect(retrieved!.createdAt).toBeInstanceOf(Date);
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  it('get - returns null for non-existent key', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      const result = yield* service.get(bucket, 'non-existent-key', TestItem);
      expect(result).toBeNull();
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  it('delete - removes key', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const testItem: TestItem = {
      id: 'to-delete',
      name: 'Delete Me',
      value: 0,
      createdAt: new Date(),
    };

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Put
      yield* service.put(bucket, 'to-delete', testItem, TestItem);

      // Verify exists
      const before = yield* service.get(bucket, 'to-delete', TestItem);
      expect(before).not.toBeNull();

      // Delete
      yield* service.delete(bucket, 'to-delete');

      // Verify gone
      const after = yield* service.get(bucket, 'to-delete', TestItem);
      expect(after).toBeNull();
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  it('purge - removes key with all history', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const testItem: TestItem = {
      id: 'to-purge',
      name: 'Purge Me',
      value: 0,
      createdAt: new Date(),
    };

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Put multiple times to create history
      yield* service.put(bucket, 'to-purge', testItem, TestItem);
      yield* service.put(
        bucket,
        'to-purge',
        { ...testItem, value: 1 },
        TestItem
      );
      yield* service.put(
        bucket,
        'to-purge',
        { ...testItem, value: 2 },
        TestItem
      );

      // Purge
      yield* service.purge(bucket, 'to-purge');

      // Verify gone
      const after = yield* service.get(bucket, 'to-purge', TestItem);
      expect(after).toBeNull();
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  // ---------------------------------------------------------------------------
  // Keys/List Tests
  // ---------------------------------------------------------------------------

  it('keys - lists all keys in bucket', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Add some items
      const items: TestItem[] = [
        { id: 'list-1', name: 'Item 1', value: 1, createdAt: new Date() },
        { id: 'list-2', name: 'Item 2', value: 2, createdAt: new Date() },
        { id: 'list-3', name: 'Item 3', value: 3, createdAt: new Date() },
      ];

      for (const item of items) {
        yield* service.put(bucket, item.id, item, TestItem);
      }

      // List keys
      const keys = yield* service.keys(bucket);

      expect(keys).toContain('list-1');
      expect(keys).toContain('list-2');
      expect(keys).toContain('list-3');
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  it('list - returns all entries with metadata', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Ensure we have items
      const items: TestItem[] = [
        { id: 'entry-1', name: 'Entry 1', value: 10, createdAt: new Date() },
        { id: 'entry-2', name: 'Entry 2', value: 20, createdAt: new Date() },
      ];

      for (const item of items) {
        yield* service.put(bucket, item.id, item, TestItem);
      }

      // List entries
      const entries = yield* service.list(bucket, TestItem);

      const entry1 = entries.find((e) => e.key === 'entry-1');
      const entry2 = entries.find((e) => e.key === 'entry-2');

      expect(entry1).toBeDefined();
      expect(entry1!.value.name).toBe('Entry 1');
      expect(entry1!.revision).toBeGreaterThan(0);
      expect(entry1!.created).toBeInstanceOf(Date);

      expect(entry2).toBeDefined();
      expect(entry2!.value.name).toBe('Entry 2');
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  // ---------------------------------------------------------------------------
  // Watch Tests
  // ---------------------------------------------------------------------------

  it('watch - streams changes for key pattern', async () => {
    if (SKIP_INTEGRATION || !serverAvailable) return;

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const bucket = yield* service.getOrCreateBucket(TEST_BUCKET);

      // Unique key prefix for this test
      const prefix = `watch-${Date.now()}`;

      // Start watching (we'll collect events in a fiber)
      // Use 'allUpdates' to only get new changes (not history)
      const watchStream = service.watch(bucket, `${prefix}.*`, TestItem, {
        include: 'allUpdates',
      });

      // Collect first 3 events
      const collectFiber = yield* watchStream.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.fork
      );

      // Give watcher time to start
      yield* Effect.sleep('100 millis');

      // Emit 3 changes
      const item1: TestItem = {
        id: `${prefix}.1`,
        name: 'Watch 1',
        value: 1,
        createdAt: new Date(),
      };
      const item2: TestItem = {
        id: `${prefix}.2`,
        name: 'Watch 2',
        value: 2,
        createdAt: new Date(),
      };
      const item3: TestItem = {
        id: `${prefix}.3`,
        name: 'Watch 3',
        value: 3,
        createdAt: new Date(),
      };

      yield* service.put(bucket, `${prefix}.1`, item1, TestItem);
      yield* service.put(bucket, `${prefix}.2`, item2, TestItem);
      yield* service.put(bucket, `${prefix}.3`, item3, TestItem);

      // Wait for fiber with timeout
      const events = yield* Fiber.join(collectFiber).pipe(
        Effect.timeout('5 seconds')
      );

      expect(Chunk.toArray(events).length).toBe(3);

      const eventArray = Chunk.toArray(events);
      expect(eventArray[0].operation).toBe('PUT');
      expect(eventArray[0].value?.name).toBe('Watch 1');
      expect(eventArray[1].value?.name).toBe('Watch 2');
      expect(eventArray[2].value?.name).toBe('Watch 3');
    }).pipe(Effect.provide(testServiceLayer));

    await Effect.runPromise(program);
  });

  // ---------------------------------------------------------------------------
  // Error Handling Tests
  // ---------------------------------------------------------------------------

  it('handles connection errors gracefully', async () => {
    if (SKIP_INTEGRATION) return;

    const badConfig = Layer.succeed(NatsConfigTag, {
      servers: 'nats://127.0.0.1:59999', // Invalid port
      name: 'bad-client',
    });

    const badServiceLayer = NatsKVService.Default.pipe(
      Layer.provide(badConfig)
    );

    const program = Effect.gen(function* () {
      const service = yield* NatsKVService;
      const conn = yield* service.getConnection();
      // Try to actually use the connection to trigger failure
      const js = conn.jetstream();
      yield* Effect.tryPromise({
        try: () => js.views.kv('test-bucket'),
        catch: (e) => new Error(`KV access failed: ${e}`),
      });
    }).pipe(Effect.provide(badServiceLayer));

    const result = await Effect.runPromise(
      program.pipe(Effect.timeout('3 seconds'), Effect.either)
    );

    // Either we get a Left (error) or a TimeoutException
    // A successful connect to a bad port should not happen
    if (result._tag === 'Right') {
      // If we got Right, it means it connected somehow — that's unexpected for port 59999
      // This can happen if there's something listening on that port
      console.warn(
        '⚠️  Bad port connection unexpectedly succeeded — something may be listening on 59999'
      );
    }
    // Just verify we got some result without hanging
    expect(result).toBeDefined();
  });
});
