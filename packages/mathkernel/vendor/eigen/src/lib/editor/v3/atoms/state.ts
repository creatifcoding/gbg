/**
 * Editor v3 State Atoms
 *
 * Pure state atoms with no circular dependencies.
 * Runtime imports from here, index re-exports both.
 *
 * @module editor/v3/atoms/state
 */

import { Atom } from '@effect-atom/atom';
import type { Editor, JSONContent } from '@tiptap/core';
import type {
  EditorStatus,
  SelectionState,
  MarkType,
  ConnectionStatus,
  AIStatus,
  DocumentMeta,
} from '../types';

// =============================================================================
// Coarse State Atoms (Service-Owned)
// =============================================================================

/**
 * Tiptap Editor instance reference.
 * Null until editor is initialized.
 */
export const editorInstanceAtom = Atom.make<Editor | null>(null);

/**
 * Editor lifecycle status.
 */
export const editorStatusAtom = Atom.make<EditorStatus>('initializing');

/**
 * Document content as Tiptap JSON.
 * Updated on every transaction where doc changes.
 */
export const documentContentAtom = Atom.make<JSONContent | null>(null);

/**
 * Collaboration connection status.
 */
export const connectionStatusAtom = Atom.make<ConnectionStatus>('disconnected');

// =============================================================================
// Fine-Grained Derived Atoms (Computed)
// =============================================================================

/**
 * Current selection state.
 * Derived from editor on transaction.
 */
export const selectionAtom = Atom.make<SelectionState | null>(null);

/**
 * Active formatting marks at cursor position.
 * Derived from editor.isActive() checks.
 */
export const activeMarksAtom = Atom.make<ReadonlySet<MarkType>>(
  new Set<MarkType>()
);

/**
 * Whether undo is available.
 */
export const canUndoAtom = Atom.make<boolean>(false);

/**
 * Whether redo is available.
 */
export const canRedoAtom = Atom.make<boolean>(false);

/**
 * Document is modified since last save.
 */
export const isDirtyAtom = Atom.make<boolean>(false);

/**
 * Word count derived from document content.
 */
export const wordCountAtom = Atom.make((get) => {
  const content = get(documentContentAtom);
  if (!content) return 0;

  // Extract text from JSON content recursively
  const extractText = (node: JSONContent): string => {
    if (node.type === 'text' && node.text) return node.text;
    if (node.content) return node.content.map(extractText).join(' ');
    return '';
  };

  const text = extractText(content);
  return text.split(/\s+/).filter(Boolean).length;
});

/**
 * Character count derived from document content.
 */
export const characterCountAtom = Atom.make((get) => {
  const content = get(documentContentAtom);
  if (!content) return 0;

  const extractText = (node: JSONContent): string => {
    if (node.type === 'text' && node.text) return node.text;
    if (node.content) return node.content.map(extractText).join('');
    return '';
  };

  return extractText(content).length;
});

/**
 * Whether text is currently selected (non-empty selection).
 */
export const hasSelectionAtom = Atom.make((get) => {
  const selection = get(selectionAtom);
  return selection !== null && !selection.empty;
});

/**
 * Editor is ready for interaction.
 */
export const isReadyAtom = Atom.make((get) => {
  const status = get(editorStatusAtom);
  const editor = get(editorInstanceAtom);
  return status === 'ready' && editor !== null;
});

/**
 * Editor view is mounted and ready for DOM operations.
 * More strict than isReadyAtom — checks that view.dom exists.
 * Use this before calling view.nodeDOM(), view.coordsAtPos(), etc.
 */
export const isViewMountedAtom = Atom.make((get) => {
  const editor = get(editorInstanceAtom);
  return editor !== null && editor.view?.dom !== null && editor.view?.dom !== undefined;
});

// =============================================================================
// AI Feature Atoms
// =============================================================================

/**
 * AI operation status.
 */
export const aiStatusAtom = Atom.make<AIStatus>('idle');

/**
 * Current AI suggestion text (streaming or complete).
 */
export const aiSuggestionAtom = Atom.make<string>('');

// =============================================================================
// Document Metadata
// =============================================================================

/**
 * Current document metadata.
 */
export const documentMetaAtom = Atom.make<DocumentMeta | null>(null);

// =============================================================================
// Transaction Counter (Debug)
// =============================================================================

/**
 * Total transaction count since editor mount.
 * Useful for debugging and performance monitoring.
 */
export const transactionCountAtom = Atom.make<number>(0);
