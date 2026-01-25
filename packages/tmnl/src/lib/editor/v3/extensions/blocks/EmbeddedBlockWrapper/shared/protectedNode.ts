/**
 * Protected Node Utilities
 *
 * Prevents embedded block nodes from being deleted via keyboard.
 * Nodes can ONLY be deleted via explicit UI (trash button in header).
 *
 * Usage in extension:
 * ```typescript
 * import { protectedNodeKeyboardShortcuts, protectedNodeViewOptions } from './shared/protectedNode';
 *
 * export const MyBlock = Node.create({
 *   // ...
 *   addKeyboardShortcuts() {
 *     return protectedNodeKeyboardShortcuts;
 *   },
 *   addNodeView() {
 *     return ReactNodeViewRenderer(MyBlockView, protectedNodeViewOptions);
 *   },
 * });
 * ```
 *
 * @module editor/v3/extensions/blocks/EmbeddedBlockWrapper/shared
 */

import type { ReactNodeViewRendererOptions } from '@tiptap/react';
import type { KeyboardShortcutCommand } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { ReplaceStep } from '@tiptap/pm/transform';

// =============================================================================
// Keyboard Shortcuts — Block Deletion Prevention
// =============================================================================

/**
 * Creates keyboard shortcuts that prevent node deletion.
 *
 * Must be called with `this` bound to the extension instance.
 * Only blocks Backspace/Delete when:
 * 1. The node is selected as a NodeSelection, OR
 * 2. The cursor is immediately before/after the node (would delete it)
 *
 * Usage in extension:
 * ```typescript
 * addKeyboardShortcuts() {
 *   return createProtectedNodeKeyboardShortcuts.call(this);
 * }
 * ```
 */
export function createProtectedNodeKeyboardShortcuts(
  this: { name: string; editor: { commands: { command: Function } } }
): Record<string, KeyboardShortcutCommand> {
  const nodeName = this.name;

  return {
    Backspace: ({ editor }) => {
      return editor.commands.command(({ state }: { state: { selection: { empty: boolean; anchor: number; node?: { type: { name: string } } }; doc: { nodesBetween: Function } } }) => {
        const { selection } = state;

        // Case 1: NodeSelection — entire node is selected
        if (selection.node?.type.name === nodeName) {
          return true; // Block deletion
        }

        // Case 2: Cursor selection — check if backspace would hit our node
        const { empty, anchor } = selection;
        if (!empty) return false;

        let isOurNode = false;
        state.doc.nodesBetween(anchor - 1, anchor, (node: { type: { name: string } }) => {
          if (node.type.name === nodeName) {
            isOurNode = true;
            return false; // Stop iteration
          }
        });

        return isOurNode; // Block if our node, otherwise let through
      });
    },

    Delete: ({ editor }) => {
      return editor.commands.command(({ state }: { state: { selection: { empty: boolean; anchor: number; node?: { type: { name: string } } }; doc: { nodesBetween: Function; nodeSize: number } } }) => {
        const { selection } = state;

        // Case 1: NodeSelection
        if (selection.node?.type.name === nodeName) {
          return true;
        }

        // Case 2: Cursor selection — check if delete would hit our node
        const { empty, anchor } = selection;
        if (!empty) return false;

        let isOurNode = false;
        state.doc.nodesBetween(anchor, anchor + 1, (node: { type: { name: string } }) => {
          if (node.type.name === nodeName) {
            isOurNode = true;
            return false;
          }
        });

        return isOurNode;
      });
    },
  };
}

// =============================================================================
// NodeView Options — Event Stopping
// =============================================================================

/**
 * Options for ReactNodeViewRenderer that stop keyboard events
 * from bubbling to ProseMirror when inside interactive content.
 *
 * The `stopEvent` function returns `true` for events that should
 * NOT be handled by ProseMirror.
 */
export const protectedNodeViewOptions: Partial<ReactNodeViewRendererOptions> = {
  stopEvent: ({ event }) => {
    // Stop all keyboard events from bubbling to ProseMirror
    // This prevents deletion when typing in inputs inside the node
    if (event.type === 'keydown' || event.type === 'keyup' || event.type === 'keypress') {
      const target = event.target as HTMLElement;

      // Always stop if target is an input, textarea, or contenteditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return true;
      }

      // Stop Backspace/Delete regardless of target
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === 'Backspace' || keyEvent.key === 'Delete') {
        return true;
      }
    }

    // Let other events (mouse, focus, etc.) through
    return false;
  },
};

