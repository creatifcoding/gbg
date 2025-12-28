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
  // File document atoms (local files ↔ editor)
  fileDocumentsAtom,
  currentFilePathAtom,
  fileDocumentsLoadingAtom,
  fileDocumentsErrorAtom,
  fileContentCacheAtom,
  dirtyFilesAtom,
  conflictFilesAtom,
  currentConflictAtom,
  conflictResolvingAtom,
  hasActiveConflictAtom,
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
  markdownRuntimeAtom,
  markdownOps,
  makeFileDocumentOps,
  // Save state atoms
  saveStateAtom,
  saveErrorAtom,
  lastSavedAtAtom,
  lastSaveResultAtom,
  isSavingAtom,
  isSavedAtom,
  isSaveErrorAtom,
  canSaveAtom,
  // Viewport atoms (zoom & scroll)
  zoomLevelAtom,
  zoomScaleAtom,
  canZoomInAtom,
  canZoomOutAtom,
  zoomLabelAtom,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  scrollPositionAtom,
  activeHeadingIdAtom,
  // Operation factories (pass registry to create bound ops)
  createZoomOps,
  createScrollOps,
} from './atoms';

// =============================================================================
// Extensions
// =============================================================================

export {
  EffectBridge,
  CollaborationBridge,
  collaborationStyles,
  CodeBlockHighlight,
  lowlight,
  DEFAULT_CODE_LANGUAGE,
  codeBlockHighlightStyles,
  // Block Extensions
  allBlockExtensions,
  coreExtensions,
  basicBlockExtensions,
  taskListExtensions,
  mediaExtensions,
  customBlockExtensions,
  // Individual blocks
  Document,
  Text,
  Paragraph,
  Heading,
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  TaskItem,
  Blockquote,
  HorizontalRule,
  Image,
  HardBreak,
  DataGridTable,
  Callout,
  // SlashCommand extension
  SlashCommand,
  SLASH_ITEMS,
} from './extensions';
export type {
  EffectBridgeOptions,
  CollaborationBridgeOptions,
  // Block types
  TableData,
  DataGridTableOptions,
  CalloutVariant,
  CalloutOptions,
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
  // Markdown Service (markdown ↔ ProseMirror)
  MarkdownService,
  MarkdownServiceLive,
  MarkdownServiceCustom,
  MarkdownConfigTag,
  MarkdownParseError,
  MarkdownSerializeError,
  // File Document Mapping (local file ↔ document ID)
  FileDocumentMappingService,
  FileDocumentMappingServiceLive,
  FileMappingError,
  FileMappingNotFoundError,
  // File Document Service (load/save/conflict)
  FileDocumentService,
  FileDocumentServiceLive,
  FileDocumentError,
  FileNotFoundError,
  FileConflictError,
} from './services';

// File mapping types (re-export from service)
export {
  FilePath,
  FileSyncStatus,
  FileMapping,
  FileMappingPayload,
} from './services/FileDocumentMappingService';
export type {
  EditorServiceShape,
  // Collaboration types
  CollaborationServiceShape,
  CollaborationConfig,
  ConnectionStatus as CollaborationStatus,
  CollaborationUser,
  // Document registry types
  DocumentRegistryServiceShape,
  // Markdown types
  MarkdownServiceShape,
  MarkdownConfig,
  // File document types
  FileDocumentServiceShape,
  FileLoadResult,
  FileSaveResult,
  FileProgressInfo,
  FileConflict,
  ConflictResolution,
} from './services';

// =============================================================================
// Theme
// =============================================================================

export {
  colors,
  typography,
  spacing,
  borderRadius,
  editorTheme,
  generateCSSVariables,
  type EditorTheme,
  type ColorTokens,
  type TypographyTokens,
} from './theme';

// =============================================================================
// Components
// =============================================================================

export {
  TiptapEditor,
  CollaborativeTiptapEditor,
  FileDrawer,
  FileConflictDialog,
  TableOfContents,
  useTableOfContents,
  ZoomControls,
  // Formatting Toolbar (Compound Component)
  FormattingToolbar,
  DefaultFormattingToolbar,
  // Block Editor Components
  SlashMenu,
  DefaultSlashMenu,
  createSlashMenuRender,
  SLASH_ICONS,
  BlockHandle,
  DefaultBlockHandle,
  blockHandleStyles,
  // Styles
  editorContentStyles,
  collaborativeEditorStyles,
  tableOfContentsStyles,
  editorHeaderStyles,
  allEditorStyles,
  editorCSSVariables,
} from './components';
export type {
  TiptapEditorHandle,
  TiptapEditorProps,
  CollaborativeTiptapEditorHandle,
  CollaborativeTiptapEditorProps,
  FileDrawerProps,
  FileConflictDialogProps,
  LocalFileEntry,
  UnifiedFileEntry,
  // Y.Doc seeding callback info
  YDocReadyInfo,
  // TableOfContents types
  TableOfContentsProps,
  HeadingItem,
  UseTableOfContentsOptions,
  UseTableOfContentsResult,
  // Zoom controls
  ZoomControlsProps,
  // SlashMenu types
  SlashMenuRootProps,
  SlashMenuContentProps,
  DefaultSlashMenuHandle,
  // BlockHandle types
  BlockHandleRootProps,
  BlockHandleMenuItemProps,
  DefaultBlockHandleProps,
} from './components';

// =============================================================================
// Viewport (Zoom, Scroll, Motion Blur)
// =============================================================================

export {
  // Primary viewport hook (transform: scale zoom + hotkeys + motion blur)
  useEditorViewport,
  // Scoped hotkeys for editor panels
  useEditorScopedHotkeys,
  // Components
  ZoomIndicator,
  // Constants
  DEFAULT_EDITOR_HOTKEYS,
  DEFAULT_VIEWPORT_CONFIG,
  INITIAL_VIEWPORT_STATE,
} from './viewport';
export type {
  UseEditorViewportOptions,
  UseEditorViewportResult,
  // Scoped hotkeys types
  EditorHotkeyBinding,
  UseEditorScopedHotkeysOptions,
  UseEditorScopedHotkeysResult,
  ZoomIndicatorProps,
  ZoomConfig,
  ZoomState,
  ScrollDirection,
  ScrollState,
  MotionBlurConfig,
  EditorHotkeyAction,
  ViewportState,
  ViewportConfig,
} from './viewport';

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

export { useSaveFile } from './hooks/useSaveFile';
export type {
  SaveState,
  SaveError,
  UseSaveFileResult,
  UseSaveFileOptions,
  MorphingSaveButtonProps,
} from './hooks/useSaveFile';

export {
  MorphingSaveButton,
  CompactSaveButton,
  SaveButtonWithHint,
} from './components/MorphingSaveButton';
export type {
  MorphingSaveButtonFullProps,
  CompactSaveButtonProps,
  SaveButtonWithHintProps,
} from './components/MorphingSaveButton';

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
