/**
 * Editor v3
 *
 * Tiptap-based collaborative editor with Effect integration.
 *
 * Architecture:
 * - Tiptap/ProseMirror for rich text editing
 * - effect-atom for reactive state (Atom-as-State pattern)
 * - Effect.Service for typed operations
 * - y-Sweet for real-time collaboration
 *
 * ## Usage
 *
 * ```typescript
 * // Namespace import (preferred)
 * import { Editor } from '@/lib/editor/v3'
 *
 * const docSvc = yield* Editor.DocumentRegistry
 * const metadata = yield* docSvc.get(documentId)
 *
 * // Or direct imports
 * import { DocumentRegistryService, documentsAtom } from '@/lib/editor/v3'
 * ```
 *
 * @module editor/v3
 */

// =============================================================================
// Types
// =============================================================================

export * from './types';

// =============================================================================
// Schemas (Document Metadata)
// =============================================================================

export {
  // Branded IDs
  DocumentId,
  IdentityId,
  // Enums
  DocumentStatus,
  DocumentVisibility,
  // Core schemas
  DocumentMetadata,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentListItem,
  DocumentListQuery,
  // Event schemas
  DocumentCreatedEvent,
  DocumentUpdatedEvent,
  DocumentDeletedEvent,
  DocumentEvent,
  // Helpers
  generateDocumentId,
  createInitialMetadata,
} from './schemas/document';

// =============================================================================
// Atoms (State)
// =============================================================================

export {
  // Coarse atoms (service-owned)
  editorInstanceAtom,
  editorStatusAtom,
  documentContentAtom,
  connectionStatusAtom,

  // Fine-grained derived atoms
  selectionAtom,
  activeMarksAtom,
  canUndoAtom,
  canRedoAtom,
  isDirtyAtom,
  wordCountAtom,
  characterCountAtom,
  hasSelectionAtom,
  isReadyAtom,

  // AI atoms
  aiStatusAtom,
  aiSuggestionAtom,

  // Metadata
  documentMetaAtom,

  // Debug
  transactionCountAtom,

  // Runtime & Operations
  editorRuntimeAtom,
  editorOps,
  editorQueries,

  // Collaboration atoms
  collaborationStatusAtom,
  collaborationDocIdAtom,
  clientTokenAtom,
  collaborationErrorAtom,
  connectedUsersAtom,
  isCollaboratingAtom,
  connectedUsersCountAtom,
  collaborationRuntimeAtom,
  createCollaborationRuntime,
  collaborationOps,
  // Collaboration registry (for direct mutations outside React)
  collaborationRegistry,
  // Provider (wrap React components for shared registry)
  CollaborationRegistryProvider,
  // Document registry atoms
  recentDocsAtom,
  currentPetNameAtom,
  showDocPickerAtom,
  // Document registry utilities
  generatePetName,
  // Document persistence atoms (NATS KV + y-sweet)
  documentsAtom,
  currentDocumentIdAtom,
  documentsLoadingAtom,
  documentsErrorAtom,
  documentListAtom,
  currentDocumentAtom,
  documentCountAtom,
  hasCurrentDocumentAtom,
  documentRuntimeAtom,
  documentOps,
  documentQueries,
} from './atoms';

// =============================================================================
// Extensions
// =============================================================================

export {
  EffectBridge,
  CollaborationBridge,
  collaborationStyles,
} from './extensions';
export type {
  EffectBridgeOptions,
  CollaborationBridgeOptions,
} from './extensions';

// =============================================================================
// Services
// =============================================================================

export {
  EditorService,
  EditorServiceLive,
  EditorNotReady,
  // Collaboration
  CollaborationService,
  CollaborationServiceLive,
  CollaborationServiceCustom,
  CollaborationConfigTag,
  generateUserColor,
  // Document Registry (NATS KV + y-sweet)
  DocumentRegistryService,
  DocumentRegistryServiceLive,
  DocumentNotFoundError,
  DocumentVersionConflictError,
  DocumentRegistryError,
} from './services';
export type {
  EditorServiceShape,
  // Collaboration types
  CollaborationServiceShape,
  CollaborationConfig,
  ConnectionStatus as CollaborationStatus,
  CollaborationUser,
  // Document registry types
  DocumentRegistryServiceShape,
} from './services';

// =============================================================================
// Components
// =============================================================================

export { TiptapEditor, CollaborativeTiptapEditor } from './components';
export type {
  TiptapEditorHandle,
  TiptapEditorProps,
  CollaborativeTiptapEditorHandle,
  CollaborativeTiptapEditorProps,
} from './components';

// =============================================================================
// Hooks
// =============================================================================

export {
  useDocuments,
  useCurrentDocument,
  useDocumentOps,
  useDocumentManager,
  useDocumentOpsWithRegistry,
  useRecentDocs,
  useDocumentWatch,
  documentListItemToRecentDoc,
  documentListToRecentDocs,
} from './hooks/useDocuments';
export type {
  UseDocumentsResult,
  UseCurrentDocumentResult,
  UseDocumentOpsResult,
  RecentDoc,
} from './hooks/useDocuments';

// =============================================================================
// Namespace Alias
// =============================================================================

import {
  EditorService,
  CollaborationService,
  DocumentRegistryService,
  DocumentNotFoundError,
  DocumentVersionConflictError,
  DocumentRegistryError,
} from './services';

import {
  documentsAtom,
  documentListAtom,
  currentDocumentAtom,
  documentOps,
  documentQueries,
  documentRuntimeAtom,
} from './atoms';

/**
 * Editor namespace for clean imports.
 *
 * @example
 * ```typescript
 * import { Editor } from '@/lib/editor/v3'
 *
 * // Service access
 * const docSvc = yield* Editor.DocumentRegistry
 * const collabSvc = yield* Editor.Collaboration
 *
 * // Atom access
 * const docs = useAtomValue(Editor.Atoms.documents)
 *
 * // Operations
 * const { create, delete: del } = Editor.Ops
 * ```
 */
export const Editor = {
  /** EditorService — Tiptap instance management */
  Service: EditorService,

  /** CollaborationService — y-sweet real-time sync */
  Collaboration: CollaborationService,

  /** DocumentRegistryService — NATS KV document persistence */
  DocumentRegistry: DocumentRegistryService,

  /** Document state atoms */
  Atoms: {
    documents: documentsAtom,
    documentList: documentListAtom,
    currentDocument: currentDocumentAtom,
  },

  /** Document operations (runtime.fn) */
  Ops: documentOps,

  /** Document queries (runtime.fn) */
  Queries: documentQueries,

  /** Runtime atom for custom Effects */
  Runtime: documentRuntimeAtom,

  /** Error types */
  Errors: {
    NotFound: DocumentNotFoundError,
    VersionConflict: DocumentVersionConflictError,
    Registry: DocumentRegistryError,
  },
} as const;

export type EditorNamespace = typeof Editor;
