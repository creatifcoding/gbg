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
  isViewMountedAtom,
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

// =============================================================================
// File Document Atoms (Local Files ↔ Editor)
// =============================================================================

export {
  // State atoms
  fileDocumentsAtom,
  currentFilePathAtom,
  fileDocumentsLoadingAtom,
  fileDocumentsErrorAtom,
  fileContentCacheAtom,
  dirtyFilesAtom,
  conflictFilesAtom,
  // Conflict atoms
  currentConflictAtom,
  conflictResolvingAtom,
  hasActiveConflictAtom,
  // Derived atoms
  currentFileMappingAtom,
  currentFileSyncStatusAtom,
  currentFileDocumentIdAtom,
  currentFileContentAtom,
  fileCountAtom,
  hasCurrentFileAtom,
  isCurrentFileDirtyAtom,
  isCurrentFileConflictAtom,
  fileListAtom,
  dirtyFileListAtom,
  // Markdown runtime (no FileAccessService required)
  markdownRuntimeAtom,
  markdownOps,
  // Factory for file operations (requires FileDocumentService layer)
  makeFileDocumentOps,
  // Types
  type FileDocumentOps,
  type FilePath,
  type FileMapping,
  type FileSyncStatus,
  type FileLoadResult,
  type FileSaveResult,
  type FileConflict,
  type ConflictResolution,
  // Save state atoms
  saveStateAtom,
  saveErrorAtom,
  lastSavedAtAtom,
  lastSaveResultAtom,
  isSavingAtom,
  isSavedAtom,
  isSaveErrorAtom,
  canSaveAtom,
  // Errors
  FileNotFoundError,
  FileDocumentError,
  FileNotLoadedError,
} from './fileDocuments';

// =============================================================================
// Viewport Atoms (Zoom & Scroll)
// =============================================================================

export {
  // Zoom atoms
  zoomLevelAtom,
  zoomScaleAtom,
  canZoomInAtom,
  canZoomOutAtom,
  zoomLabelAtom,
  // Zoom constants
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  // Scroll atoms
  scrollPositionAtom,
  activeHeadingIdAtom,
  // Operation factories (pass registry to create bound ops)
  createZoomOps,
  createScrollOps,
} from './viewport';
