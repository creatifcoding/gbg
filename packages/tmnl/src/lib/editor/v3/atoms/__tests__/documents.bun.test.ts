// @ts-nocheck — bun:test types differ from vitest
/**
 * Document Atoms Integration Tests
 *
 * Tests the Atom-as-State pattern for document persistence layer.
 * Requires:
 * - NATS server at localhost:4222
 * - y-sweet server at localhost:8080
 *
 * Run with: bun test src/lib/editor/v3/atoms/__tests__/documents.bun.test.ts
 *
 * @module editor/v3/atoms/__tests__/documents.bun.test
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { Registry } from '@effect-atom/atom';

import {
  documentsAtom,
  currentDocumentIdAtom,
  documentsLoadingAtom,
  documentsErrorAtom,
  documentListAtom,
  currentDocumentAtom,
  documentCountAtom,
  hasCurrentDocumentAtom,
  documentOps,
  documentQueries,
  documentRuntimeAtom,
} from '../documents';

import {
  DocumentRegistryService,
  DocumentRegistryServiceLive,
} from '../../services/DocumentRegistryService';
import { NatsKVService, NatsConfigTag } from '@/lib/nats';
import {
  CollaborationService,
  CollaborationConfigTag,
} from '../../services/CollaborationService';

import type {
  DocumentId,
  IdentityId,
  DocumentMetadata,
} from '../../schemas/document';

// =============================================================================
// Test Layer
// =============================================================================

const testNatsConfigLayer = Layer.succeed(NatsConfigTag, {
  servers: 'nats://localhost:4222',
  name: 'tmnl-atom-test',
});

const testCollabConfigLayer = Layer.succeed(CollaborationConfigTag, {
  serverUrl: 'http://localhost:8080',
});

/**
 * Full test layer with all dependencies.
 * DocumentRegistryService → NatsKVService + CollaborationService
 *
 * Using ManagedRuntime to ensure:
 * 1. Layer is built ONCE and memoized
 * 2. Scoped resources (NATS connection) persist across tests
 * 3. Proper cleanup on test suite completion
 */
const TestServiceLayer = DocumentRegistryServiceLive.pipe(
  Layer.provide(NatsKVService.Default.pipe(Layer.provide(testNatsConfigLayer))),
  Layer.provide(
    CollaborationService.Default.pipe(Layer.provide(testCollabConfigLayer))
  )
);

/**
 * ManagedRuntime persists the layer across all tests.
 * Initialized in beforeAll, disposed in afterAll.
 */
let runtime: ManagedRuntime.ManagedRuntime<DocumentRegistryService, never>;

// =============================================================================
// Test Helpers
// =============================================================================

const testIdentity = 'test-user-001' as IdentityId;

/**
 * Run an Effect using the shared ManagedRuntime.
 * This ensures all tests use the same service instances.
 */
const runTest = <A, E>(effect: Effect.Effect<A, E, DocumentRegistryService>) =>
  runtime.runPromise(effect);

/**
 * Create a unique document title for test isolation.
 */
