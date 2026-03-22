/**
 * useDocuments Hook
 *
 * React hooks for document persistence layer.
 * Provides access to document state atoms and operations.
 *
 * MIGRATION NOTE: Operations now handle Result<A, E> internally and unwrap.
 * Errors are thrown to maintain compatibility with try/catch patterns.
 * Future: Expose Result types directly for better error handling.
 *
 * @module editor/v3/hooks/useDocuments
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useAtomValue, useAtomSet, Result } from '@effect-atom/atom-react';
import { Exit, Stream, Effect, Fiber } from 'effect';
import type { ClientToken } from '@y-sweet/sdk';

import {
  // State atoms
  documentsAtom,
  currentDocumentIdAtom,
  documentsLoadingAtom,
  documentsErrorAtom,
  documentListAtom,
  // Derived atoms
  currentDocumentAtom,
  documentCountAtom,
  hasCurrentDocumentAtom,
  // Operations
  documentOps,
  documentQueries,
} from '../atoms/documents';

import type {
  DocumentId,
  IdentityId,
  DocumentMetadata,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentListItem,
} from '../schemas/document';

// =============================================================================
// Types
// =============================================================================

export interface UseDocumentsResult {
  /** Map of all loaded documents */
  documents: ReadonlyMap<DocumentId, DocumentMetadata>;

  /** List of documents for picker/browser */
  documentList: readonly DocumentListItem[];

  /** Total count of loaded documents */
  documentCount: number;

  /** Whether documents are loading */
  isLoading: boolean;

  /** Current error message, if any */
  error: string | null;

  /** Load document list from server */
  loadList: () => Promise<readonly DocumentListItem[]>;

  /** Clear error state */
  clearError: () => void;
}

export interface UseCurrentDocumentResult {
  /** Currently selected document metadata */
  document: DocumentMetadata | null;

  /** Currently selected document ID */
  documentId: DocumentId | null;

  /** Whether a document is currently selected */
  hasDocument: boolean;

  /** Select a document by ID (local state only) */
  setCurrentDocument: (documentId: DocumentId | null) => void;
}

export interface UseDocumentOpsResult {
  /** Create a new document */
  create: (
    payload: CreateDocumentPayload,
    createdBy: IdentityId
  ) => Promise<{ metadata: DocumentMetadata; clientToken: ClientToken }>;

  /** Load a document by ID */
  load: (documentId: DocumentId) => Promise<DocumentMetadata>;

  /** Update document metadata */
  update: (
    documentId: DocumentId,
    payload: UpdateDocumentPayload,
    updatedBy: IdentityId
  ) => Promise<DocumentMetadata>;

  /** Soft delete a document */
  delete: (documentId: DocumentId, deletedBy: IdentityId) => Promise<void>;

  /** Get y-sweet client token for a document */
  getClientToken: (documentId: DocumentId) => Promise<ClientToken>;

