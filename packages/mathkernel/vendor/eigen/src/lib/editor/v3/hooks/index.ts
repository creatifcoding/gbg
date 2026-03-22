/**
 * Editor V3 Hooks
 *
 * React hooks for document persistence layer.
 *
 * @module editor/v3/hooks
 */

export {
  // Main hooks
  useDocuments,
  useCurrentDocument,
  useDocumentOps,
  useDocumentManager,
  // Registry-bound hooks (for PanelRegistryProvider contexts)
  useDocumentOpsWithRegistry,

  // Types
  type UseDocumentsResult,
  type UseCurrentDocumentResult,
  type UseDocumentOpsResult,
} from './useDocuments';

export {
  // File document hooks
  useFileDocuments,
  useCurrentFile,
  useMarkdownOps,
  useFileDocumentOpsWithRegistry,
  useFileDocumentManager,
  useFileConflict,

  // Types
  type UseFileDocumentsResult,
  type UseCurrentFileResult,
  type UseMarkdownOpsResult,
  type UseFileConflictResult,
} from './useFileDocument';

export {
  // Save functionality
  useSaveFile,

  // Types
  type SaveState,
  type SaveError,
  type UseSaveFileResult,
  type UseSaveFileOptions,
  type MorphingSaveButtonProps,
} from './useSaveFile';
