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
