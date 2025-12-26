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
 * @module editor/v3
 */

// =============================================================================
// Types
// =============================================================================

export * from './types';

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
} from './services';
export type {
  EditorServiceShape,
  // Collaboration types
  CollaborationServiceShape,
  CollaborationConfig,
  ConnectionStatus as CollaborationStatus,
  CollaborationUser,
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