const uniqueTitle = () =>
  `Test Doc ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Create a fresh Registry for atom operations.
 */
const createRegistry = () => Registry.make();

/**
 * Created document IDs for cleanup.
 */
const createdDocIds: DocumentId[] = [];

// =============================================================================
// Setup & Teardown
// =============================================================================

beforeAll(async () => {
  // Create ManagedRuntime — this builds the layer once and memoizes it
  runtime = ManagedRuntime.make(TestServiceLayer);

  // Verify services are reachable
  await runTest(
    Effect.gen(function* () {
      const registry = yield* DocumentRegistryService;
      // Simple health check - list should not throw
      yield* registry.list();
    })
  );
});

afterAll(async () => {
  // Clean up created documents
  if (createdDocIds.length > 0) {
    await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;
        for (const docId of createdDocIds) {
          yield* registry.purge(docId).pipe(
            Effect.catchAll(() => Effect.succeed(undefined)) // Ignore errors
          );
        }
      })
    );
  }

  // Dispose the managed runtime — this closes NATS connection, etc.
  await runtime.dispose();
});

// =============================================================================
// Tests: State Atoms (Initial State)
// =============================================================================

describe('Document State Atoms', () => {
  test('documentsAtom starts empty', () => {
    const registry = createRegistry();
    const docs = registry.get(documentsAtom);
    expect(docs.size).toBe(0);
  });

  test('currentDocumentIdAtom starts null', () => {
    const registry = createRegistry();
    const currentId = registry.get(currentDocumentIdAtom);
    expect(currentId).toBeNull();
  });

  test('documentsLoadingAtom starts false', () => {
    const registry = createRegistry();
    const loading = registry.get(documentsLoadingAtom);
    expect(loading).toBe(false);
  });

  test('documentsErrorAtom starts null', () => {
    const registry = createRegistry();
    const error = registry.get(documentsErrorAtom);
    expect(error).toBeNull();
  });

  test('documentListAtom starts empty', () => {
    const registry = createRegistry();
    const list = registry.get(documentListAtom);
    expect(list).toEqual([]);
  });
});

// =============================================================================
// Tests: Derived Atoms
// =============================================================================

describe('Derived Atoms', () => {
  test('currentDocumentAtom returns null when no current document', () => {
    const registry = createRegistry();
    const current = registry.get(currentDocumentAtom);
    expect(current).toBeNull();
  });

  test('documentCountAtom returns 0 for empty map', () => {
    const registry = createRegistry();
    const count = registry.get(documentCountAtom);
    expect(count).toBe(0);
  });

  test('hasCurrentDocumentAtom returns false when no selection', () => {
    const registry = createRegistry();
    const hasCurrent = registry.get(hasCurrentDocumentAtom);
    expect(hasCurrent).toBe(false);
  });

  test('derived atoms update when state changes', () => {
    const registry = createRegistry();

    // Simulate adding a document
    const mockDoc: DocumentMetadata = {
      id: 'doc-test-001' as DocumentId,
      title: 'Test Document',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: new Date(),
      updatedBy: testIdentity,
      updatedAt: new Date(),
      version: 1,
      ysweetDocId: 'ysweet-test-001',
    };

    const docs = new Map<DocumentId, DocumentMetadata>();
    docs.set(mockDoc.id, mockDoc);
    registry.set(documentsAtom, docs);
    registry.set(currentDocumentIdAtom, mockDoc.id);

    // Check derived atoms
    expect(registry.get(documentCountAtom)).toBe(1);
    expect(registry.get(hasCurrentDocumentAtom)).toBe(true);
    expect(registry.get(currentDocumentAtom)).toEqual(mockDoc);
  });

  test('documentListAtom derives from documentsAtom (auto-updates on add)', () => {
    const registry = createRegistry();

    // Start empty
    expect(registry.get(documentListAtom)).toEqual([]);

    // Add document to documentsAtom
    const mockDoc: DocumentMetadata = {
      id: 'doc-test-002' as DocumentId,
      title: 'Derived Test',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: new Date(),
      updatedBy: testIdentity,
      updatedAt: new Date(),
      version: 1,
      ysweetDocId: 'ysweet-test-002',
    };

    const docs = new Map<DocumentId, DocumentMetadata>();
    docs.set(mockDoc.id, mockDoc);
    registry.set(documentsAtom, docs);

    // documentListAtom should auto-update
    const list = registry.get(documentListAtom);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(mockDoc.id);
    expect(list[0].title).toBe('Derived Test');
  });

  test('documentListAtom auto-updates on delete from documentsAtom', () => {
    const registry = createRegistry();

    // Setup: two documents
    const doc1: DocumentMetadata = {
      id: 'doc-test-003' as DocumentId,
      title: 'Doc 1',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: new Date(),
      updatedBy: testIdentity,
      updatedAt: new Date(),
      version: 1,
      ysweetDocId: 'ysweet-test-003',
    };

    const doc2: DocumentMetadata = {
      id: 'doc-test-004' as DocumentId,
      title: 'Doc 2',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: new Date(),
      updatedBy: testIdentity,
      updatedAt: new Date(),
      version: 1,
      ysweetDocId: 'ysweet-test-004',
    };

    const docs = new Map<DocumentId, DocumentMetadata>();
    docs.set(doc1.id, doc1);
    docs.set(doc2.id, doc2);
    registry.set(documentsAtom, docs);

    // Verify both in list
    let list = registry.get(documentListAtom);
    expect(list.length).toBe(2);

    // Delete doc1 from documentsAtom (simulating documentOps.delete)
    const updated = new Map<DocumentId, DocumentMetadata>();
    updated.set(doc2.id, doc2);
    registry.set(documentsAtom, updated);

    // documentListAtom should auto-update
    list = registry.get(documentListAtom);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(doc2.id);
    expect(list.find((item) => item.id === doc1.id)).toBeUndefined();
  });

  test('documentListAtom sorts by updatedAt descending', () => {
    const registry = createRegistry();

    const now = new Date();
    const older = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const newest = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour future

    const doc1: DocumentMetadata = {
      id: 'doc-oldest' as DocumentId,
      title: 'Oldest',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: older,
      updatedBy: testIdentity,
      updatedAt: older,
      version: 1,
      ysweetDocId: 'ysweet-oldest',
    };

    const doc2: DocumentMetadata = {
      id: 'doc-middle' as DocumentId,
      title: 'Middle',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: now,
      updatedBy: testIdentity,
      updatedAt: now,
      version: 1,
      ysweetDocId: 'ysweet-middle',
    };

    const doc3: DocumentMetadata = {
      id: 'doc-newest' as DocumentId,
      title: 'Newest',
      status: 'draft',
      visibility: 'private',
      createdBy: testIdentity,
      createdAt: newest,
      updatedBy: testIdentity,
      updatedAt: newest,
      version: 1,
      ysweetDocId: 'ysweet-newest',
    };

    // Add in random order
    const docs = new Map<DocumentId, DocumentMetadata>();
    docs.set(doc2.id, doc2); // Middle first
    docs.set(doc1.id, doc1); // Oldest second
    docs.set(doc3.id, doc3); // Newest last
    registry.set(documentsAtom, docs);

    // Get list - should be sorted newest first
    const list = registry.get(documentListAtom);
    expect(list.length).toBe(3);
    expect(list[0].id).toBe('doc-newest');
    expect(list[1].id).toBe('doc-middle');
    expect(list[2].id).toBe('doc-oldest');
  });
});

// =============================================================================
// Tests: documentOps.create (Integration)
// =============================================================================

describe('documentOps.create', () => {
  test('creates document in NATS + y-sweet and updates atoms', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create document via service
        const { metadata, clientToken } = yield* registry.create(
          { title },
          testIdentity
        );

        // Track for cleanup
        createdDocIds.push(metadata.id);

        return { metadata, clientToken };
      })
    );

    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBe(title);
    expect(result.metadata.status).toBe('draft');
    expect(result.metadata.visibility).toBe('private');
    expect(result.metadata.createdBy).toBe(testIdentity);
    expect(result.metadata.version).toBe(1);
    expect(result.metadata.ysweetDocId).toBeDefined();

    // Verify y-sweet token
    expect(result.clientToken).toBeDefined();
    expect(result.clientToken.url).toBeDefined();
  });

  test('created document persists in NATS KV', async () => {
    const title = uniqueTitle();

    // Keep create + read in same Effect to use same service instance
    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Read back immediately (same service instance)
        const fetched = yield* registry.get(metadata.id);

        return { created: metadata, fetched };
      })
    );

    expect(result.fetched.title).toBe(title);
    expect(result.fetched.id).toBe(result.created.id);
  });
});

// =============================================================================
// Tests: documentOps.load (Integration)
// =============================================================================

describe('documentOps.load', () => {
  test('loads existing document', async () => {
    const title = uniqueTitle();

    // Create and load in same Effect (same service instance)
    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Load it back
        const loaded = yield* registry.get(metadata.id);

        return { docId: metadata.id, loaded };
      })
    );

    expect(result.loaded.id).toBe(result.docId);
    expect(result.loaded.title).toBe(title);
  });

  test('throws DocumentNotFoundError for non-existent document', async () => {
    const fakeId = 'doc-nonexistent-9999' as DocumentId;

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;
        return yield* registry.get(fakeId).pipe(
          Effect.map(() => ({ found: true, error: null })),
          Effect.catchTag('DocumentNotFoundError', (e) =>
            Effect.succeed({ found: false, error: e })
          )
        );
      })
    );

    expect(result.found).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?._tag).toBe('DocumentNotFoundError');
  });
});

// =============================================================================
// Tests: documentOps.update (Integration)
// =============================================================================

describe('documentOps.update', () => {
  test('updates document metadata with version increment', async () => {
    const title = uniqueTitle();
    const newTitle = `${title} - Updated`;

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Update
        const updated = yield* registry.update(
          metadata.id,
          { title: newTitle },
          testIdentity,
          metadata.version
        );

        return { original: metadata, updated };
      })
    );

    expect(result.updated.title).toBe(newTitle);
    expect(result.updated.version).toBe(2);
    expect(result.updated.updatedBy).toBe(testIdentity);
    expect(result.updated.updatedAt.getTime()).toBeGreaterThan(
      result.original.createdAt.getTime()
    );
  });

  test('throws DocumentVersionConflictError on stale version', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // First update (v1 -> v2)
        yield* registry.update(
          metadata.id,
          { title: `${title} - V2` },
          testIdentity,
          1
        );

        // Second update with stale version (expecting v1, but it's v2)
        return yield* registry
          .update(metadata.id, { title: `${title} - Stale` }, testIdentity, 1)
          .pipe(
            Effect.map(() => ({ conflicted: false, error: null })),
            Effect.catchTag('DocumentVersionConflictError', (e) =>
              Effect.succeed({ conflicted: true, error: e })
            )
          );
      })
    );

    expect(result.conflicted).toBe(true);
    expect(result.error?._tag).toBe('DocumentVersionConflictError');
  });

  test('updates status field', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create (default: draft)
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Update to published
        const updated = yield* registry.update(
          metadata.id,
          { status: 'published' },
          testIdentity,
          metadata.version
        );

        return updated;
      })
    );

    expect(result.status).toBe('published');
  });

  test('updates visibility field', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create (default: private)
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Update to public
        const updated = yield* registry.update(
          metadata.id,
          { visibility: 'public' },
          testIdentity,
          metadata.version
        );

        return updated;
      })
    );

    expect(result.visibility).toBe('public');
  });
});

// =============================================================================
// Tests: documentOps.delete (Integration)
// =============================================================================

describe('documentOps.delete', () => {
  test('soft deletes document (sets status to deleted)', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Soft delete
        yield* registry.delete(metadata.id, testIdentity);

        // Verify it's marked as deleted (still exists)
        const afterDelete = yield* registry.get(metadata.id);

        return afterDelete;
      })
    );

    expect(result.status).toBe('deleted');
  });

  test('deleted document excluded from list', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Soft delete
        yield* registry.delete(metadata.id, testIdentity);

        // List (should not include deleted)
        const list = yield* registry.list();

        return { docId: metadata.id, list };
      })
    );

    const found = result.list.find((item) => item.id === result.docId);
    expect(found).toBeUndefined();
  });
});

// =============================================================================
// Tests: documentOps.loadList (Integration)
// =============================================================================

describe('documentOps.loadList', () => {
  test('returns list of active documents', async () => {
    const title1 = uniqueTitle();
    const title2 = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create two documents
        const { metadata: m1 } = yield* registry.create(
          { title: title1 },
          testIdentity
        );
        const { metadata: m2 } = yield* registry.create(
          { title: title2 },
          testIdentity
        );
        createdDocIds.push(m1.id, m2.id);

        // List
        const list = yield* registry.list();

        return { ids: [m1.id, m2.id], list };
      })
    );

    // Both should be in the list
    expect(result.list.some((item) => item.id === result.ids[0])).toBe(true);
    expect(result.list.some((item) => item.id === result.ids[1])).toBe(true);
  });
});

// =============================================================================
// Tests: documentQueries.getClientToken (Integration)
// =============================================================================

describe('documentQueries.getClientToken', () => {
  test('returns valid y-sweet client token', async () => {
    const title = uniqueTitle();

    const result = await runTest(
      Effect.gen(function* () {
        const registry = yield* DocumentRegistryService;

        // Create document
        const { metadata } = yield* registry.create({ title }, testIdentity);
        createdDocIds.push(metadata.id);

        // Get client token
        const token = yield* registry.getClientToken(metadata.id);

        return token;
      })
    );

    expect(result).toBeDefined();
    expect(result.url).toBeDefined();
    expect(typeof result.url).toBe('string');
  });
});

// =============================================================================
// Tests: Registry Helper Methods
// =============================================================================

describe('documentOps helper methods', () => {
  test('setCurrent updates currentDocumentIdAtom', () => {
    const registry = createRegistry();
    const docId = 'doc-test-helper-001' as DocumentId;

    documentOps.setCurrent(docId, registry);

    expect(registry.get(currentDocumentIdAtom)).toBe(docId);
  });

  test('setCurrent with null clears selection', () => {
    const registry = createRegistry();
    const docId = 'doc-test-helper-002' as DocumentId;

    documentOps.setCurrent(docId, registry);
    expect(registry.get(currentDocumentIdAtom)).toBe(docId);

    documentOps.setCurrent(null, registry);
    expect(registry.get(currentDocumentIdAtom)).toBeNull();
  });

  test('clearError resets error atom', () => {
    const registry = createRegistry();

    // Set an error
    registry.set(documentsErrorAtom, 'Some error occurred');
    expect(registry.get(documentsErrorAtom)).toBe('Some error occurred');

    // Clear it
    documentOps.clearError(registry);
    expect(registry.get(documentsErrorAtom)).toBeNull();
  });
});
