/**
 * EffectBridge Extension
 *
 * Tiptap extension that bridges ProseMirror state to effect-atom.
 * Syncs document content, selection, marks, and history state to atoms
 * on every transaction.
 *
 * CRITICAL: Must pass `registry` option to sync atoms to the correct registry.
 * Without registry, atoms are not synced.
 *
 * @module editor/v3/extensions/EffectBridge
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Registry } from '@effect-atom/atom';
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
function getActiveMarks(
  editor: ReturnType<typeof Extension.create>['editor']
): ReadonlySet<MarkType> {
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
   * Registry to use for atom operations.
   * REQUIRED: Without this, atoms are not synced.
   */
  registry?: Registry.Registry;

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
      registry: undefined,
      onTransaction: undefined,
      contentDebounce: 0,
    };
  },

  addStorage() {
    return {
      lastContentHash: '',
      contentDebounceTimer: null as ReturnType<typeof setTimeout> | null,
      initialized: false,
      transactionCount: 0,
    };
  },

  onCreate() {
    const registry = this.options.registry;
    if (!registry) {
      console.warn(
        '[EffectBridge] No registry provided. Atoms will not be synced. ' +
          'Pass registry option: EffectBridge.configure({ registry: myRegistry })'
      );
      return;
    }

    // Store editor reference in atom
    console.log('[EffectBridge] Setting editorInstanceAtom to:', this.editor);
    console.log('[EffectBridge] Registry identity:', (registry as any)._id ?? 'unknown');
    registry.set(editorInstanceAtom, this.editor);
    console.log('[EffectBridge] Verify set:', registry.get(editorInstanceAtom));
    registry.set(editorStatusAtom, 'ready');

    // Initial content sync
    registry.set(documentContentAtom, this.editor.getJSON());

    // Initial selection sync
    const { from, to, anchor, head, empty } = this.editor.state.selection;
    registry.set(
      selectionAtom,
      new SelectionState({ from, to, anchor, head, empty })
    );

    // Initial marks sync
    registry.set(activeMarksAtom, getActiveMarks(this.editor));

    // Initial history sync
    registry.set(canUndoAtom, this.editor.can().undo());
    registry.set(canRedoAtom, this.editor.can().redo());

    this.storage.initialized = true;
  },

  onDestroy() {
    const registry = this.options.registry;

    // Clean up debounce timer
    if (this.storage.contentDebounceTimer) {
      clearTimeout(this.storage.contentDebounceTimer);
    }

    if (!registry) return;

    // Clear editor reference
    registry.set(editorInstanceAtom, null);
    registry.set(editorStatusAtom, 'destroyed');
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: effectBridgeKey,

        view: () => ({
          update: (view, prevState) => {
            if (!extension.storage.initialized) return;

            const registry = extension.options.registry;
            if (!registry) return;

            const { state } = view;
            const docChanged = !state.doc.eq(prevState.doc);
            const selectionChanged = !state.selection.eq(prevState.selection);

            // Increment transaction counter (stored in storage, not atom)
            extension.storage.transactionCount += 1;
            const count = extension.storage.transactionCount;
            registry.set(transactionCountAtom, count);

            // Sync selection
            if (selectionChanged) {
              const { from, to, anchor, head, empty } = state.selection;
              registry.set(
                selectionAtom,
                new SelectionState({ from, to, anchor, head, empty })
              );

              // Active marks may change with selection
              registry.set(activeMarksAtom, getActiveMarks(extension.editor));
            }

            // Sync document content
            if (docChanged) {
              registry.set(isDirtyAtom, true);

              const updateContent = () => {
                registry.set(documentContentAtom, extension.editor.getJSON());
              };

              // Debounce if configured
              const debounce = extension.options.contentDebounce ?? 0;
              if (debounce > 0) {
                if (extension.storage.contentDebounceTimer) {
                  clearTimeout(extension.storage.contentDebounceTimer);
                }
                extension.storage.contentDebounceTimer = setTimeout(
                  updateContent,
                  debounce
                );
              } else {
                updateContent();
              }
            }

            // Sync history state
            registry.set(canUndoAtom, extension.editor.can().undo());
            registry.set(canRedoAtom, extension.editor.can().redo());

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