// =============================================================================
// FilterTransaction Extension — Ultimate Protection
// =============================================================================

/**
 * Extension that prevents protected node types from being deleted.
 *
 * Uses filterTransaction to intercept ALL transactions (not just keyboard)
 * and blocks any that would delete the specified node types.
 *
 * This catches:
 * - Ctrl+A then type/backspace
 * - Mouse selection then type/backspace
 * - Programmatic deletions (unless using the explicit delete command)
 *
 * Usage:
 * ```typescript
 * const editor = new Editor({
 *   extensions: [
 *     ProtectedNodes.configure({
 *       types: ['mapBlock', 'scene3DBlock'],
 *     }),
 *   ],
 * });
 * ```
 */
export interface ProtectedNodesOptions {
  /** Node type names to protect from deletion */
  types: string[];
}

export const ProtectedNodes = Extension.create<ProtectedNodesOptions>({
  name: 'protectedNodes',

  addOptions() {
    return {
      types: [],
    };
  },

  addProseMirrorPlugins() {
    const protectedTypes = new Set(this.options.types);

    return [
      new Plugin({
        key: new PluginKey('protectedNodesFilter'),

        /**
         * appendTransaction — restore protected nodes if they were deleted.
         *
         * This allows all other content to be deleted/replaced while
         * preserving protected nodes. Much better UX than blocking entirely.
         */
        appendTransaction: (transactions, oldState, newState) => {
          // Skip if this is an explicit deletion
          const hasExplicitDelete = transactions.some((tr) =>
            tr.getMeta('allowProtectedNodeDeletion')
          );
          if (hasExplicitDelete) return null;

          // Collect protected nodes from old state
          const oldProtectedNodes: Array<{
            node: typeof oldState.doc.firstChild;
            pos: number;
          }> = [];

          oldState.doc.descendants((node, pos) => {
            if (protectedTypes.has(node.type.name)) {
              oldProtectedNodes.push({ node, pos });
            }
          });

          // If no protected nodes existed, nothing to preserve
          if (oldProtectedNodes.length === 0) return null;

          // Check which protected nodes still exist in new state
          const newProtectedNodeIds = new Set<string>();
          newState.doc.descendants((node) => {
            if (protectedTypes.has(node.type.name)) {
              // Use node attrs.id if available, otherwise use type+content hash
              const id = node.attrs?.id || `${node.type.name}-${node.textContent}`;
              newProtectedNodeIds.add(id);
            }
          });

          // Find deleted protected nodes
          const deletedNodes = oldProtectedNodes.filter(({ node }) => {
            const id = node.attrs?.id || `${node.type.name}-${node.textContent}`;
            return !newProtectedNodeIds.has(id);
          });

          // If no protected nodes were deleted, no fix needed
          if (deletedNodes.length === 0) return null;

          console.debug(
            `[ProtectedNodes] Restoring ${deletedNodes.length} protected node(s)`
          );

          // Create a transaction to re-insert deleted nodes
          const tr = newState.tr;

          // Insert at the end of the document (after any new content)
          let insertPos = newState.doc.content.size;

          for (const { node } of deletedNodes) {
            // Insert the protected node
            tr.insert(insertPos, node);
            insertPos += node.nodeSize;
          }

          // Mark this transaction so we don't recurse
          tr.setMeta('protectedNodesRestored', true);

          return tr;
        },
      }),
    ];
  },
});

// =============================================================================
// Explicit Delete Command
// =============================================================================

/**
 * Explicitly delete a protected node (bypasses appendTransaction restoration).
 *
 * Use this in your delete button handlers.
 *
 * @example
 * ```typescript
 * const handleDelete = () => {
 *   deleteProtectedNode(editor, getPos());
 * };
 * ```
 */
export const deleteProtectedNode = (
  editor: {
    chain: () => {
      focus: () => {
        command: (fn: (props: { tr: { setMeta: (key: string, value: boolean) => void } }) => boolean) => {
          deleteRange: (range: { from: number; to: number }) => {
            run: () => boolean;
          };
        };
      };
    };
  },
  pos: number,
  nodeSize: number = 1
): boolean => {
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      // Set meta on the SAME transaction that will do the deletion
      tr.setMeta('allowProtectedNodeDeletion', true);
      return true;
    })
    .deleteRange({ from: pos, to: pos + nodeSize })
    .run();
};
