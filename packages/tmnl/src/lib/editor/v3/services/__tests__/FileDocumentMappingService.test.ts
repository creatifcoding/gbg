/**
 * FileDocumentMappingService Tests
 *
 * Tests for file path → document ID mapping, sync status management,
 * and conflict detection logic.
 *
 * These tests connect to the real NATS server for integration testing.
 * Requires NATS to be running (docker compose up).
 *
 * @module editor/v3/services/__tests__/FileDocumentMappingService.test
 */

import { describe, it, expect, beforeEach } from '@effect/vitest';
import { Effect } from 'effect';

import {
  FileDocumentMappingService,
  type FilePath,
  type FileSyncStatus,
  pathToKey,
  keyToPath,
  FileMappingNotFoundError,
} from '../FileDocumentMappingService';
import type { DocumentId } from '../../schemas/document';

// =============================================================================
// Test Layer (uses real NATS)
// =============================================================================

const TestLayer = FileDocumentMappingService.Default;

/**
 * Clean up test data before each test.
 * Uses unique test paths with timestamps to avoid collisions.
 */
const testPrefix = `test-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Unique prefix per test file run to avoid collisions in NATS KV.
 * Each test run gets a unique namespace.
 */
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const testPath = `/test/${runId}/test.md` as FilePath;
const testPath2 = `/test/${runId}/other.md` as FilePath;
const testMtime = Date.now();
const testHash = 'abc123hash';

// =============================================================================
// Tests: Path Encoding
// =============================================================================

describe('Path Encoding', () => {
  it('pathToKey encodes path to base64url', () => {
    const key = pathToKey(testPath);
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    // Should not contain characters that would break KV keys
    expect(key).not.toContain('+');
    expect(key).not.toContain('/');
    expect(key).not.toContain('=');
  });

  it('keyToPath decodes key back to path', () => {
    const key = pathToKey(testPath);
    const decoded = keyToPath(key);
    expect(decoded).toBe(testPath);
  });

  it('round-trips special characters correctly', () => {
    const pathWithSpaces = '/path/with spaces/file.md' as FilePath;
    const pathWithUnicode = '/path/文件/файл.md' as FilePath;

    expect(keyToPath(pathToKey(pathWithSpaces))).toBe(pathWithSpaces);
    expect(keyToPath(pathToKey(pathWithUnicode))).toBe(pathWithUnicode);
  });
});

// =============================================================================
// Tests: getOrCreate
// =============================================================================

describe('FileDocumentMappingService.getOrCreate', () => {
  it.effect('creates new mapping for unknown path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const mapping = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      expect(mapping).toBeDefined();
      expect(mapping.path).toBe(testPath);
      expect(mapping.documentId).toBeDefined();
      expect(mapping.lastSyncedMtime).toBe(testMtime);
      expect(mapping.lastSyncedHash).toBe(testHash);
      expect(mapping.syncStatus).toBe('synced');
      expect(mapping.createdAt).toBeInstanceOf(Date);
      expect(mapping.updatedAt).toBeInstanceOf(Date);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('returns existing mapping for known path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create first
      const first = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Get again with different mtime (should return existing)
      const second = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime + 1000,
        contentHash: 'differenthash',
      });

      // Should be same document ID
      expect(second.documentId).toBe(first.documentId);
      // Should retain original values (not updated)
      expect(second.lastSyncedMtime).toBe(testMtime);
      expect(second.lastSyncedHash).toBe(testHash);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('generates unique document IDs for different paths', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const mapping1 = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      const mapping2 = yield* service.getOrCreate({
        path: testPath2,
        mtime: testMtime,
        contentHash: testHash,
      });

      expect(mapping1.documentId).not.toBe(mapping2.documentId);
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: getByPath / getByDocumentId
// =============================================================================

describe('FileDocumentMappingService.getByPath', () => {
  it.effect('returns null for unknown path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const result = yield* service.getByPath(
        '/nonexistent/path.md' as FilePath
      );

      expect(result).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('returns mapping for known path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create
      const created = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Get
      const fetched = yield* service.getByPath(testPath);

      expect(fetched).not.toBeNull();
      expect(fetched?.documentId).toBe(created.documentId);
    }).pipe(Effect.provide(TestLayer))
  );
});

describe('FileDocumentMappingService.getByDocumentId', () => {
  it.effect('returns null for unknown document ID', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const result = yield* service.getByDocumentId(
        'doc-nonexistent' as DocumentId
      );

      expect(result).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('returns mapping for known document ID', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create
      const created = yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Get by document ID
      const fetched = yield* service.getByDocumentId(created.documentId);

      expect(fetched).not.toBeNull();
      expect(fetched?.path).toBe(testPath);
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: Sync Status Management
// =============================================================================

describe('FileDocumentMappingService.markDirty', () => {
  it.effect('marks synced file as dirty', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create (starts synced)
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Mark dirty
      const updated = yield* service.markDirty(testPath);

      expect(updated.syncStatus).toBe('dirty');
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('throws FileMappingNotFoundError for unknown path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const result = yield* service
        .markDirty('/nonexistent.md' as FilePath)
        .pipe(
          Effect.map(() => ({ success: true, error: null })),
          Effect.catchTag('FileMappingNotFoundError', (e) =>
            Effect.succeed({ success: false, error: e })
          )
        );

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(FileMappingNotFoundError);
    }).pipe(Effect.provide(TestLayer))
  );
});

describe('FileDocumentMappingService.markExternalChange', () => {
  it.effect('marks synced file as external_change', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Use unique path for this test to avoid interference from markDirty tests
      const uniquePath =
        `/test/${runId}/external-change-${Date.now()}.md` as FilePath;

      // Create (starts synced)
      yield* service.getOrCreate({
        path: uniquePath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Mark external change
      const updated = yield* service.markExternalChange(
        uniquePath,
        testMtime + 1000
      );

      expect(updated.syncStatus).toBe('external_change');
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('marks dirty file as conflict when external change detected', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create and mark dirty
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });
      yield* service.markDirty(testPath);

      // Mark external change (should become conflict)
      const updated = yield* service.markExternalChange(
        testPath,
        testMtime + 1000
      );

      expect(updated.syncStatus).toBe('conflict');
    }).pipe(Effect.provide(TestLayer))
  );
});

describe('FileDocumentMappingService.markSynced', () => {
  it.effect('marks file as synced with new mtime and hash', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create and mark dirty
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });
      yield* service.markDirty(testPath);

      // Mark synced
      const newMtime = testMtime + 1000;
      const newHash = 'newhash456';
      const updated = yield* service.markSynced(testPath, newMtime, newHash);

      expect(updated.syncStatus).toBe('synced');
      expect(updated.lastSyncedMtime).toBe(newMtime);
      expect(updated.lastSyncedHash).toBe(newHash);
    }).pipe(Effect.provide(TestLayer))
  );
});

describe('FileDocumentMappingService.markConflict', () => {
  it.effect('explicitly marks file as conflict', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Mark conflict
      const updated = yield* service.markConflict(testPath);

      expect(updated.syncStatus).toBe('conflict');
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: Conflict Detection via markDirty
// =============================================================================

describe('Conflict Detection', () => {
  it.effect('marking dirty when external_change transitions to conflict', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create (synced)
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // External change first
      yield* service.markExternalChange(testPath, testMtime + 1000);

      // Then local edit (should become conflict)
      const updated = yield* service.markDirty(testPath);

      expect(updated.syncStatus).toBe('conflict');
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: hasExternalChanges
// =============================================================================

describe('FileDocumentMappingService.hasExternalChanges', () => {
  it.effect('returns false when mtime matches', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Use unique path to avoid interference from other tests that modify testPath
      const uniquePath =
        `/test/${runId}/mtime-match-${Date.now()}.md` as FilePath;
      const uniqueMtime = Date.now();

      yield* service.getOrCreate({
        path: uniquePath,
        mtime: uniqueMtime,
        contentHash: testHash,
      });

      const result = yield* service.hasExternalChanges(uniquePath, uniqueMtime);

      expect(result).toBe(false);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('returns true when mtime differs', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Use unique path to avoid interference from other tests
      const uniquePath =
        `/test/${runId}/mtime-diff-${Date.now()}.md` as FilePath;
      const uniqueMtime = Date.now();

      yield* service.getOrCreate({
        path: uniquePath,
        mtime: uniqueMtime,
        contentHash: testHash,
      });

      const result = yield* service.hasExternalChanges(
        uniquePath,
        uniqueMtime + 1000
      );

      expect(result).toBe(true);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('throws FileMappingNotFoundError for unknown path', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const result = yield* service
        .hasExternalChanges('/nonexistent.md' as FilePath, testMtime)
        .pipe(
          Effect.map(() => ({ found: true })),
          Effect.catchTag('FileMappingNotFoundError', () =>
            Effect.succeed({ found: false })
          )
        );

      expect(result.found).toBe(false);
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: remove
// =============================================================================

describe('FileDocumentMappingService.remove', () => {
  it.effect('removes existing mapping', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Verify exists
      const before = yield* service.getByPath(testPath);
      expect(before).not.toBeNull();

      // Remove
      yield* service.remove(testPath);

      // Verify gone
      const after = yield* service.getByPath(testPath);
      expect(after).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: list
// =============================================================================

describe('FileDocumentMappingService.list', () => {
  it.effect('returns array of mappings', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      const result = yield* service.list();

      // Should be an array (may contain data from previous runs)
      expect(Array.isArray(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('includes mappings created in this run', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create two mappings
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });
      yield* service.getOrCreate({
        path: testPath2,
        mtime: testMtime,
        contentHash: testHash,
      });

      const result = yield* service.list();

      // Filter to only this run's paths
      const thisRunPaths = result.filter((m) => m.path.includes(runId));

      expect(thisRunPaths.length).toBeGreaterThanOrEqual(2);
      expect(thisRunPaths.map((m) => m.path)).toContain(testPath);
      expect(thisRunPaths.map((m) => m.path)).toContain(testPath2);
    }).pipe(Effect.provide(TestLayer))
  );
});

// =============================================================================
// Tests: updateSync
// =============================================================================

describe('FileDocumentMappingService.updateSync', () => {
  it.effect('updates mtime, hash, and status atomically', () =>
    Effect.gen(function* () {
      const service = yield* FileDocumentMappingService;

      // Create
      yield* service.getOrCreate({
        path: testPath,
        mtime: testMtime,
        contentHash: testHash,
      });

      // Update
      const newMtime = testMtime + 5000;
      const newHash = 'updatedhash';
      const newStatus: FileSyncStatus = 'dirty';

      const updated = yield* service.updateSync(
        testPath,
        newMtime,
        newHash,
        newStatus
      );

      expect(updated.lastSyncedMtime).toBe(newMtime);
      expect(updated.lastSyncedHash).toBe(newHash);
      expect(updated.syncStatus).toBe(newStatus);
    }).pipe(Effect.provide(TestLayer))
  );
});
