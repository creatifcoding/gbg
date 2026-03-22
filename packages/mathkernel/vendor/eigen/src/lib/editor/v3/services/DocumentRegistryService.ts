/**
 * DocumentRegistryService
 *
 * Effect.Service combining CollaborationService (y-sweet/Yjs content)
 * with NatsKVService (document metadata persistence).
 *
 * Architecture:
 * - y-sweet: Real-time Yjs CRDT sync (content)
 * - NATS KV: Document metadata (title, status, visibility, etc.)
 *
 * This service is the single source of truth for document lifecycle.
 * Atoms consume events from this service.
 *
 * @module editor/v3/services/DocumentRegistryService
 */

import { Effect, Stream } from 'effect';
import type { KV } from 'nats';
import type { ClientToken } from '@y-sweet/sdk';
import * as Y from 'yjs';

import { NatsKVService, type KvWatchEvent } from '@/lib/nats';
import { CollaborationService } from './CollaborationService';
import {
  DocumentMetadata,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentListItem,
  DocumentListQuery,
  type DocumentId,
  type IdentityId,
  generateDocumentId,
  createInitialMetadata,
} from '../schemas/document';

// =============================================================================
// Constants
// =============================================================================

const BUCKET_NAME = 'tmnl-documents';
const BUCKET_HISTORY = 10; // Keep 10 revisions

// =============================================================================
// Errors
// =============================================================================

