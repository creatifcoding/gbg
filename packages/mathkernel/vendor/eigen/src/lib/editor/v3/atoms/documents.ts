/**
 * Document Atoms
 *
 * Atom-as-State pattern for document persistence layer.
 * DocumentRegistryService methods mutate atoms directly.
 * React subscribes via useAtomValue().
 *
 * Architecture:
 * - documentsAtom: Map of all loaded document metadata
 * - currentDocumentIdAtom: Currently active document
 * - documentOps: Operations that mutate state + call service
 *
 * NOTE: FnContext API:
 * - ctx(atom) — read atom value (FnContext is callable)
 * - ctx.set(atom, value) — write atom value
 *
 * Error Handling:
 * - Uses Effect.tapError for side effects on error
 * - Uses Effect.ensuring for cleanup (loading state)
 * - Errors propagate as typed Effect errors, not thrown exceptions
 *
 * @module editor/v3/atoms/documents
 */

import { Atom, Registry } from '@effect-atom/atom-react';
import { Effect, Layer, Data, pipe, ManagedRuntime } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';
import type {
  DocumentMetadata,
  DocumentId,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentListItem,
  IdentityId,
} from '../schemas/document';
import {
  DocumentRegistryService,
  DocumentRegistryServiceLive,
  DocumentNotFoundError,
  DocumentVersionConflictError,
  DocumentRegistryError,
} from '../services/DocumentRegistryService';
import { NatsKVService } from '../../../nats';
import { CollaborationService } from '../services/CollaborationService';

// =============================================================================
// Errors
// =============================================================================

/**
 * Error when document is not loaded in local state.
 */
export class DocumentNotLoadedError extends Data.TaggedError(
  'DocumentNotLoadedError'
)<{
  readonly documentId: DocumentId;
}> {
  override get message() {
    return `Document not loaded in local state: ${this.documentId}`;
  }
}

/**
 * Union of all document operation errors.
 */
export type DocumentOperationError =
  | DocumentNotFoundError
  | DocumentVersionConflictError
  | DocumentRegistryError
  | DocumentNotLoadedError;

// =============================================================================
// Types
// =============================================================================

/**
 * Documents map type alias for clarity.
 */
type DocumentsMap = ReadonlyMap<DocumentId, DocumentMetadata>;

// =============================================================================
// State Atoms (Canonical State)
// =============================================================================

/**
 * Map of all loaded document metadata.
 * Key: DocumentId, Value: DocumentMetadata
 */
export const documentsAtom = Atom.make<DocumentsMap>(
  new Map<DocumentId, DocumentMetadata>()
);

/**
 * Currently active document ID.
 */
export const currentDocumentIdAtom = Atom.make<DocumentId | null>(null);

/**
 * Loading state for document operations.
 */
export const documentsLoadingAtom = Atom.make<boolean>(false);

/**
 * Error state for document operations.
 */
export const documentsErrorAtom = Atom.make<string | null>(null);

/**
 * Document list for picker/browser (DERIVED from documentsAtom).
 *
 * This is a computed atom that transforms the Map<DocumentId, DocumentMetadata>
 * into an array of DocumentListItem sorted by updatedAt descending.
 *
 * Benefits:
 * - Single source of truth (documentsAtom)
 * - Auto-updates when documents are added/removed/updated
 * - No manual sync needed in documentOps
 */
export const documentListAtom = Atom.make((get) => {
  const documentsMap = get(documentsAtom);
  const items: DocumentListItem[] = Array.from(documentsMap.values()).map(
    (doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      visibility: doc.visibility,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      tags: doc.tags,
    })
  );
  // Sort by updatedAt descending (most recent first)
  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
});

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Current document metadata (derived from documentsAtom + currentDocumentIdAtom).
 */
export const currentDocumentAtom = Atom.make((get) => {
  const documents = get(documentsAtom);
  const currentId = get(currentDocumentIdAtom);
  if (!currentId) return null;
  return documents.get(currentId) ?? null;
});

/**
 * Total document count.
 */
export const documentCountAtom = Atom.make((get) => {
  return get(documentsAtom).size;
});

/**
 * Whether a document is currently selected.
 */
export const hasCurrentDocumentAtom = Atom.make((get) => {
  return get(currentDocumentIdAtom) !== null;
});

// =============================================================================
// Runtime
// =============================================================================

