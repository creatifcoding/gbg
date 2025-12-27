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
