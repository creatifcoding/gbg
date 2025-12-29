/**
 * ColumnLayout Extension
 *
 * Multi-column layout system for TipTap editor.
 * Supports 2-6 columns with drag-to-resize handles and responsive stacking.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { nanoid } from 'nanoid';

import { ColumnLayoutView } from './ColumnLayoutView';
import { ColumnView } from './ColumnView';
import type {
  ColumnLayoutAttrs,
  ColumnAttrs,
  ColumnLayoutOptions,
  ColumnOptions,
  InsertColumnLayoutOptions,
  ResponsiveBehavior,
} from './types';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = 16;
const DEFAULT_STACK_BREAKPOINT = 768;
const MIN_COLUMN_WIDTH = 0.1;
const MAX_COLUMNS = 6;

/**
 * Generate equal width ratios for N columns.
 */
const equalWidths = (columns: number): number[] =>
  Array(columns).fill(1 / columns);

// =============================================================================
// Command Declaration
// =============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columnLayout: {
      /** Insert a column layout with N columns */
      insertColumnLayout: (options?: InsertColumnLayoutOptions) => ReturnType;
      /** Add a column to the current layout */
      addColumn: () => ReturnType;
      /** Remove a column from the current layout */
      removeColumn: (index: number) => ReturnType;
      /** Set column widths */
      setColumnWidths: (widths: number[]) => ReturnType;
    };
  }
}

// =============================================================================
// Column Node (Child)
// =============================================================================

/**
 * Individual column within a ColumnLayout.
 * Contains any block content including nested ColumnLayouts.
 */
