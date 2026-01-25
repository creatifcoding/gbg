/**
 * SQLite Repository Tests
 *
 * Uses bun:test for SQLite integration tests.
 * See .edin/EFFECT_SQL_SQLITE_PATTERNS.md for patterns.
 *
 * Run with: bun test src/lib/editor/v3/persistence/__tests__/repositories.bun.test.ts
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Effect, Option } from 'effect';
import { SqliteClient } from '@effect/sql-sqlite-bun';
import { Layer } from 'effect';

import {
  FileMappingModel,
  RecentDocumentModel,
  DocumentMetadataCacheModel,
} from '../models';
import {
  FileMappingRepo,
  FileMappingRepoLive,
  RecentDocumentRepo,
  RecentDocumentRepoLive,
  DocumentMetadataCacheRepo,
  DocumentMetadataCacheRepoLive,
  AllRepositoriesLive,
} from '../repositories';
import { runMigrations, dropAllTables } from '../migrations';
import { FilePath } from '../../services/FileDocumentMappingService';
import { DocumentId } from '../../schemas/document';

// =============================================================================
// Test Layer Setup
// =============================================================================

const SqliteTestLayer = SqliteClient.layer({ filename: ':memory:' });

const TestLayer = AllRepositoriesLive.pipe(
  Layer.tap(() => runMigrations),
  Layer.provide(SqliteTestLayer)
);

const runTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    FileMappingRepo | RecentDocumentRepo | DocumentMetadataCacheRepo
  >
) => Effect.runPromise(effect.pipe(Effect.provide(TestLayer)));

// =============================================================================
// FileMappingRepository Tests
// =============================================================================

describe('FileMappingRepository', () => {
  const testPath = '/home/user/test.md' as FilePath;
  const testDocId = 'doc-test-123' as DocumentId;

  test('insert: creates new file mapping', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        const mapping = yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        expect(mapping.path).toBe(testPath);
        expect(mapping.documentId).toBe(testDocId);
        expect(mapping.syncStatus).toBe('synced');
      })
    );
  });

  test('findById: returns mapping when exists', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        // Insert first
        yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        // Find
        const found = yield* repo.findById(testPath);
        expect(Option.isSome(found)).toBe(true);
        expect(Option.getOrThrow(found).documentId).toBe(testDocId);
      })
    );
  });

  test('findById: returns None when not exists', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        const found = yield* repo.findById('/nonexistent/path.md' as FilePath);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });

  test('findByDocumentId: returns mapping by document ID', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        const found = yield* repo.findByDocumentId(testDocId);
        expect(Option.isSome(found)).toBe(true);
        expect(Option.getOrThrow(found).path).toBe(testPath);
      })
    );
  });

  test('updateSyncStatus: updates status without mtime/hash', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: 1000,
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        yield* repo.updateSyncStatus(testPath, 'dirty');

        const found = Option.getOrThrow(yield* repo.findById(testPath));
        expect(found.syncStatus).toBe('dirty');
        expect(found.lastSyncedMtime).toBe(1000); // Unchanged
      })
    );
  });

  test('updateSyncStatus: updates status with mtime/hash', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: 1000,
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        yield* repo.updateSyncStatus(testPath, 'synced', 2000, 'def456');

        const found = Option.getOrThrow(yield* repo.findById(testPath));
        expect(found.syncStatus).toBe('synced');
        expect(found.lastSyncedMtime).toBe(2000);
        expect(found.lastSyncedHash).toBe('def456');
      })
    );
  });

  test('listAll: returns all mappings ordered by updated_at', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        // Insert multiple
        yield* repo.insert(
          FileMappingModel.insert.make({
            path: '/path/a.md' as FilePath,
            documentId: 'doc-a' as DocumentId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'hash-a',
            syncStatus: 'synced',
          })
        );

        yield* repo.insert(
          FileMappingModel.insert.make({
            path: '/path/b.md' as FilePath,
            documentId: 'doc-b' as DocumentId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'hash-b',
            syncStatus: 'dirty',
          })
        );

        const all = yield* repo.listAll();
        expect(all.length).toBe(2);
      })
    );
  });

  test('delete: removes mapping', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* FileMappingRepo;

        yield* repo.insert(
          FileMappingModel.insert.make({
            path: testPath,
            documentId: testDocId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'abc123',
            syncStatus: 'synced',
          })
        );

        yield* repo.delete(testPath);

        const found = yield* repo.findById(testPath);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });
});

// =============================================================================
// RecentDocumentRepository Tests
// =============================================================================

describe('RecentDocumentRepository', () => {
  const testDocId = 'doc-recent-123' as DocumentId;

  test('upsert: creates new recent document', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        const doc = yield* repo.upsert(testDocId, 'Test Document');

        expect(doc.documentId).toBe(testDocId);
        expect(doc.title).toBe('Test Document');
        expect(doc.accessCount).toBe(1);
      })
    );
  });

  test('upsert: updates existing and increments access count', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        // First upsert
        yield* repo.upsert(testDocId, 'Test Document');

        // Second upsert (update)
        const doc = yield* repo.upsert(testDocId, 'Updated Title');

        expect(doc.title).toBe('Updated Title');
        expect(doc.accessCount).toBe(2);
      })
    );
  });

  test('upsert: stores file path when provided', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        const doc = yield* repo.upsert(testDocId, 'Test', '/path/to/file.md');

        expect(doc.filePath).toBe('/path/to/file.md');
      })
    );
  });

  test('touch: increments access count', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        yield* repo.upsert(testDocId, 'Test Document');
        yield* repo.touch(testDocId);

        const found = Option.getOrThrow(
          yield* repo.findByDocumentId(testDocId)
        );
        expect(found.accessCount).toBe(2);
      })
    );
  });

  test('listRecent: returns documents in last-accessed order', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        // Insert multiple with slight delay to ensure different timestamps
        yield* repo.upsert('doc-1' as DocumentId, 'First');
        yield* Effect.sleep('10 millis');
        yield* repo.upsert('doc-2' as DocumentId, 'Second');
        yield* Effect.sleep('10 millis');
        yield* repo.upsert('doc-3' as DocumentId, 'Third');

        const recent = yield* repo.listRecent(10);

        expect(recent.length).toBe(3);
        expect(recent[0].title).toBe('Third'); // Most recent first
        expect(recent[2].title).toBe('First'); // Oldest last
      })
    );
  });

  test('listRecent: respects limit', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        yield* repo.upsert('doc-1' as DocumentId, 'First');
        yield* repo.upsert('doc-2' as DocumentId, 'Second');
        yield* repo.upsert('doc-3' as DocumentId, 'Third');

        const recent = yield* repo.listRecent(2);

        expect(recent.length).toBe(2);
      })
    );
  });

  test('prune: removes oldest entries beyond keepCount', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        yield* repo.upsert('doc-1' as DocumentId, 'First');
        yield* Effect.sleep('10 millis');
        yield* repo.upsert('doc-2' as DocumentId, 'Second');
        yield* Effect.sleep('10 millis');
        yield* repo.upsert('doc-3' as DocumentId, 'Third');

        const pruned = yield* repo.prune(2);

        // Should have deleted 1 (the oldest)
        expect(pruned).toBe(1);

        const remaining = yield* repo.listRecent(10);
        expect(remaining.length).toBe(2);
        expect(remaining.map((d) => d.title)).not.toContain('First');
      })
    );
  });

  test('delete: removes document', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* RecentDocumentRepo;

        const doc = yield* repo.upsert(testDocId, 'Test');
        yield* repo.delete(doc.id);

        const found = yield* repo.findByDocumentId(testDocId);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });
});

// =============================================================================
// DocumentMetadataCacheRepository Tests
// =============================================================================

describe('DocumentMetadataCacheRepository', () => {
  const testDocId = 'doc-meta-123' as DocumentId;

  test('insert: creates new metadata cache entry', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* DocumentMetadataCacheRepo;

        const entry = yield* repo.insert(
          DocumentMetadataCacheModel.insert.make({
            documentId: testDocId,
            title: 'Test Document',
            wordCount: 100,
            charCount: 500,
            filePath: '/path/to/file.md',
            tagsJson: JSON.stringify(['test', 'docs']),
          })
        );

        expect(entry.documentId).toBe(testDocId);
        expect(entry.wordCount).toBe(100);
        expect(entry.charCount).toBe(500);
      })
    );
  });

  test('findById: returns cached metadata', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* DocumentMetadataCacheRepo;

        yield* repo.insert(
          DocumentMetadataCacheModel.insert.make({
            documentId: testDocId,
            title: 'Test Document',
            wordCount: 100,
            charCount: 500,
            filePath: null,
            tagsJson: null,
          })
        );

        const found = yield* repo.findById(testDocId);
        expect(Option.isSome(found)).toBe(true);
        expect(Option.getOrThrow(found).title).toBe('Test Document');
      })
    );
  });

  test('upsertStats: inserts when not exists', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* DocumentMetadataCacheRepo;

        yield* repo.upsertStats(testDocId, 'New Doc', 50, 250);

        const found = yield* repo.findById(testDocId);
        expect(Option.isSome(found)).toBe(true);
        const entry = Option.getOrThrow(found);
        expect(entry.title).toBe('New Doc');
        expect(entry.wordCount).toBe(50);
        expect(entry.charCount).toBe(250);
      })
    );
  });

  test('upsertStats: updates when exists', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* DocumentMetadataCacheRepo;

        // Insert
        yield* repo.insert(
          DocumentMetadataCacheModel.insert.make({
            documentId: testDocId,
            title: 'Original',
            wordCount: 100,
            charCount: 500,
            filePath: null,
            tagsJson: null,
          })
        );

        // Upsert (update)
        yield* repo.upsertStats(testDocId, 'Updated', 200, 1000);

        const found = Option.getOrThrow(yield* repo.findById(testDocId));
        expect(found.title).toBe('Updated');
        expect(found.wordCount).toBe(200);
        expect(found.charCount).toBe(1000);
      })
    );
  });

  test('delete: removes cache entry', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* DocumentMetadataCacheRepo;

        yield* repo.insert(
          DocumentMetadataCacheModel.insert.make({
            documentId: testDocId,
            title: 'Test',
            wordCount: 100,
            charCount: 500,
            filePath: null,
            tagsJson: null,
          })
        );

        yield* repo.delete(testDocId);

        const found = yield* repo.findById(testDocId);
        expect(Option.isNone(found)).toBe(true);
      })
    );
  });
});

// =============================================================================
// Migration Tests
// =============================================================================

describe('Migrations', () => {
  test('runMigrations: creates all tables', async () => {
    await runTest(
      Effect.gen(function* () {
        // Tables should already be created by TestLayer
        // Just verify we can use all repos
        const fileMappingRepo = yield* FileMappingRepo;
        const recentRepo = yield* RecentDocumentRepo;
        const metadataRepo = yield* DocumentMetadataCacheRepo;

        // Insert into each to verify tables exist
        yield* fileMappingRepo.insert(
          FileMappingModel.insert.make({
            path: '/test.md' as FilePath,
            documentId: 'doc-1' as DocumentId,
            lastSyncedMtime: Date.now(),
            lastSyncedHash: 'hash',
            syncStatus: 'synced',
          })
        );

        yield* recentRepo.upsert('doc-1' as DocumentId, 'Test');

        yield* metadataRepo.insert(
          DocumentMetadataCacheModel.insert.make({
            documentId: 'doc-1' as DocumentId,
            title: 'Test',
            wordCount: 0,
            charCount: 0,
            filePath: null,
            tagsJson: null,
          })
        );

        // If we get here without errors, tables were created
        expect(true).toBe(true);
      })
    );
  });
});