  /** Whether an operation is in progress */
  isLoading: boolean;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook for document list and collection state.
 *
 * @example
 * ```tsx
 * function DocumentList() {
 *   const { documentList, isLoading, loadList } = useDocuments()
 *
 *   useEffect(() => { loadList() }, [])
 *
 *   if (isLoading) return <div>Loading...</div>
 *
 *   return (
 *     <ul>
 *       {documentList.map(doc => (
 *         <li key={doc.id}>{doc.title}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useDocuments(): UseDocumentsResult {
  const documents = useAtomValue(documentsAtom);
  const documentList = useAtomValue(documentListAtom);
  const documentCount = useAtomValue(documentCountAtom);
  const isLoading = useAtomValue(documentsLoadingAtom);
  const error = useAtomValue(documentsErrorAtom);

  const loadListOp = useAtomSet(documentOps.loadList, { mode: 'promiseExit' });

  const loadList = useCallback(async () => {
    const exit = await loadListOp(undefined);

    if (Exit.isSuccess(exit)) {
      // loadList returns void - it updates documentsAtom as a side effect
      // The derived documentListAtom provides the data
      return documentList;
    } else {
      throw exit.cause;
    }
  }, [loadListOp, documentList]);

  const clearError = useCallback(() => {
    // This needs direct registry access - we'll wire this up in the provider
    console.warn('[useDocuments] clearError not yet wired');
  }, []);

  return useMemo(
    () => ({
      documents,
      documentList,
      documentCount,
      isLoading,
      error,
      loadList,
      clearError,
    }),
    [
      documents,
      documentList,
      documentCount,
      isLoading,
      error,
      loadList,
      clearError,
    ]
  );
}

/**
 * Hook for current document state.
 *
 * @example
 * ```tsx
 * function DocumentHeader() {
 *   const { document, hasDocument, setCurrentDocument } = useCurrentDocument()
 *
 *   if (!hasDocument) return <div>No document selected</div>
 *
 *   return <h1>{document.title}</h1>
 * }
 * ```
 */
export function useCurrentDocument(): UseCurrentDocumentResult {
  const document = useAtomValue(currentDocumentAtom);
  const documentId = useAtomValue(currentDocumentIdAtom);
  const hasDocument = useAtomValue(hasCurrentDocumentAtom);

  // For setCurrentDocument, we need a writable atom or registry access
  // The documentOps.setCurrent expects a registry, but we can use useAtomSet on the raw atom
  const setCurrentId = useAtomSet(currentDocumentIdAtom);

  const setCurrentDocument = useCallback(
    (id: DocumentId | null) => {
      setCurrentId(id);
    },
    [setCurrentId]
  );

  return useMemo(
    () => ({
      document,
      documentId,
      hasDocument,
      setCurrentDocument,
    }),
    [document, documentId, hasDocument, setCurrentDocument]
  );
}

/**
 * Hook for document CRUD operations.
 *
 * @example
 * ```tsx
 * function CreateDocumentButton() {
 *   const { create, isLoading } = useDocumentOps()
 *
 *   const handleCreate = async () => {
 *     const { metadata, clientToken } = await create(
 *       { title: 'New Document' },
 *       'user-123' as IdentityId
 *     )
 *     console.log('Created:', metadata.id)
 *   }
 *
 *   return (
 *     <button onClick={handleCreate} disabled={isLoading}>
 *       Create Document
 *     </button>
 *   )
 * }
 * ```
 */
export function useDocumentOps(): UseDocumentOpsResult {
  const isLoading = useAtomValue(documentsLoadingAtom);

  // Use mode: 'promiseExit' to get typed Exit<A, E> instead of unwrapped promises
  const createOp = useAtomSet(documentOps.create, { mode: 'promiseExit' });
  const loadOp = useAtomSet(documentOps.load, { mode: 'promiseExit' });
  const updateOp = useAtomSet(documentOps.update, { mode: 'promiseExit' });
  const deleteOp = useAtomSet(documentOps.delete, { mode: 'promiseExit' });
  const getClientTokenOp = useAtomSet(documentQueries.getClientToken, {
    mode: 'promiseExit',
  });

  const create = useCallback(
    async (payload: CreateDocumentPayload, createdBy: IdentityId) => {
      const exit = await createOp({ payload, createdBy });

      if (Exit.isSuccess(exit)) {
        return exit.value;
      } else {
        throw exit.cause;
      }
    },
    [createOp]
  );

  const load = useCallback(
    async (documentId: DocumentId) => {
      const exit = await loadOp(documentId);

      if (Exit.isSuccess(exit)) {
        return exit.value;
      } else {
        throw exit.cause;
      }
    },
    [loadOp]
  );

  const update = useCallback(
    async (
      documentId: DocumentId,
      payload: UpdateDocumentPayload,
      updatedBy: IdentityId
    ) => {
      const exit = await updateOp({
        documentId,
        payload,
        updatedBy,
      });

      if (Exit.isSuccess(exit)) {
        return exit.value;
      } else {
        throw exit.cause;
      }
    },
    [updateOp]
  );

  const del = useCallback(
    async (documentId: DocumentId, deletedBy: IdentityId) => {
      const exit = await deleteOp({ documentId, deletedBy });

      if (Exit.isSuccess(exit)) {
        return;
      } else {
        throw exit.cause;
      }
    },
    [deleteOp]
  );

  const getClientToken = useCallback(
    async (documentId: DocumentId) => {
      const exit = await getClientTokenOp(documentId);

      if (Exit.isSuccess(exit)) {
        return exit.value;
      } else {
        throw exit.cause;
      }
    },
    [getClientTokenOp]
  );

  return useMemo(
    () => ({
      create,
      load,
      update,
      delete: del,
      getClientToken,
      isLoading,
    }),
    [create, load, update, del, getClientToken, isLoading]
  );
}

/**
 * Combined hook for full document functionality.
 *
 * @example
 * ```tsx
 * function DocumentEditor() {
 *   const {
 *     currentDocument,
 *     documentList,
 *     isLoading,
 *     create,
 *     load,
 *     setCurrentDocument,
 *   } = useDocumentManager()
 *
 *   // ... use all document features
 * }
 * ```
 */
export function useDocumentManager() {
  const documents = useDocuments();
  const current = useCurrentDocument();
  const ops = useDocumentOps();

  return useMemo(
    () => ({
      // From useDocuments
      documents: documents.documents,
      documentList: documents.documentList,
      documentCount: documents.documentCount,
      loadList: documents.loadList,
      clearError: documents.clearError,

      // From useCurrentDocument
      currentDocument: current.document,
      currentDocumentId: current.documentId,
      hasCurrentDocument: current.hasDocument,
      setCurrentDocument: current.setCurrentDocument,

      // From useDocumentOps
      create: ops.create,
      load: ops.load,
      update: ops.update,
      delete: ops.delete,
      getClientToken: ops.getClientToken,

      // Combined loading state
      isLoading: documents.isLoading || ops.isLoading,
      error: documents.error,
    }),
    [documents, current, ops]
  );
}

// =============================================================================
// Registry-Bound Hooks (for PanelRegistryProvider contexts)
// =============================================================================

import type { Registry } from '@effect-atom/atom';
import { makeDocumentOps } from '../atoms/documents';

/**
 * Hook that returns document operations bound to a specific registry.
 *
 * USE THIS when your component tree is wrapped in a custom RegistryProvider
 * (like PanelRegistryProvider) and you need mutations to update atoms in
 * that registry, not the internal runtime registry.
 *
 * @param registry - The registry to bind operations to (e.g., panelRegistry)
 *
 * @example
 * ```tsx
 * import { panelRegistry } from './panel-stx';
 *
 * function DocumentList() {
 *   const { delete: deleteDoc, loadList } = useDocumentOpsWithRegistry(panelRegistry);
 *
 *   const handleDelete = async (id: string) => {
 *     await deleteDoc(id as DocumentId, userId as IdentityId);
 *     // Documents atom is updated in panelRegistry
 *     // Components subscribed via useAtomValue will re-render
 *   };
 * }
 * ```
 */
export function useDocumentOpsWithRegistry(registry: Registry.Registry) {
  const isLoading = useAtomValue(documentsLoadingAtom);

  // Create bound ops - memoized to prevent recreation on every render
  const ops = useMemo(() => makeDocumentOps(registry), [registry]);

  const create = useCallback(
    async (payload: CreateDocumentPayload, createdBy: IdentityId) => {
      return ops.create(payload, createdBy);
    },
    [ops]
  );

  const load = useCallback(
    async (documentId: DocumentId) => {
      return ops.load(documentId);
    },
    [ops]
  );

  const update = useCallback(
    async (
      documentId: DocumentId,
      payload: UpdateDocumentPayload,
      updatedBy: IdentityId
    ) => {
      return ops.update(documentId, payload, updatedBy);
    },
    [ops]
  );

  const del = useCallback(
    async (documentId: DocumentId, deletedBy: IdentityId) => {
      return ops.delete(documentId, deletedBy);
    },
    [ops]
  );

  const purge = useCallback(
    async (documentId: DocumentId) => {
      return ops.purge(documentId);
    },
    [ops]
  );

  const getClientToken = useCallback(
    async (documentId: DocumentId) => {
      return ops.getClientToken(documentId);
    },
    [ops]
  );

  const loadList = useCallback(async () => {
    return ops.loadList();
  }, [ops]);

  const setCurrent = useCallback(
    (documentId: DocumentId | null) => {
      ops.setCurrent(documentId);
    },
    [ops]
  );

  const clearError = useCallback(() => {
    ops.clearError();
  }, [ops]);

  return useMemo(
    () => ({
      create,
      load,
      update,
      delete: del,
      purge,
      getClientToken,
      loadList,
      setCurrent,
      clearError,
      isLoading,
    }),
    [
      create,
      load,
      update,
      del,
      purge,
      getClientToken,
      loadList,
      setCurrent,
      clearError,
      isLoading,
    ]
  );
}

// =============================================================================
// Adapter Types (for DocumentDrawer compatibility)
// =============================================================================

/**
 * RecentDoc format expected by DocumentDrawer component.
 * This is the legacy format from panel-stx.ts localStorage.
 */
export interface RecentDoc {
  docId: string;
  petName: string;
  lastAccessed: number;
}

/**
 * Convert DocumentListItem to RecentDoc format for DocumentDrawer.
 * Uses title as petName, updatedAt as lastAccessed.
 */
export function documentListItemToRecentDoc(item: DocumentListItem): RecentDoc {
  return {
    docId: item.id as string,
    petName: item.title,
    lastAccessed: item.updatedAt.getTime(),
  };
}

/**
 * Convert array of DocumentListItem to RecentDoc format.
 */
export function documentListToRecentDocs(
  items: readonly DocumentListItem[]
): readonly RecentDoc[] {
  return items.map(documentListItemToRecentDoc);
}

/**
 * Hook that returns document list in RecentDoc format for DocumentDrawer.
 *
 * @example
 * ```tsx
 * function DocumentPicker() {
 *   const { recentDocs, isLoading, loadList } = useRecentDocs()
 *
 *   return (
 *     <DocumentDrawer
 *       recentDocs={recentDocs}
 *       // ...
 *     />
 *   )
 * }
 * ```
 */
export function useRecentDocs() {
  const { documentList, isLoading, loadList, error } = useDocuments();

  const recentDocs = useMemo(
    () => documentListToRecentDocs(documentList),
    [documentList]
  );

  return {
    recentDocs,
    isLoading,
    loadList,
    error,
  };
}

// =============================================================================
// Watch Subscription Hook
// =============================================================================

import { documentWatchAtom, type DocumentWatchEvent } from '../atoms/documents';

/**
 * Hook that subscribes to document changes from NATS KV and applies them
 * to local state.
 *
 * This enables multi-tab sync and real-time updates from other clients.
 *
 * @param registry - The registry to update (e.g., panelRegistry)
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function DocumentProvider({ children }: { children: ReactNode }) {
 *   const { isWatching, eventCount, lastEvent } = useDocumentWatch(panelRegistry)
 *
 *   return (
 *     <div>
 *       {isWatching && <span>Live sync active ({eventCount} events)</span>}
 *       {children}
 *     </div>
 *   )
 * }
 * ```
 */
export function useDocumentWatch(
  registry: Registry.Registry,
  options: {
    /** Enable debug logging */
    debug?: boolean;
    /** Called when an event is received */
    onEvent?: (event: DocumentWatchEvent) => void;
  } = {}
) {
  const { debug = false, onEvent } = options;

  // Subscribe to the watch atom — this returns a Result<Stream<Event>>
  const watchResult = useAtomValue(documentWatchAtom);

  // Track state
  const eventCountRef = useRef(0);
  const lastEventRef = useRef<DocumentWatchEvent | null>(null);
  const fiberRef = useRef<Fiber.RuntimeFiber<void, unknown> | null>(null);

  // Process the stream when it becomes available
  useEffect(() => {
    if (!Result.isSuccess(watchResult)) {
      return;
    }

    const stream = watchResult.value;

    // Run the stream, applying each event to local state
    const fiber = Effect.runFork(
      Stream.runForEach(stream, (event) =>
        Effect.sync(() => {
          eventCountRef.current += 1;
          lastEventRef.current = event;

          if (debug) {
            console.log(
              '[useDocumentWatch] Event:',
              event.operation,
              event.key
            );
          }

          onEvent?.(event);

          // Apply event to documentsAtom
          const current = registry.get(documentsAtom);
          const updated = new Map(current);

          switch (event.operation) {
            case 'PUT':
              if (event.value) {
                updated.set(event.key as DocumentId, event.value);
              }
              break;
            case 'DEL':
            case 'PURGE':
              updated.delete(event.key as DocumentId);
              // Clear currentDocumentId if it was deleted
              const currentId = registry.get(currentDocumentIdAtom);
              if (currentId === event.key) {
                registry.set(currentDocumentIdAtom, null);
              }
              break;
          }

          registry.set(documentsAtom, updated);
        })
      )
    );

    fiberRef.current = fiber;

    if (debug) {
      console.log('[useDocumentWatch] Stream subscription started');
    }

    // Cleanup: interrupt the fiber on unmount
    return () => {
      if (fiberRef.current) {
        Effect.runFork(Fiber.interrupt(fiberRef.current));
        fiberRef.current = null;

        if (debug) {
          console.log('[useDocumentWatch] Stream subscription stopped');
        }
      }
    };
  }, [watchResult, registry, debug, onEvent]);

  return {
    /** Whether the watch stream is active */
    isWatching: Result.isSuccess(watchResult) && fiberRef.current !== null,

    /** Whether the watch atom is still initializing */
    isInitializing: Result.isInitial(watchResult),

    /** Error if watch failed to start */
    error: Result.isFailure(watchResult) ? watchResult.cause : null,

    /** Number of events received since mount */
    get eventCount() {
      return eventCountRef.current;
    },

    /** Most recent event received */
    get lastEvent() {
      return lastEventRef.current;
    },
  };
}