export class DocumentNotFoundError extends Error {
  readonly _tag = 'DocumentNotFoundError';
  constructor(readonly documentId: DocumentId) {
    super(`Document not found: ${documentId}`);
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentVersionConflictError extends Error {
  readonly _tag = 'DocumentVersionConflictError';
  constructor(
    readonly documentId: DocumentId,
    readonly expectedVersion: number,
    readonly actualVersion: number
  ) {
    super(
      `Version conflict for ${documentId}: expected ${expectedVersion}, got ${actualVersion}`
    );
    this.name = 'DocumentVersionConflictError';
  }
}

export class DocumentRegistryError extends Error {
  readonly _tag = 'DocumentRegistryError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DocumentRegistryError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

export interface DocumentRegistryServiceShape {
  /**
   * Create a new document with both y-sweet content and NATS KV metadata.
   * Returns the created metadata and y-sweet client token.
   */
  readonly create: (
    payload: CreateDocumentPayload,
    createdBy: IdentityId
  ) => Effect.Effect<
    { metadata: DocumentMetadata; clientToken: ClientToken },
    DocumentRegistryError
  >;

  /**
   * Get document metadata by ID.
   */
  readonly get: (
    documentId: DocumentId
  ) => Effect.Effect<
    DocumentMetadata,
    DocumentNotFoundError | DocumentRegistryError
  >;

  /**
   * Get y-sweet client token for a document.
   * Use this to connect a Yjs provider.
   */
  readonly getClientToken: (
    documentId: DocumentId
  ) => Effect.Effect<
    ClientToken,
    DocumentNotFoundError | DocumentRegistryError
  >;

  /**
   * Update document metadata.
   * Uses optimistic concurrency control (version check).
   */
  readonly update: (
    documentId: DocumentId,
    payload: UpdateDocumentPayload,
    updatedBy: IdentityId,
    expectedVersion: number
  ) => Effect.Effect<
    DocumentMetadata,
    DocumentNotFoundError | DocumentVersionConflictError | DocumentRegistryError
  >;

  /**
   * Soft delete a document (set status to 'deleted').
   */
  readonly delete: (
    documentId: DocumentId,
    deletedBy: IdentityId
  ) => Effect.Effect<void, DocumentNotFoundError | DocumentRegistryError>;

  /**
   * Hard delete a document and its y-sweet content.
   */
  readonly purge: (
    documentId: DocumentId
  ) => Effect.Effect<void, DocumentNotFoundError | DocumentRegistryError>;

  /**
   * List documents matching query filters.
   */
  readonly list: (
    query?: DocumentListQuery
  ) => Effect.Effect<readonly DocumentListItem[], DocumentRegistryError>;

  /**
   * Watch for document changes in real-time.
   * Emits events when documents are created, updated, or deleted.
   */
  readonly watch: (
    pattern?: string
  ) => Stream.Stream<KvWatchEvent<DocumentMetadata>, DocumentRegistryError>;

  /**
   * Create a Y.Doc instance for local editing.
   */
  readonly createDoc: () => Effect.Effect<Y.Doc, never>;

  /**
   * Destroy a Y.Doc instance.
   */
  readonly destroyDoc: (doc: Y.Doc) => Effect.Effect<void, never>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class DocumentRegistryService extends Effect.Service<DocumentRegistryService>()(
  'tmnl/editor/DocumentRegistryService',
  {
    effect: Effect.gen(function* () {
      const natsKv = yield* NatsKVService;
      const collaboration = yield* CollaborationService;

      // Initialize bucket (lazy)
      let bucket: KV | null = null;

      const ensureBucket = Effect.gen(function* () {
        if (bucket === null) {
          bucket = yield* natsKv
            .getOrCreateBucket(BUCKET_NAME, {
              history: BUCKET_HISTORY,
            })
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(
                    `Failed to init bucket: ${e.message}`,
                    e
                  )
              )
            );
        }
        return bucket;
      });

      // --- CREATE ---
      const create = (
        payload: CreateDocumentPayload,
        createdBy: IdentityId
      ): Effect.Effect<
        { metadata: DocumentMetadata; clientToken: ClientToken },
        DocumentRegistryError
      > =>
        Effect.gen(function* () {
          console.log('[DocumentRegistryService.create] Starting...', {
            title: payload.title,
            createdBy,
          });
          const b = yield* ensureBucket;
          console.log('[DocumentRegistryService.create] Bucket acquired');

          // 1. Generate document ID
          const docId = generateDocumentId();
          console.log(
            '[DocumentRegistryService.create] Generated docId:',
            docId
          );

          // 2. Get y-sweet token (creates doc in y-sweet if needed)
          console.log(
            '[DocumentRegistryService.create] Getting y-sweet token...'
          );
          const clientToken = yield* collaboration
            .getClientToken(docId)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(`y-sweet error: ${e.message}`, e)
              )
            );
          console.log(
            '[DocumentRegistryService.create] Got y-sweet token:',
            clientToken?.url
          );

          // 3. Create metadata
          const metadata = createInitialMetadata(payload, createdBy, docId);
          console.log(
            '[DocumentRegistryService.create] Created metadata:',
            metadata.id
          );

          // 4. Store in NATS KV
          console.log('[DocumentRegistryService.create] Storing in NATS KV...');
          yield* natsKv
            .put(b, docId, metadata, DocumentMetadata)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(`Failed to store metadata: ${e}`, e)
              )
            );
          console.log('[DocumentRegistryService.create] Stored in NATS KV!');

          return { metadata, clientToken };
        });

      // --- GET ---
      const get = (
        documentId: DocumentId
      ): Effect.Effect<
        DocumentMetadata,
        DocumentNotFoundError | DocumentRegistryError
      > =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;

          const result = yield* natsKv
            .get(b, documentId, DocumentMetadata)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(`Failed to get metadata: ${e}`, e)
              )
            );

          if (result === null) {
            return yield* Effect.fail(new DocumentNotFoundError(documentId));
          }

          return result;
        });

      // --- GET CLIENT TOKEN ---
      const getClientToken = (
        documentId: DocumentId
      ): Effect.Effect<
        ClientToken,
        DocumentNotFoundError | DocumentRegistryError
      > =>
        Effect.gen(function* () {
          // Verify document exists in registry
          const metadata = yield* get(documentId);

          // Get y-sweet token using the ysweetDocId
          return yield* collaboration
            .getClientToken(metadata.ysweetDocId)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(`y-sweet error: ${e.message}`, e)
              )
            );
        });

      // --- UPDATE ---
      const update = (
        documentId: DocumentId,
        payload: UpdateDocumentPayload,
        updatedBy: IdentityId,
        expectedVersion: number
      ): Effect.Effect<
        DocumentMetadata,
        | DocumentNotFoundError
        | DocumentVersionConflictError
        | DocumentRegistryError
      > =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;

          // 1. Get current metadata
          const current = yield* get(documentId);

          // 2. Check version
          if (current.version !== expectedVersion) {
            return yield* Effect.fail(
              new DocumentVersionConflictError(
                documentId,
                expectedVersion,
                current.version
              )
            );
          }

          // 3. Merge updates
          const updated: DocumentMetadata = {
            ...current,
            title: payload.title ?? current.title,
            status: payload.status ?? current.status,
            visibility: payload.visibility ?? current.visibility,
            tags: payload.tags ?? current.tags,
            metadata: payload.metadata ?? current.metadata,
            updatedBy,
            updatedAt: new Date(),
            version: current.version + 1,
          };

          // 4. Store updated metadata
          yield* natsKv
            .put(b, documentId, updated, DocumentMetadata)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(
                    `Failed to update metadata: ${e}`,
                    e
                  )
              )
            );

          return updated;
        });

      // --- DELETE (soft) ---
      const del = (
        documentId: DocumentId,
        deletedBy: IdentityId
      ): Effect.Effect<void, DocumentNotFoundError | DocumentRegistryError> =>
        Effect.gen(function* () {
          const current = yield* get(documentId);

          yield* update(
            documentId,
            { status: 'deleted' },
            deletedBy,
            current.version
          ).pipe(
            // Map version conflict to registry error (shouldn't happen in practice)
            Effect.catchTag('DocumentVersionConflictError', (e) =>
              Effect.fail(
                new DocumentRegistryError(
                  `Concurrent modification during delete: ${e.message}`,
                  e
                )
              )
            )
          );
        });

      // --- PURGE (hard delete) ---
      const purge = (
        documentId: DocumentId
      ): Effect.Effect<void, DocumentNotFoundError | DocumentRegistryError> =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;

          // Verify exists
          yield* get(documentId);

          // Delete from NATS KV
          yield* natsKv
            .purge(b, documentId)
            .pipe(
              Effect.mapError(
                (e) => new DocumentRegistryError(`Failed to purge: ${e}`, e)
              )
            );

          // TODO: Delete from y-sweet (API not available in SDK yet)
        });

      // --- LIST ---
      const list = (
        query?: DocumentListQuery
      ): Effect.Effect<readonly DocumentListItem[], DocumentRegistryError> =>
        Effect.gen(function* () {
          const b = yield* ensureBucket;

          const entries = yield* natsKv
            .list(b, DocumentMetadata)
            .pipe(
              Effect.mapError(
                (e) =>
                  new DocumentRegistryError(`Failed to list documents: ${e}`, e)
              )
            );

          // Filter and transform
          let items = entries
            .filter((e) => e.value.status !== 'deleted')
            .map((e) => ({
              id: e.value.id,
              title: e.value.title,
              status: e.value.status,
              visibility: e.value.visibility,
              createdBy: e.value.createdBy,
              createdAt: e.value.createdAt,
              updatedAt: e.value.updatedAt,
              tags: e.value.tags,
            }));

          // Apply filters
          if (query) {
            if (query.status) {
              items = items.filter((i) => i.status === query.status);
            }
            if (query.visibility) {
              items = items.filter((i) => i.visibility === query.visibility);
            }
            if (query.createdBy) {
              items = items.filter((i) => i.createdBy === query.createdBy);
            }
            if (query.tags && query.tags.length > 0) {
              items = items.filter((i) =>
                query.tags!.some((t) => i.tags?.includes(t))
              );
            }

            // Pagination
            const offset = query.offset ?? 0;
            const limit = query.limit ?? 50;
            items = items.slice(offset, offset + limit);
          }

          return items;
        });

      // --- WATCH ---
      const watch = (
        pattern = '>'
      ): Stream.Stream<KvWatchEvent<DocumentMetadata>, DocumentRegistryError> =>
        Stream.unwrap(
          Effect.gen(function* () {
            const b = yield* ensureBucket;

            return natsKv
              .watch(b, pattern, DocumentMetadata)
              .pipe(
                Stream.mapError(
                  (e) => new DocumentRegistryError(`Watch failed: ${e}`, e)
                )
              );
          })
        );

      // --- Y.Doc helpers (delegate to CollaborationService) ---
      const createDoc = () => collaboration.createDoc();
      const destroyDoc = (doc: Y.Doc) => collaboration.destroyDoc(doc);

      return {
        create,
        get,
        getClientToken,
        update,
        delete: del,
        purge,
        list,
        watch,
        createDoc,
        destroyDoc,
      } satisfies DocumentRegistryServiceShape;
    }),
    dependencies: [NatsKVService.Default, CollaborationService.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const DocumentRegistryServiceLive = DocumentRegistryService.Default;
