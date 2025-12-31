/**
 * Tiptap Adapter
 *
 * Converts Tiptap NodeViewProps to BlockNodeViewContext.
 * This is the bridge that allows EmbeddedBlockWrapper to be used
 * both inside Tiptap and in standalone contexts.
 */

import type { NodeViewProps } from '@tiptap/react';
import type { BlockNodeViewContext, BlockId, BlockTypeName } from '../types/context';

// ============================================================================
// Adapter Function
// ============================================================================

/**
 * Convert Tiptap NodeViewProps to BlockNodeViewContext.
 *
 * @example
 * ```tsx
 * // In your NodeView component
 * export function MyBlockView(props: NodeViewProps) {
 *   const context = tiptapToBlockContext(props);
 *   return <EmbeddedBlockWrapper context={context} />;
 * }
 * ```
 */
export function tiptapToBlockContext(
  nodeViewProps: NodeViewProps,
  options?: {
    /** Override display name (defaults to node.attrs.name or node.type.name) */
    displayName?: string;
    /** Custom delete handler (defaults to editor.chain().deleteNode()) */
    onDelete?: () => void;
    /** Custom attribute change handler */
    onAttributeChange?: (key: string, value: unknown) => void;
  }
): BlockNodeViewContext {
  const { node, editor, selected, deleteNode } = nodeViewProps;

  // Extract block identity
  const blockId = (node.attrs['id'] ?? node.attrs['blockId'] ?? `block-${Date.now()}`) as BlockId;
  const blockTypeName = node.type.name as BlockTypeName;
  const displayName = options?.displayName ?? node.attrs['name'] ?? node.type.name;

  // Build context
  return {
    // Identity
    blockId,
    blockTypeName,
    displayName,

    // Selection state
    selection: {
      selected,
      focused: false, // Tiptap doesn't expose this directly
      inRange: false,
    },

    // Edit state
    editState: {
      isEditable: editor.isEditable,
      isDeletable: editor.isEditable,
      isMovable: editor.isEditable,
      isEditing: false,
    },

    // Attributes (pass through all node attrs)
    attributes: { ...node.attrs },

    // Callbacks
    onDelete:
      options?.onDelete ??
      (() => {
        // Default Tiptap deletion with protection bypass
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.setMeta('allowProtectedNodeDeletion', true);
            return true;
          })
          .deleteNode(node.type.name)
          .run();
      }),

    onSelect: (sel: boolean) => {
      if (sel && !selected) {
        // Select this node
        const pos = nodeViewProps.getPos();
        if (typeof pos === 'number') {
          editor.commands.setNodeSelection(pos);
        }
      }
    },

    onAttributeChange:
      options?.onAttributeChange ??
      ((key: string, value: unknown) => {
        // Update node attribute via Tiptap
        const pos = nodeViewProps.getPos();
        if (typeof pos === 'number') {
          editor.commands.updateAttributes(node.type.name, { [key]: value });
        }
      }),

    onFocus: () => {
      const pos = nodeViewProps.getPos();
      if (typeof pos === 'number') {
        editor.commands.focus(pos);
      }
    },

    // Raw escape hatch
    raw: {
      editor,
      node,
    },
  };
}

// ============================================================================
// React Hook for Tiptap Context
// ============================================================================

/**
 * Hook to create a memoized BlockNodeViewContext from Tiptap props.
 *
 * @example
 * ```tsx
 * function MyBlockView(props: NodeViewProps) {
 *   const context = useTiptapBlockContext(props);
 *   return <EmbeddedBlockWrapper context={context} />;
 * }
 * ```
 */
export function useTiptapBlockContext(
  nodeViewProps: NodeViewProps,
  options?: Parameters<typeof tiptapToBlockContext>[1]
): BlockNodeViewContext {
  // Note: We intentionally don't useMemo here because nodeViewProps
  // changes on every render in Tiptap. The context is lightweight
  // and doesn't benefit from memoization.
  return tiptapToBlockContext(nodeViewProps, options);
}