export const Column = Node.create<ColumnOptions>({
  name: 'column',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  // Custom group - only valid inside columnLayout
  group: 'column',

  // Accepts any block content, including nested columnLayout
  content: 'block+',

  // Prevents selection from escaping into parent
  isolating: true,

  // This node defines its own content structure
  defining: true,

  addAttributes() {
    return {
      id: {
        default: () => nanoid(8),
        parseHTML: (element) => element.getAttribute('data-column-id') || nanoid(8),
        renderHTML: (attributes: ColumnAttrs) => ({
          'data-column-id': attributes.id,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'column',
        'data-column-id': node.attrs.id,
        class: 'column',
      }),
      0, // Content placeholder
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnView);
  },
});

// =============================================================================
// ColumnLayout Node (Parent)
// =============================================================================

/**
 * Multi-column layout container.
 * Must contain 1+ Column nodes.
 */
export const ColumnLayout = Node.create<ColumnLayoutOptions>({
  name: 'columnLayout',

  addOptions() {
    return {
      HTMLAttributes: {},
      minColumnWidth: MIN_COLUMN_WIDTH,
      maxColumns: MAX_COLUMNS,
      defaultGap: DEFAULT_GAP,
      defaultStackBreakpoint: DEFAULT_STACK_BREAKPOINT,
    };
  },

  group: 'block',

  // Must contain 1 or more columns
  content: 'column+',

  // Prevents selection from escaping
  isolating: true,

  // This node defines its own content structure
  defining: true,

  addAttributes() {
    return {
      id: {
        default: () => nanoid(12),
        parseHTML: (element) => element.getAttribute('data-id') || nanoid(12),
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-id': attributes.id,
        }),
      },
      columns: {
        default: DEFAULT_COLUMNS,
        parseHTML: (element) => {
          const value = element.getAttribute('data-columns');
          return value ? parseInt(value, 10) : DEFAULT_COLUMNS;
        },
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-columns': String(attributes.columns),
        }),
      },
      widths: {
        default: equalWidths(DEFAULT_COLUMNS),
        parseHTML: (element) => {
          const value = element.getAttribute('data-widths');
          if (value) {
            try {
              return JSON.parse(value);
            } catch {
              return equalWidths(DEFAULT_COLUMNS);
            }
          }
          return equalWidths(DEFAULT_COLUMNS);
        },
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-widths': JSON.stringify(attributes.widths),
        }),
      },
      gap: {
        default: DEFAULT_GAP,
        parseHTML: (element) => {
          const value = element.getAttribute('data-gap');
          return value ? parseInt(value, 10) : DEFAULT_GAP;
        },
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-gap': String(attributes.gap),
        }),
      },
      responsive: {
        default: 'stack' as ResponsiveBehavior,
        parseHTML: (element) =>
          (element.getAttribute('data-responsive') as ResponsiveBehavior) || 'stack',
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-responsive': attributes.responsive,
        }),
      },
      stackBreakpoint: {
        default: DEFAULT_STACK_BREAKPOINT,
        parseHTML: (element) => {
          const value = element.getAttribute('data-stack-breakpoint');
          return value ? parseInt(value, 10) : DEFAULT_STACK_BREAKPOINT;
        },
        renderHTML: (attributes: ColumnLayoutAttrs) => ({
          'data-stack-breakpoint': String(attributes.stackBreakpoint),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columnLayout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as ColumnLayoutAttrs;
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'columnLayout',
        'data-id': attrs.id,
        'data-columns': String(attrs.columns),
        'data-widths': JSON.stringify(attrs.widths),
        'data-gap': String(attrs.gap),
        'data-responsive': attrs.responsive,
        'data-stack-breakpoint': String(attrs.stackBreakpoint),
        class: 'column-layout',
        style: `--column-gap: ${attrs.gap}px;`,
      }),
      0, // Content placeholder for columns
    ];
  },

  addCommands() {
    return {
      insertColumnLayout:
        (options = {}) =>
        ({ commands }) => {
          const columns = Math.min(
            Math.max(options.columns ?? DEFAULT_COLUMNS, 1),
            this.options.maxColumns
          );
          const widths = options.widths ?? equalWidths(columns);

          // Validate widths sum to ~1
          const widthSum = widths.reduce((a, b) => a + b, 0);
          const normalizedWidths =
            Math.abs(widthSum - 1) > 0.01
              ? widths.map((w) => w / widthSum)
              : widths;

          return commands.insertContent({
            type: 'columnLayout',
            attrs: {
              id: nanoid(12),
              columns,
              widths: normalizedWidths,
              gap: options.gap ?? this.options.defaultGap,
              responsive: 'stack',
              stackBreakpoint: this.options.defaultStackBreakpoint,
            },
            content: normalizedWidths.map(() => ({
              type: 'column',
              attrs: { id: nanoid(8) },
              content: [{ type: 'paragraph' }],
            })),
          });
        },

      addColumn:
        () =>
        ({ tr, state, dispatch }) => {
          // Find the column layout node at current selection
          const { $from } = state.selection;
          let layoutPos: number | null = null;
          let layoutNode = null;

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'columnLayout') {
              layoutPos = $from.before(depth);
              layoutNode = node;
              break;
            }
          }

          if (!layoutPos || !layoutNode || !dispatch) return false;

          const attrs = layoutNode.attrs as ColumnLayoutAttrs;
          if (attrs.columns >= this.options.maxColumns) return false;

          // Create new column with equal distribution
          const newColumns = attrs.columns + 1;
          const newWidths = equalWidths(newColumns);

          // Insert new column at end
          const newColumn = state.schema.nodes.column.create(
            { id: nanoid(8) },
            state.schema.nodes.paragraph.create()
          );

          const insertPos = layoutPos + layoutNode.nodeSize - 1;
          tr.insert(insertPos, newColumn);
          tr.setNodeMarkup(layoutPos, undefined, {
            ...attrs,
            columns: newColumns,
            widths: newWidths,
          });

          dispatch(tr);
          return true;
        },

      removeColumn:
        (index: number) =>
        ({ tr, state, dispatch }) => {
          const { $from } = state.selection;
          let layoutPos: number | null = null;
          let layoutNode = null;

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'columnLayout') {
              layoutPos = $from.before(depth);
              layoutNode = node;
              break;
            }
          }

          if (!layoutPos || !layoutNode || !dispatch) return false;

          const attrs = layoutNode.attrs as ColumnLayoutAttrs;
          if (attrs.columns <= 1) return false;
          if (index < 0 || index >= attrs.columns) return false;

          // Find and remove the column at index
          let columnPos = layoutPos + 1;
          for (let i = 0; i < index; i++) {
            const child = layoutNode.child(i);
            columnPos += child.nodeSize;
          }
          const columnNode = layoutNode.child(index);

          // Redistribute widths
          const newWidths = [...attrs.widths];
          const removedWidth = newWidths.splice(index, 1)[0];
          const redistributed = removedWidth / newWidths.length;
          const finalWidths = newWidths.map((w) => w + redistributed);

          tr.delete(columnPos, columnPos + columnNode.nodeSize);
          tr.setNodeMarkup(layoutPos, undefined, {
            ...attrs,
            columns: attrs.columns - 1,
            widths: finalWidths,
          });

          dispatch(tr);
          return true;
        },

      setColumnWidths:
        (widths: number[]) =>
        ({ tr, state, dispatch }) => {
          const { $from } = state.selection;
          let layoutPos: number | null = null;
          let layoutNode = null;

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth);
            if (node.type.name === 'columnLayout') {
              layoutPos = $from.before(depth);
              layoutNode = node;
              break;
            }
          }

          if (!layoutPos || !layoutNode || !dispatch) return false;

          const attrs = layoutNode.attrs as ColumnLayoutAttrs;
          if (widths.length !== attrs.columns) return false;

          // Normalize widths to sum to 1
          const sum = widths.reduce((a, b) => a + b, 0);
          const normalizedWidths = widths.map((w) => w / sum);

          // Enforce minimum width
          const minWidth = this.options.minColumnWidth;
          const clampedWidths = normalizedWidths.map((w) => Math.max(w, minWidth));
          const clampedSum = clampedWidths.reduce((a, b) => a + b, 0);
          const finalWidths = clampedWidths.map((w) => w / clampedSum);

          tr.setNodeMarkup(layoutPos, undefined, {
            ...attrs,
            widths: finalWidths,
          });

          dispatch(tr);
          return true;
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnLayoutView);
  },
});

// =============================================================================
// Re-exports
// =============================================================================

export type {
  ColumnLayoutAttrs,
  ColumnAttrs,
  ColumnLayoutOptions,
  ColumnOptions,
  ColumnLayoutState,
  InsertColumnLayoutOptions,
  ResponsiveBehavior,
} from './types';

export { ColumnLayoutView } from './ColumnLayoutView';
export { ColumnView } from './ColumnView';
export { ColumnResizeHandle } from './ColumnResizeHandle';
export type { ColumnResizeHandleProps } from './ColumnResizeHandle';
export {
  createColumnLayoutAtoms,
  getColumnLayoutAtoms,
  disposeColumnLayoutAtoms,
  startDrag,
  updateWidths,
  endDrag,
  setStacked,
  type ColumnLayoutAtoms,
} from './atoms';

export { columnLayoutStyles } from './styles';
