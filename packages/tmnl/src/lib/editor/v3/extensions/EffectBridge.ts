/**
 * EffectBridge Extension
 *
 * Tiptap extension that bridges ProseMirror state to effect-atom.
 * Syncs document content, selection, marks, and history state to atoms
 * on every transaction.
 *
 * @module editor/v3/extensions/EffectBridge
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Atom } from '@effect-atom/atom';
import {
  editorInstanceAtom,
  editorStatusAtom,
  documentContentAtom,
  selectionAtom,
  activeMarksAtom,
  canUndoAtom,
  canRedoAtom,
  isDirtyAtom,
  transactionCountAtom,
} from '../atoms';
import { SelectionState, type MarkType } from '../types';

// =============================================================================
// Plugin Key
// =============================================================================

const effectBridgeKey = new PluginKey('effectBridge');

// =============================================================================
// Mark Detection
// =============================================================================

const MARK_CHECKS: readonly MarkType[] = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'highlight',
  'subscript',
  'superscript',
] as const;

/**
 * Get active marks at current selection.
 */
function getActiveMarks(editor: ReturnType<typeof Extension.create>['editor']): ReadonlySet<MarkType> {
  const active = new Set<MarkType>();

  for (const mark of MARK_CHECKS) {
    try {
      if (editor.isActive(mark)) {
        active.add(mark);
      }
    } catch {
      // Mark extension may not be loaded
    }
  }

  return active;
}

// =============================================================================
// Extension Definition
// =============================================================================

export interface EffectBridgeOptions {
  /**
   * Callback invoked on every transaction.
   * Useful for external sync (e.g., auto-save trigger).
   */
  onTransaction?: (meta: {
    docChanged: boolean;
    selectionChanged: boolean;
    transactionCount: number;
  }) => void;

  /**
   * Debounce content atom updates (ms).
   * 0 = immediate (default).
   */
  contentDebounce?: number;
}

export const EffectBridge = Extension.create<EffectBridgeOptions>({
  name: 'effectBridge',

  addOptions() {
    return {
      onTransaction: undefined,
      contentDebounce: 0,
    };
  },

  addStorage() {
    return {
      lastContentHash: '',
      contentDebounceTimer: null as ReturnType<typeof setTimeout> | null,
      initialized: false,
    };
  },

  onCreate() {
    // Store editor reference in atom
    Atom.set(editorInstanceAtom, this.editor);
    Atom.set(editorStatusAtom, 'ready');

    // Initial content sync
    Atom.set(documentContentAtom, this.editor.getJSON());

    // Initial selection sync
    const { from, to, anchor, head, empty } = this.editor.state.selection;
    Atom.set(
      selectionAtom,
      new SelectionState({ from, to, anchor, head, empty })
    );

    // Initial marks sync
    Atom.set(activeMarksAtom, getActiveMarks(this.editor));

    // Initial history sync
    Atom.set(canUndoAtom, this.editor.can().undo());
    Atom.set(canRedoAtom, this.editor.can().redo());

    this.storage.initialized = true;
  },

  onDestroy() {
    // Clean up debounce timer
    if (this.storage.contentDebounceTimer) {
      clearTimeout(this.storage.contentDebounceTimer);
    }

    // Clear editor reference
    Atom.set(editorInstanceAtom, null);
    Atom.set(editorStatusAtom, 'destroyed');
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: effectBridgeKey,

        view: () => ({
          update: (view, prevState) => {
            if (!extension.storage.initialized) return;

            const { state } = view;
            const docChanged = !state.doc.eq(prevState.doc);
            const selectionChanged = !state.selection.eq(prevState.selection);

            // Increment transaction counter
            const count = Atom.get(transactionCountAtom) + 1;
            Atom.set(transactionCountAtom, count);

            // Sync selection
            if (selectionChanged) {
              const { from, to, anchor, head, empty } = state.selection;
              Atom.set(
                selectionAtom,
                new SelectionState({ from, to, anchor, head, empty })
              );

              // Active marks may change with selection
              Atom.set(activeMarksAtom, getActiveMarks(extension.editor));
            }

            // Sync document content
            if (docChanged) {
              Atom.set(isDirtyAtom, true);

              const updateContent = () => {
                Atom.set(documentContentAtom, extension.editor.getJSON());
              };

              // Debounce if configured
              if (extension.options.contentDebounce > 0) {
                if (extension.storage.contentDebounceTimer) {
                  clearTimeout(extension.storage.contentDebounceTimer);
                }
                extension.storage.contentDebounceTimer = setTimeout(
                  updateContent,
                  extension.options.contentDebounce
                );
              } else {
                updateContent();
              }
            }

            // Sync history state
            Atom.set(canUndoAtom, extension.editor.can().undo());
            Atom.set(canRedoAtom, extension.editor.can().redo());

            // Invoke callback
            extension.options.onTransaction?.({
              docChanged,
              selectionChanged,
              transactionCount: count,
            });
          },
        }),
      }),
    ];
  },
});

export default EffectBridge;
