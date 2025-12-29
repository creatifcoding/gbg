/**
 * DataGridBlock Extension
 *
 * Custom block that renders an AG-Grid data grid with TMNL variant theming.
 * Supports dataplane integration for linking with other blocks.
 *
 * @module editor/v3/extensions/blocks/DataGridBlock
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { nanoid } from 'nanoid';

import {
  createProtectedNodeKeyboardShortcuts,
  protectedNodeViewOptions,
} from '../EmbeddedBlockWrapper/shared/protectedNode';

import { DataGridBlockView } from './DataGridBlockView';
import { DEFAULT_COLUMN_DEFS, DEMO_ROW_DATA } from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface DataGridBlockAttrs {
  /** Unique block ID */
  id: string;
  /** Row data */
  rowData: unknown[];
  /** Column definitions */
  columnDefs: unknown[];
  /** Active variant ID */
  variantId: string;
}

export interface DataGridBlockOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dataGridBlock: {
      /** Insert a data grid block */
      insertDataGrid: (options?: {
        rowData?: unknown[];
        columnDefs?: unknown[];
        variantId?: string;
      }) => ReturnType;
      /** Delete the current data grid block */
      deleteDataGrid: () => ReturnType;
    };
  }
}

// =============================================================================
// Extension
// =============================================================================

export const DataGridBlock = Node.create<DataGridBlockOptions>({
  name: 'dataGridBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      id: {
        default: () => nanoid(12),
        parseHTML: (element) => element.getAttribute('data-id') || nanoid(12),
        renderHTML: (attributes) => ({ 'data-id': attributes.id }),
      },
      rowData: {
        default: DEMO_ROW_DATA,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-row-data');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return DEMO_ROW_DATA;
            }
          }
          return DEMO_ROW_DATA;
        },
        renderHTML: (attributes) => ({
          'data-row-data': JSON.stringify(attributes.rowData),
        }),
      },
      columnDefs: {
        default: DEFAULT_COLUMN_DEFS,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-column-defs');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return DEFAULT_COLUMN_DEFS;
            }
          }
          return DEFAULT_COLUMN_DEFS;
        },
        renderHTML: (attributes) => ({
          'data-column-defs': JSON.stringify(attributes.columnDefs),
        }),
      },
      variantId: {
        default: 'tmnl-dense-dark',
        parseHTML: (element) =>
          element.getAttribute('data-variant-id') || 'tmnl-dense-dark',
        renderHTML: (attributes) => ({
          'data-variant-id': attributes.variantId,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dataGridBlock"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'dataGridBlock',
        'data-id': node.attrs.id,
        'data-row-data': JSON.stringify(node.attrs.rowData),
        'data-column-defs': JSON.stringify(node.attrs.columnDefs),
        'data-variant-id': node.attrs.variantId,
      }),
      [
        'div',
        { class: 'data-grid-placeholder' },
        'Data Grid Block (requires JavaScript)',
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DataGridBlockView, protectedNodeViewOptions);
  },

  addKeyboardShortcuts() {
    return createProtectedNodeKeyboardShortcuts.call(this);
  },

  addCommands() {
    return {
      insertDataGrid:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: nanoid(12),
              rowData: options.rowData ?? DEMO_ROW_DATA,
              columnDefs: options.columnDefs ?? DEFAULT_COLUMN_DEFS,
              variantId: options.variantId ?? 'tmnl-dense-dark',
            },
          });
        },
      deleteDataGrid:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name);
        },
    };
  },
});

// =============================================================================
// Re-exports
// =============================================================================

export { DataGridBlockView } from './DataGridBlockView';
export {
  createDataGridBlockAtoms,
  getDataGridBlockAtoms,
  disposeDataGridBlockAtoms,
  DEFAULT_COLUMN_DEFS,
  DEMO_ROW_DATA,
  type DataGridBlockAtoms,
  type DataGridState,
  type DataGridRow,
} from './atoms';
