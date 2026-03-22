/**
 * ChartBlock Extension
 *
 * Custom block that renders Ant Design charts.
 * Supports 40 chart types with visual builder and lock tiers.
 *
 * @module editor/v3/extensions/blocks/ChartBlock
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { nanoid } from 'nanoid';

import {
  createProtectedNodeKeyboardShortcuts,
  protectedNodeViewOptions,
} from '../EmbeddedBlockWrapper/shared/protectedNode';
import type { ChartType } from '@/lib/charts/schemas/base';

import { ChartBlockView } from './ChartBlockView';
import { DEFAULT_CHART_STATE } from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface ChartBlockAttrs {
  /** Unique block ID */
  id: string;
  /** Chart type (Line, Bar, Pie, etc.) */
  chartType: ChartType;
  /** Chart configuration (xField, yField, colors, etc.) */
  config: Record<string, unknown>;
  /** Inline data array */
  data: unknown[];
  /** Lock tier for agentic charts */
  lockTier: 'unlocked' | 'agent-soft' | 'agent-locked' | 'user-locked';
  /** Who locked the chart */
  lockedBy: string | null;
  /** When the chart was locked */
  lockedAt: string | null;
}

export interface ChartBlockOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
}

export interface InsertChartOptions {
  /** Chart type to insert */
  chartType?: ChartType;
  /** Initial configuration */
  config?: Record<string, unknown>;
  /** Initial data */
  data?: unknown[];
  /** Initial lock tier */
  lockTier?: ChartBlockAttrs['lockTier'];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chartBlock: {
      /** Insert a chart block */
      insertChart: (options?: InsertChartOptions) => ReturnType;
      /** Delete the current chart block */
      deleteChart: () => ReturnType;
    };
  }
}

// =============================================================================
// Extension
// =============================================================================

export const ChartBlock = Node.create<ChartBlockOptions>({
  name: 'chartBlock',

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
        renderHTML: (attributes) => ({ 'data-id': attributes['id'] }),
      },
      chartType: {
        default: DEFAULT_CHART_STATE.chartType,
        parseHTML: (element) =>
          element.getAttribute('data-chart-type') || DEFAULT_CHART_STATE.chartType,
        renderHTML: (attributes) => ({ 'data-chart-type': attributes['chartType'] }),
      },
      config: {
        default: {},
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-config');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return {};
            }
          }
          return {};
        },
        renderHTML: (attributes) => ({
          'data-config': JSON.stringify(attributes['config']),
        }),
      },
      data: {
        default: [],
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-data');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return [];
            }
          }
          return [];
        },
        renderHTML: (attributes) => ({
          'data-data': JSON.stringify(attributes['data']),
        }),
      },
      lockTier: {
        default: 'unlocked',
        parseHTML: (element) => element.getAttribute('data-lock-tier') || 'unlocked',
        renderHTML: (attributes) => ({ 'data-lock-tier': attributes['lockTier'] }),
      },
      lockedBy: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-locked-by') || null,
        renderHTML: (attributes) =>
          attributes['lockedBy']
            ? { 'data-locked-by': attributes['lockedBy'] }
            : {},
      },
      lockedAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-locked-at') || null,
        renderHTML: (attributes) =>
          attributes['lockedAt']
            ? { 'data-locked-at': attributes['lockedAt'] }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="chartBlock"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'chartBlock',
        'data-id': node.attrs['id'],
        'data-chart-type': node.attrs['chartType'],
        'data-config': JSON.stringify(node.attrs['config']),
        'data-data': JSON.stringify(node.attrs['data']),
        'data-lock-tier': node.attrs['lockTier'],
      }),
      ['div', { class: 'chart-placeholder' }, `Chart Block: ${node.attrs['chartType']} (requires JavaScript)`],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartBlockView, protectedNodeViewOptions);
  },

  addKeyboardShortcuts() {
    return createProtectedNodeKeyboardShortcuts.call(this);
  },

  addCommands() {
    return {
      insertChart:
        (options: InsertChartOptions = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: nanoid(12),
              chartType: options.chartType ?? DEFAULT_CHART_STATE.chartType,
              config: options.config ?? {},
              data: options.data ?? [],
              lockTier: options.lockTier ?? 'unlocked',
              lockedBy: null,
              lockedAt: null,
            },
          });
        },
      deleteChart:
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

export { ChartBlockView } from './ChartBlockView';
export {
  createChartBlockAtoms,
  getChartBlockAtoms,
  disposeChartBlockAtoms,
  createChartBlockActions,
  useChartBlockActions,
  useChartBlockAtoms,
  chartBlockRegistry,
  DEFAULT_CHART_STATE,
  type ChartBlockAtoms,
  type ChartBlockState,
} from './atoms';
