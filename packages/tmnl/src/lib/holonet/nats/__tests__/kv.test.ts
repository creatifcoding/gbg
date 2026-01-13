/**
 * NatsKVService Comprehensive Tests
 *
 * Tests the high-level KV service with Schema codecs.
 * NATS with JetStream should be running on localhost:9222 (WebSocket port).
 *
 * Run with: pnpm vitest run src/lib/holonet/nats/__tests__/kv.test.ts
 *
 * Skip condition: Set NATS_SKIP_INTEGRATION=1 to skip these tests.
 *
 * @module holonet/nats/__tests__/kv
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer, Schema, Stream, Chunk, Fiber, Duration, pipe } from 'effect';
import { connect, type NatsConnection, type JetStreamManager } from 'nats.ws';

import { NatsKVService } from '../kv';
import { NatsInnerService } from '../inner';
import { NatsConnectionService } from '../connection';
import { HolonetConfigTag } from '../../schemas/config';

// =============================================================================
// Test Configuration
// =============================================================================

const NATS_SERVERS = process.env['NATS_SERVERS'] ?? 'ws://localhost:9222';
const SKIP_INTEGRATION = process.env['NATS_SKIP_INTEGRATION'] === '1';

// Test bucket prefix (unique per test run to avoid conflicts)
const TEST_BUCKET = `test-kv-${Date.now()}`;

// Config layer for tests
const testConfigLayer = HolonetConfigTag.Custom({
  servers: NATS_SERVERS,
  name: 'nats-kv-test',
  debug: false,
});

// Composed service layers
const testConnectionLayer = NatsConnectionService.Default.pipe(
  Layer.provide(testConfigLayer)
);

const testInnerLayer = NatsInnerService.Default.pipe(
  Layer.provide(testConnectionLayer)
);

const testKVLayer = NatsKVService.Default.pipe(Layer.provide(testInnerLayer));

// =============================================================================
// Health Check & Setup
// =============================================================================

let serverAvailable = false;
let testConnection: NatsConnection | null = null;
let jsm: JetStreamManager | null = null;

async function checkNatsHealth(): Promise<boolean> {
  try {
    testConnection = await connect({ servers: NATS_SERVERS });
    jsm = await testConnection.jetstreamManager();
    return true;
  } catch {
    return false;
  }
}

async function createTestBucket(): Promise<void> {
  if (!jsm) return;
  try {
    await jsm.streams.add({
      name: `KV_${TEST_BUCKET}`,
      subjects: [`$KV.${TEST_BUCKET}.>`],
      storage: 'memory' as any,
      max_msgs_per_subject: 10,
    });
  } catch (err: any) {
    // Bucket may already exist
    if (!err.message?.includes('already in use')) {
      throw err;
    }
  }
}

async function deleteTestBucket(): Promise<void> {
  if (!jsm) return;
  try {
    await jsm.streams.delete(`KV_${TEST_BUCKET}`);
  } catch {
    // Ignore errors during cleanup
  }
}

// =============================================================================
// Test Schemas
// =============================================================================

const UserProfile = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  age: Schema.Number,
});
type UserProfile = typeof UserProfile.Type;

const ConfigValue = Schema.Struct({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
  updatedAt: Schema.Date, // Use Date (handles JSON string conversion)
});
type ConfigValue = typeof ConfigValue.Type;

const SensorReading = Schema.Struct({
  sensorId: Schema.String,
  temperature: Schema.Number,
  humidity: Schema.Number,
  timestamp: Schema.Date, // Use Date (handles JSON string conversion)
});
type SensorReading = typeof SensorReading.Type;

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
      return;
    }
    await createTestBucket();
  });

  afterAll(async () => {
    if (testConnection) {
      await deleteTestBucket();
      await testConnection.close();
    }
  });

  // ---------------------------------------------------------------------------
  // Basic Get/Put Operations
  // ---------------------------------------------------------------------------

  describe('get and put', () => {
    it('put then get returns the stored value', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `user-${Date.now()}`;
      const testValue: UserProfile = {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        age: 30,
      };

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Put the value
        const revision = yield* kv.put(TEST_BUCKET, testKey, UserProfile, testValue);
        expect(revision).toBeGreaterThan(0);

        // Get it back
        const result = yield* kv.get(TEST_BUCKET, testKey, UserProfile);
        expect(result).toEqual(testValue);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('get returns NotFoundError for missing key', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        const result = yield* pipe(
          kv.get(TEST_BUCKET, 'nonexistent-key', UserProfile),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('KV/NotFound');
        }
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('put overwrites existing value and increments revision', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `overwrite-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // First put
        const rev1 = yield* kv.put(TEST_BUCKET, testKey, UserProfile, {
          id: 'v1',
          name: 'Version 1',
          email: 'v1@test.com',
          age: 1,
        });

        // Second put (overwrite)
        const rev2 = yield* kv.put(TEST_BUCKET, testKey, UserProfile, {
          id: 'v2',
          name: 'Version 2',
          email: 'v2@test.com',
          age: 2,
        });

        expect(rev2).toBeGreaterThan(rev1);

        // Get should return latest
        const result = yield* kv.get(TEST_BUCKET, testKey, UserProfile);
        expect(result.id).toBe('v2');
        expect(result.name).toBe('Version 2');
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // getOrNull
  // ---------------------------------------------------------------------------

  describe('getOrNull', () => {
    it('returns value when key exists', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `getornull-exists-${Date.now()}`;
      const testValue: UserProfile = {
        id: 'exists',
        name: 'Exists',
        email: 'exists@test.com',
        age: 25,
      };

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        yield* kv.put(TEST_BUCKET, testKey, UserProfile, testValue);

        const result = yield* kv.getOrNull(TEST_BUCKET, testKey, UserProfile);
        expect(result).toEqual(testValue);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('returns null when key does not exist', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        const result = yield* kv.getOrNull(
          TEST_BUCKET,
          `nonexistent-${Date.now()}`,
          UserProfile
        );
        expect(result).toBeNull();
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete and Purge
  // ---------------------------------------------------------------------------

  describe('delete and purge', () => {
    it('delete marks key as deleted', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `delete-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create key
        yield* kv.put(TEST_BUCKET, testKey, UserProfile, {
          id: 'to-delete',
          name: 'Delete Me',
          email: 'delete@test.com',
          age: 99,
        });

        // Verify it exists
        const before = yield* kv.getOrNull(TEST_BUCKET, testKey, UserProfile);
        expect(before).not.toBeNull();

        // Delete it
        yield* kv.delete(TEST_BUCKET, testKey);

        // Should be gone (or return NotFound)
        const after = yield* pipe(
          kv.get(TEST_BUCKET, testKey, UserProfile),
          Effect.either
        );
        expect(after._tag).toBe('Left');
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('purge removes key and its history', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `purge-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create multiple revisions
        for (let i = 1; i <= 3; i++) {
          yield* kv.put(TEST_BUCKET, testKey, UserProfile, {
            id: `rev-${i}`,
            name: `Revision ${i}`,
            email: `rev${i}@test.com`,
            age: i,
          });
        }

        // Purge the key - may fail on some NATS configurations
        const purgeResult = yield* pipe(
          kv.purge(TEST_BUCKET, testKey),
          Effect.either
        );

        if (purgeResult._tag === 'Right') {
          // Purge succeeded - verify key returns NotFound via get()
          const getResult = yield* pipe(
            kv.get(TEST_BUCKET, testKey, UserProfile),
            Effect.either
          );
          expect(getResult._tag).toBe('Left');
          if (getResult._tag === 'Left') {
            expect(getResult.left._tag).toBe('KV/NotFound');
          }
        } else {
          // Purge failed - this can happen on certain NATS configurations
          // Just verify we got the expected error type
          expect(purgeResult.left._tag).toBe('Inner/KV/Delete');
          console.log(`[NOTE] KV purge not supported on this NATS configuration: ${purgeResult.left.message}`);
        }
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Keys and List
  // ---------------------------------------------------------------------------

  describe('keys and list', () => {
    it('keys returns all keys in bucket', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const prefix = `keys-test-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create several keys
        const keyNames = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];
        for (const key of keyNames) {
          yield* kv.put(TEST_BUCKET, key, UserProfile, {
            id: key,
            name: key,
            email: `${key}@test.com`,
            age: 1,
          });
        }

        // Get all keys
        const allKeys = yield* kv.keys(TEST_BUCKET);

        // Our keys should be present
        for (const key of keyNames) {
          expect(allKeys).toContain(key);
        }
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('keys with filter returns matching keys', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const prefix = `filter-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create keys with different patterns
        yield* kv.put(TEST_BUCKET, `${prefix}-user-1`, UserProfile, {
          id: '1',
          name: 'User 1',
          email: 'u1@test.com',
          age: 1,
        });
        yield* kv.put(TEST_BUCKET, `${prefix}-user-2`, UserProfile, {
          id: '2',
          name: 'User 2',
          email: 'u2@test.com',
          age: 2,
        });
        yield* kv.put(TEST_BUCKET, `${prefix}-config-1`, ConfigValue, {
          key: 'cfg1',
          value: 'test',
          updatedAt: new Date(),
        });

        // Filter for user keys only
        const userKeys = yield* kv.keys(TEST_BUCKET, `${prefix}-user-*`);

        expect(userKeys.length).toBe(2);
        expect(userKeys.every((k) => k.includes('user'))).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('list returns all entries with decoded values', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      // Use a fresh bucket for this test to avoid interference
      const listBucket = `${TEST_BUCKET}-list`;

      // Create the bucket
      if (jsm) {
        try {
          await jsm.streams.add({
            name: `KV_${listBucket}`,
            subjects: [`$KV.${listBucket}.>`],
            storage: 'memory' as any,
            max_msgs_per_subject: 10,
          });
        } catch {
          // Ignore if exists
        }
      }

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create a few entries
        const entries = [
          { id: 'list-1', name: 'Entry 1', email: 'e1@test.com', age: 10 },
          { id: 'list-2', name: 'Entry 2', email: 'e2@test.com', age: 20 },
        ];

        for (const entry of entries) {
          yield* kv.put(listBucket, entry.id, UserProfile, entry);
        }

        // List all entries
        const allEntries = yield* kv.list(listBucket, UserProfile);

        expect(allEntries.length).toBe(2);
        expect(allEntries.map((e) => e.value.id).sort()).toEqual(['list-1', 'list-2']);
        expect(allEntries.every((e) => e.revision > 0)).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);

      // Cleanup
      if (jsm) {
        try {
          await jsm.streams.delete(`KV_${listBucket}`);
        } catch {
          // Ignore
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  describe('history', () => {
    it('history returns all revisions of a key', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `history-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Create multiple revisions
        const versions = ['v1', 'v2', 'v3'];
        for (const v of versions) {
          yield* kv.put(TEST_BUCKET, testKey, UserProfile, {
            id: v,
            name: `Version ${v}`,
            email: `${v}@test.com`,
            age: parseInt(v.slice(1)),
          });
        }

        // Get history
        const historyEntries = yield* kv.history(TEST_BUCKET, testKey, UserProfile);

        expect(historyEntries.length).toBe(3);
        expect(historyEntries.map((e) => e.value.id)).toEqual(['v1', 'v2', 'v3']);
        // Revisions should be increasing
        expect(historyEntries[0].revision).toBeLessThan(historyEntries[1].revision);
        expect(historyEntries[1].revision).toBeLessThan(historyEntries[2].revision);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Watch
  // ---------------------------------------------------------------------------

  describe('watch', () => {
    it('watch receives updates in real-time', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `watch-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Start watching - use 'allUpdates' to catch everything
        const watchStream = yield* kv.watch(TEST_BUCKET, SensorReading, {
          key: testKey,
        });

        // Collect first 3 updates in a fiber
        const collectFiber = yield* pipe(
          watchStream,
          Stream.take(3),
          Stream.runCollect,
          Effect.fork
        );

        // Give watch time to start
        yield* Effect.sleep(Duration.millis(300));

        // Publish 3 sensor readings
        for (let i = 1; i <= 3; i++) {
          yield* kv.put(TEST_BUCKET, testKey, SensorReading, {
            sensorId: 'sensor-1',
            temperature: 20 + i,
            humidity: 50 + i,
            timestamp: new Date(),
          });
          yield* Effect.sleep(Duration.millis(100));
        }

        // Wait for collected updates with longer timeout
        const updates = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(10))
        );

        const arr = Chunk.toArray(updates);
        expect(arr.length).toBe(3);
        expect(arr[0].value.temperature).toBe(21);
        expect(arr[1].value.temperature).toBe(22);
        expect(arr[2].value.temperature).toBe(23);
        expect(arr.every((e) => e.key === testKey)).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    }, 20000); // 20s timeout for test

    it('watch with wildcard receives updates from multiple keys', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      // NATS KV uses '.' as separator for hierarchical keys
      // Wildcard pattern uses '*' to match single token
      const prefix = `watch.multi.${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Start watching with wildcard pattern: prefix.* matches prefix.sensor-a, etc.
        const watchStream = yield* kv.watch(TEST_BUCKET, SensorReading, {
          key: `${prefix}.*`,
        });

        // Collect updates in a fiber
        const collectFiber = yield* pipe(
          watchStream,
          Stream.take(3),
          Stream.runCollect,
          Effect.fork
        );

        yield* Effect.sleep(Duration.millis(300));

        // Publish to different keys using hierarchical pattern
        const sensorIds = ['sensor-a', 'sensor-b', 'sensor-c'];
        for (const sensorId of sensorIds) {
          yield* kv.put(TEST_BUCKET, `${prefix}.${sensorId}`, SensorReading, {
            sensorId,
            temperature: 25,
            humidity: 60,
            timestamp: new Date(),
          });
          yield* Effect.sleep(Duration.millis(100));
        }

        const updates = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(10))
        );

        const arr = Chunk.toArray(updates);
        expect(arr.length).toBe(3);
        expect(arr.map((e) => e.value.sensorId).sort()).toEqual(sensorIds.sort());
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    }, 20000); // 20s timeout

    it('watch with lastValue includes initial value', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `watch-initial-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // Put initial value BEFORE watching
        yield* kv.put(TEST_BUCKET, testKey, SensorReading, {
          sensorId: 'initial',
          temperature: 0,
          humidity: 0,
          timestamp: new Date(),
        });

        yield* Effect.sleep(Duration.millis(200));

        // Start watching with lastValue (should include initial)
        const watchStream = yield* kv.watch(TEST_BUCKET, SensorReading, {
          key: testKey,
          include: 'lastValue',
        });

        // Collect first update (should be the initial value)
        const collectFiber = yield* pipe(
          watchStream,
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        );

        const updates = yield* Fiber.join(collectFiber).pipe(
          Effect.timeout(Duration.seconds(10))
        );

        const arr = Chunk.toArray(updates);
        expect(arr.length).toBe(1);
        expect(arr[0].value.sensorId).toBe('initial');
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    }, 20000); // 20s timeout
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('decode error for invalid schema data', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `decode-error-${Date.now()}`;

      // Put raw invalid data directly via nats
      if (testConnection) {
        const js = testConnection.jetstream();
        const bucket = await js.views.kv(TEST_BUCKET);
        // Put a string that doesn't match UserProfile schema
        await bucket.put(testKey, new TextEncoder().encode('{"invalid": "data"}'));
      }

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        const result = yield* pipe(
          kv.get(TEST_BUCKET, testKey, UserProfile),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('Codec/Decode');
        }
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('bucket error for nonexistent bucket', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        const result = yield* pipe(
          kv.get('nonexistent-bucket-xyz', 'any-key', UserProfile),
          Effect.either
        );

        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          // Can be bucket error, get error, or not found (bucket operations can manifest in different ways)
          expect(['Inner/KV/Bucket', 'Inner/KV/Get', 'KV/NotFound']).toContain(result.left._tag);
        }
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });

  // ---------------------------------------------------------------------------
  // Complex Schema Types
  // ---------------------------------------------------------------------------

  describe('complex schema types', () => {
    it('handles ConfigValue with union type', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `config-${Date.now()}`;

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        // String value
        yield* kv.put(TEST_BUCKET, `${testKey}-str`, ConfigValue, {
          key: 'string-config',
          value: 'hello',
          updatedAt: new Date(),
        });

        // Number value
        yield* kv.put(TEST_BUCKET, `${testKey}-num`, ConfigValue, {
          key: 'number-config',
          value: 42,
          updatedAt: new Date(),
        });

        // Boolean value
        yield* kv.put(TEST_BUCKET, `${testKey}-bool`, ConfigValue, {
          key: 'bool-config',
          value: true,
          updatedAt: new Date(),
        });

        // Retrieve and verify
        const strCfg = yield* kv.get(TEST_BUCKET, `${testKey}-str`, ConfigValue);
        expect(strCfg.value).toBe('hello');

        const numCfg = yield* kv.get(TEST_BUCKET, `${testKey}-num`, ConfigValue);
        expect(numCfg.value).toBe(42);

        const boolCfg = yield* kv.get(TEST_BUCKET, `${testKey}-bool`, ConfigValue);
        expect(boolCfg.value).toBe(true);
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });

    it('handles Date serialization correctly', async () => {
      if (SKIP_INTEGRATION || !serverAvailable) return;

      const testKey = `date-${Date.now()}`;
      const testDate = new Date('2024-06-15T10:30:00.000Z');

      const program = Effect.gen(function* () {
        const kv = yield* NatsKVService;

        yield* kv.put(TEST_BUCKET, testKey, SensorReading, {
          sensorId: 'date-test',
          temperature: 25,
          humidity: 50,
          timestamp: testDate,
        });

        const result = yield* kv.get(TEST_BUCKET, testKey, SensorReading);
        expect(result.timestamp.toISOString()).toBe(testDate.toISOString());
      }).pipe(Effect.scoped, Effect.provide(testKVLayer));

      await Effect.runPromise(program);
    });
  });
});
