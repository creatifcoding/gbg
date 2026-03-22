/**
 * ColumnView Component
 *
 * React node view for individual Column nodes.
 * Minimal wrapper that renders child block content.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/ColumnView
 */

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';

import type { ColumnAttrs } from './types';

// =============================================================================
// Component
// =============================================================================

/**
 * Individual column within a ColumnLayout.
 * Uses NodeViewContent to render nested block content.
 */
export function ColumnView({ node }: NodeViewProps) {
  const attrs = node.attrs as ColumnAttrs;

  return (
    <NodeViewWrapper
      className="column"
      data-column-id={attrs.id}
    >
      <NodeViewContent className="column-content" />
    </NodeViewWrapper>
  );
}
