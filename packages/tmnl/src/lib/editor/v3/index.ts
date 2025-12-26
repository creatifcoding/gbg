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
} from './atoms';

// =============================================================================
// Extensions
// =============================================================================

export { EffectBridge } from './extensions';
export type { EffectBridgeOptions } from './extensions';

// =============================================================================
// Services
// =============================================================================

export {
  EditorService,
  EditorServiceLive,
  EditorNotReady,
} from './services';
export type { EditorServiceShape } from './services';

// =============================================================================
// Components
// =============================================================================

export { TiptapEditor } from './components';
export type { TiptapEditorHandle, TiptapEditorProps } from './components';