/**
 * Combined layer for DocumentRegistryService and dependencies.
 *
 * DocumentRegistryService.Default already includes NatsKVService and
 * CollaborationService via its `dependencies` array. We just need to
 * provide those dependency layers.
 */
const DocumentServicesLayer = DocumentRegistryServiceLive.pipe(
  Layer.provide(NatsKVService.Default),
  Layer.provide(CollaborationService.Default)
);

/**
 * Runtime atom for document operations.
 */
export const documentRuntimeAtom = Atom.runtime(DocumentServicesLayer);

// =============================================================================
// Operations (Atom-as-State pattern)
// =============================================================================

/**
 * Document operations.
 * Each operation:
 * 1. Updates loading/error state via Effect combinators
 * 2. Calls DocumentRegistryService
 * 3. Updates documentsAtom with result
 *
 * Error handling uses Effect patterns:
 * - Effect.tap / Effect.tapError for side effects
 * - Effect.ensuring for cleanup (always runs)
 * - Errors propagate as typed union, not thrown exceptions
 *
 * NOTE: ctx is a FnContext which is callable:
 * - ctx(atom) reads an atom
 * - ctx.set(atom, value) writes an atom
 */
export const documentOps = {
  /**
   * Create a new document.
   *
   * Flow:
   * 1. Set loading state
   * 2. Call DocumentRegistryService.create (y-sweet + NATS KV)
   * 3. Update local state atoms
   * 4. Return metadata + clientToken
   *
   * Errors: DocumentRegistryError (from service)
   */
  create: documentRuntimeAtom.fn<{
    payload: CreateDocumentPayload;
    createdBy: IdentityId;
  }>()(({ payload, createdBy }, ctx) =>
    pipe(
      // Log entry
      Effect.log(`Creating document: ${payload.title}`),

      // Set loading state
      Effect.tap(() =>
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, true);
          ctx.set(documentsErrorAtom, null);
        })
      ),

      // Acquire service and create document
      Effect.flatMap(() => DocumentRegistryService),
      Effect.tap(() =>
        Effect.log('DocumentRegistryService acquired, calling create...')
      ),
      Effect.flatMap((registry) => registry.create(payload, createdBy)),

      // Update local state on success
      Effect.tap(({ metadata, clientToken }) =>
        Effect.sync(() => {
          const current = ctx(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.set(metadata.id, metadata);
          ctx.set(documentsAtom, updated);
          ctx.set(currentDocumentIdAtom, metadata.id);
          console.log('[documentOps.create] Success:', {
            id: metadata.id,
            title: metadata.title,
            tokenUrl: clientToken?.url,
          });
        })
      ),

      // Handle errors — set error state but let error propagate
      Effect.tapError((error) =>
        Effect.sync(() => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error('[documentOps.create] Error:', error);
          ctx.set(documentsErrorAtom, message);
        })
      ),

      // Always reset loading state
      Effect.ensuring(
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, false);
        })
      ),

      // Add span for observability
      Effect.withSpan('documentOps.create', {
        attributes: { title: payload.title, createdBy },
      })
    )
  ),

  /**
   * Load a document by ID.
   *
   * Errors: DocumentNotFoundError | DocumentRegistryError
   */
  load: documentRuntimeAtom.fn<DocumentId>()((documentId, ctx) =>
    pipe(
      Effect.sync(() => {
        ctx.set(documentsLoadingAtom, true);
        ctx.set(documentsErrorAtom, null);
      }),

      Effect.flatMap(() => DocumentRegistryService),
      Effect.flatMap((registry) => registry.get(documentId)),

      // Update local state
      Effect.tap((metadata) =>
        Effect.sync(() => {
          const current = ctx(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.set(metadata.id, metadata);
          ctx.set(documentsAtom, updated);
          ctx.set(currentDocumentIdAtom, metadata.id);
        })
      ),

      Effect.tapError((error) =>
        Effect.sync(() => {
          const message =
            error instanceof Error ? error.message : String(error);
          ctx.set(documentsErrorAtom, message);
        })
      ),

      Effect.ensuring(
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, false);
        })
      ),

      Effect.withSpan('documentOps.load', { attributes: { documentId } })
    )
  ),

  /**
   * Update document metadata.
   *
   * Errors: DocumentNotLoadedError | DocumentNotFoundError | DocumentVersionConflictError | DocumentRegistryError
   */
  update: documentRuntimeAtom.fn<{
    documentId: DocumentId;
    payload: UpdateDocumentPayload;
    updatedBy: IdentityId;
  }>()(({ documentId, payload, updatedBy }, ctx) =>
    pipe(
      Effect.sync(() => {
        ctx.set(documentsLoadingAtom, true);
        ctx.set(documentsErrorAtom, null);
      }),

      // Get current version from local state
      Effect.flatMap(() =>
        Effect.sync(() => {
          const currentDocs = ctx(documentsAtom);
          return currentDocs.get(documentId);
        })
      ),

      // Fail if not loaded locally
      Effect.flatMap((current) =>
        current
          ? Effect.succeed(current)
          : Effect.fail(new DocumentNotLoadedError({ documentId }))
      ),

      // Call service with version
      Effect.flatMap((current) =>
        pipe(
          DocumentRegistryService,
          Effect.flatMap((registry) =>
            registry.update(documentId, payload, updatedBy, current.version)
          )
        )
      ),

      // Update local state
      Effect.tap((metadata) =>
        Effect.sync(() => {
          const currentDocs = ctx(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(currentDocs);
          updated.set(metadata.id, metadata);
          ctx.set(documentsAtom, updated);
        })
      ),

      Effect.tapError((error) =>
        Effect.sync(() => {
          const message =
            error instanceof Error ? error.message : String(error);
          ctx.set(documentsErrorAtom, message);
        })
      ),

      Effect.ensuring(
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, false);
        })
      ),

      Effect.withSpan('documentOps.update', { attributes: { documentId } })
    )
  ),

  /**
   * Delete a document (HARD DELETE - purges from NATS KV).
   *
   * Errors: DocumentNotFoundError | DocumentRegistryError
   */
  delete: documentRuntimeAtom.fn<{
    documentId: DocumentId;
    deletedBy: IdentityId;
  }>()(({ documentId }, ctx) =>
    pipe(
      Effect.sync(() => {
        ctx.set(documentsLoadingAtom, true);
        ctx.set(documentsErrorAtom, null);
      }),

      Effect.flatMap(() => DocumentRegistryService),
      Effect.flatMap((registry) => registry.purge(documentId)),

      // Remove from local state
      Effect.tap(() =>
        Effect.sync(() => {
          const current = ctx(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.delete(documentId);
          ctx.set(documentsAtom, updated);

          // Clear current if deleted
          if (ctx(currentDocumentIdAtom) === documentId) {
            ctx.set(currentDocumentIdAtom, null);
          }
        })
      ),

      Effect.tapError((error) =>
        Effect.sync(() => {
          const message =
            error instanceof Error ? error.message : String(error);
          ctx.set(documentsErrorAtom, message);
        })
      ),

      Effect.ensuring(
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, false);
        })
      ),

      Effect.withSpan('documentOps.purge', { attributes: { documentId } })
    )
  ),

  /**
   * Load document list.
   *
   * Now that documentListAtom is derived, this operation loads the full
   * metadata into documentsAtom. The list atom auto-updates from that.
   *
   * Errors: DocumentRegistryError
   */
  loadList: documentRuntimeAtom.fn<void>()((_, ctx) =>
    pipe(
      Effect.sync(() => {
        ctx.set(documentsLoadingAtom, true);
        ctx.set(documentsErrorAtom, null);
      }),

      Effect.flatMap(() => DocumentRegistryService),
      Effect.flatMap((registry) => registry.list()),

      // Convert list items to full metadata and update documentsAtom
      // documentListAtom will auto-derive from this
      Effect.tap((items) =>
        Effect.sync(() => {
          const documentsMap = new Map<DocumentId, DocumentMetadata>();
          for (const item of items) {
            // DocumentListItem has same structure as DocumentMetadata
            documentsMap.set(item.id, item as DocumentMetadata);
          }
          ctx.set(documentsAtom, documentsMap);
        })
      ),

      Effect.tapError((error) =>
        Effect.sync(() => {
          const message =
            error instanceof Error ? error.message : String(error);
          ctx.set(documentsErrorAtom, message);
        })
      ),

      Effect.ensuring(
        Effect.sync(() => {
          ctx.set(documentsLoadingAtom, false);
        })
      ),

      Effect.withSpan('documentOps.loadList')
    )
  ),

  /**
   * Set current document (without loading from server).
   * Uses registry.set for direct mutation.
   */
  setCurrent: (documentId: DocumentId | null, registry: Registry.Registry) => {
    registry.set(currentDocumentIdAtom, documentId);
  },

  /**
   * Clear error state.
   */
  clearError: (registry: Registry.Registry) => {
    registry.set(documentsErrorAtom, null);
  },
};

