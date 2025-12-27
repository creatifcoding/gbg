/**
 * Editor v3 Atoms
 *
 * Atom-as-State pattern for Tiptap editor.
 * Service methods mutate atoms directly via Atom.set().
 * React subscribes via useAtomValue().
 *
 * @module editor/v3/atoms
 */

// =============================================================================
// State Atoms (no circular deps)
// =============================================================================

export {
  // Coarse atoms
  editorInstanceAtom,
  editorStatusAtom,
  documentContentAtom,
  connectionStatusAtom,
  // Fine-grained atoms
  selectionAtom,
  activeMarksAtom,
  canUndoAtom,
  canRedoAtom,
  isDirtyAtom,
  // Derived atoms
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
} from './state';

// =============================================================================
// Runtime & Operations
// =============================================================================

export { editorRuntimeAtom, editorOps, editorQueries } from './runtime';

// =============================================================================
// Collaboration Atoms
// =============================================================================

export {
  // State atoms
  collaborationStatusAtom,
  collaborationDocIdAtom,
  clientTokenAtom,
  collaborationErrorAtom,
  connectedUsersAtom,
  // Derived atoms
  isCollaboratingAtom,
  connectedUsersCountAtom,
  // Runtime
  collaborationRuntimeAtom,
  createCollaborationRuntime,
  // Operations
  collaborationOps,
  // Registry (for direct mutations outside React)
  collaborationRegistry,
  // Provider (wrap React components for shared registry)
  CollaborationRegistryProvider,
  // Document registry atoms
  recentDocsAtom,
  currentPetNameAtom,
  showDocPickerAtom,
  // Document registry utilities
  generatePetName,
  // Document registry types
  type RecentDoc,
} from './collaboration';

// =============================================================================
// Document Persistence Atoms (NATS KV + y-sweet)
// =============================================================================

export {
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
  // Runtime
  documentRuntimeAtom,
  // Operations
  documentOps,
  documentQueries,
  // Watch
  documentWatchAtom,
  type DocumentWatchEvent,
} from './documents';