// =============================================================================
// Queries (Read-only operations)
// =============================================================================

export const documentQueries = {
  /**
   * Get client token for connecting to y-sweet.
   *
   * Errors: DocumentNotFoundError | DocumentRegistryError
   */
  getClientToken: documentRuntimeAtom.fn<DocumentId>()((documentId, _ctx) =>
    pipe(
      DocumentRegistryService,
      Effect.flatMap((registry) => registry.getClientToken(documentId)),
      Effect.withSpan('documentQueries.getClientToken', {
        attributes: { documentId },
      })
    )
  ),
};

// =============================================================================
// Registry-Bound Operations Factory
// =============================================================================

/**
 * Create document operations bound to a specific registry.
 *
 * This solves the registry mismatch problem where:
 * - documentRuntimeAtom.fn() uses its internal registry
 * - React components read from a different registry (e.g., panelRegistry)
 *
 * By accepting the registry as a parameter, operations update atoms in the
 * same registry that React is subscribed to.
 *
 * All operations return Promises (internally run Effects via ManagedRuntime).
 *
 * @param registry - The registry to use for atom mutations (e.g., panelRegistry)
 * @returns Document operations bound to that registry
 */
export function makeDocumentOps(registry: Registry.Registry) {
  // Create a managed runtime for running Effects
  const runtime = ManagedRuntime.make(DocumentServicesLayer);

  return {
    /**
     * Create a new document.
     */
    create: (payload: CreateDocumentPayload, createdBy: IdentityId) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;
          const result = yield* svc.create(payload, createdBy);

          // Update local state
          const current = registry.get(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.set(result.metadata.id, result.metadata);
          registry.set(documentsAtom, updated);
          registry.set(currentDocumentIdAtom, result.metadata.id);

          yield* Effect.log(
            `[documentOps.create] Success: ${result.metadata.id}`
          );
          return result;
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.create', {
            attributes: { title: payload.title, createdBy },
          })
        )
      ),

    /**
     * Load a document by ID.
     */
    load: (documentId: DocumentId) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;
          const metadata = yield* svc.get(documentId);

          // Update local state
          const current = registry.get(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.set(metadata.id, metadata);
          registry.set(documentsAtom, updated);
          registry.set(currentDocumentIdAtom, metadata.id);

          return metadata;
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.load', { attributes: { documentId } })
        )
      ),

    /**
     * Update document metadata.
     */
    update: (
      documentId: DocumentId,
      payload: UpdateDocumentPayload,
      updatedBy: IdentityId
    ) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const currentDocs = registry.get(documentsAtom);
          const current = currentDocs.get(documentId);

          if (!current) {
            return yield* Effect.fail(
              new DocumentNotLoadedError({ documentId })
            );
          }

          const svc = yield* DocumentRegistryService;
          const metadata = yield* svc.update(
            documentId,
            payload,
            updatedBy,
            current.version
          );

          // Update local state
          const updated = new Map<DocumentId, DocumentMetadata>(currentDocs);
          updated.set(metadata.id, metadata);
          registry.set(documentsAtom, updated);

          return metadata;
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.update', { attributes: { documentId } })
        )
      ),

    /**
     * Soft delete a document (sets status to 'deleted').
     */
    delete: (documentId: DocumentId, deletedBy: IdentityId) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;
          yield* svc.delete(documentId, deletedBy);

          // Remove from local state
          const current = registry.get(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.delete(documentId);
          registry.set(documentsAtom, updated);

          // Clear current if deleted
          if (registry.get(currentDocumentIdAtom) === documentId) {
            registry.set(currentDocumentIdAtom, null);
          }

          yield* Effect.log(`[documentOps.delete] Soft deleted: ${documentId}`);
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.delete', { attributes: { documentId } })
        )
      ),

    /**
     * Hard delete a document (purges from NATS KV permanently).
     */
    purge: (documentId: DocumentId) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;
          yield* svc.purge(documentId);

          // Remove from local state
          const current = registry.get(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          updated.delete(documentId);
          registry.set(documentsAtom, updated);

          // Clear current if deleted
          if (registry.get(currentDocumentIdAtom) === documentId) {
            registry.set(currentDocumentIdAtom, null);
          }

          yield* Effect.log(`[documentOps.purge] Purged: ${documentId}`);
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.purge', { attributes: { documentId } })
        )
      ),

    /**
     * Hard delete multiple documents (batch).
     * Uses Effect.partition to collect successes and failures.
     *
     * NOTE: Effect.partition collects failures in the result tuple, not the error channel.
     * Individual purge errors are returned in the `failures` array.
     */
    purgeMany: (documentIds: readonly DocumentId[]) =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;

          // Partition: collect both successes and failures
          // Failures are collected in the result, not thrown
          const [failures, successes] = yield* Effect.partition(
            documentIds,
            (documentId) =>
              svc.purge(documentId).pipe(
                Effect.as(documentId),
                Effect.withSpan('documentOps.purgeMany.item', {
                  attributes: { documentId },
                })
              ),
            { concurrency: 'unbounded' }
          );

          // Remove successful deletes from local state
          const current = registry.get(documentsAtom);
          const updated = new Map<DocumentId, DocumentMetadata>(current);
          for (const id of successes) {
            updated.delete(id);
          }
          registry.set(documentsAtom, updated);

          // Clear current if it was deleted
          const currentDocId = registry.get(currentDocumentIdAtom);
          if (currentDocId && successes.includes(currentDocId)) {
            registry.set(currentDocumentIdAtom, null);
          }

          // Set error message if any failures occurred
          if (failures.length > 0) {
            registry.set(
              documentsErrorAtom,
              `Failed to purge ${failures.length} document(s)`
            );
          }

          yield* Effect.log(
            `[documentOps.purgeMany] ${successes.length} purged, ${failures.length} failed`
          );

          return {
            successes,
            failures: failures.map((f) => ({
              id: f as unknown as DocumentId,
              error: String(f),
            })),
          };
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.purgeMany', {
            attributes: { count: documentIds.length },
          })
        )
      ),

    /**
     * Load document list.
     */
    loadList: () =>
      runtime.runPromise(
        Effect.gen(function* () {
          registry.set(documentsLoadingAtom, true);
          registry.set(documentsErrorAtom, null);

          const svc = yield* DocumentRegistryService;
          const items = yield* svc.list();

          // Update documentsAtom — documentListAtom auto-derives
          const documentsMap = new Map<DocumentId, DocumentMetadata>();
          for (const item of items) {
            documentsMap.set(item.id, item as DocumentMetadata);
          }
          registry.set(documentsAtom, documentsMap);

          return items;
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const message =
                error instanceof Error ? error.message : String(error);
              registry.set(documentsErrorAtom, message);
            })
          ),
          Effect.ensuring(
            Effect.sync(() => registry.set(documentsLoadingAtom, false))
          ),
          Effect.withSpan('documentOps.loadList')
        )
      ),

    /**
     * Get client token for connecting to y-sweet.
     */
    getClientToken: (documentId: DocumentId) =>
      runtime.runPromise(
        Effect.gen(function* () {
          const svc = yield* DocumentRegistryService;
          return yield* svc.getClientToken(documentId);
        }).pipe(
          Effect.withSpan('documentOps.getClientToken', {
            attributes: { documentId },
          })
        )
      ),

    /**
     * Set current document (local state only).
     */
    setCurrent: (documentId: DocumentId | null) => {
      registry.set(currentDocumentIdAtom, documentId);
    },

    /**
     * Clear error state.
     */
    clearError: () => {
      registry.set(documentsErrorAtom, null);
    },
  };
}

// =============================================================================
// Watch Subscription (Reactive Updates via Stream Atom)
// =============================================================================

import type { KvWatchEvent } from '../../../nats';

/**
 * Document watch event — emitted when a document changes in NATS KV.
 */
export type DocumentWatchEvent = KvWatchEvent<DocumentMetadata>;

/**
 * Atom that subscribes to document changes from NATS KV.
 *
 * Uses Atom.make(Stream) pattern — the stream auto-subscribes when the atom
 * is read, and auto-unsubscribes when no longer observed.
 *
 * Each emitted event contains:
 * - operation: 'PUT' | 'DEL' | 'PURGE'
 * - key: DocumentId
 * - value: DocumentMetadata | null
 *
 * Components should use useDocumentWatch() hook to:
 * 1. Subscribe to this atom
 * 2. Apply events to documentsAtom
 */
export const documentWatchAtom = documentRuntimeAtom.atom(
  Effect.gen(function* () {
    const svc = yield* DocumentRegistryService;
    return svc.watch('>'); // Watch all document keys
  })
);
