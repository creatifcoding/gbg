/**
 * Tab ID Schema
 *
 * Type-level tab identifiers using Schema.Literal.
 * Each TabId is linked to exactly one tab renderer.
 *
 * @module charts/interactive-panel/schemas/tab-id
 */

import { Schema } from 'effect';

/**
 * Tab IDs as Schema.Literal - compile-time type safety.
 * Each TabId is linked to exactly one tab renderer.
 *
 * Universal tabs (all charts):
 * - style: Visual styling (colors, typography, animation)
 * - data: Data configuration and mapping
 *
 * Category-specific tabs:
 * - axes: Axis configuration (comparison, trend)
 * - series: Series styling (trend)
 * - labels: Label formatting (part-to-whole)
 * - statistics: Statistical overlays (distribution)
 * - nodes: Node styling (flow, network)
 * - regression: Regression lines (correlation)
 * - thresholds: Threshold bands (kpi)
 * - words: Word filtering (text)
 * - hierarchy: Drill configuration (hierarchical)
 * - layout: Force layout params (network)
 */
export const TabId = Schema.Literal(
  'style',      // Universal - all charts
  'data',       // Universal - data configuration
  'axes',       // comparison, trend - axis config
  'series',     // trend - series styling
  'labels',     // part-to-whole - label formatting
  'statistics', // distribution - stat overlays
  'nodes',      // flow, network - node styling
  'regression', // correlation - regression lines
  'thresholds', // kpi - threshold bands
  'words',      // text - word filtering
  'hierarchy',  // hierarchical - drill config
  'layout'      // network - force layout params
);

/**
 * TabId type extracted from schema.
 * Use this for type annotations.
 */
export type TabId = typeof TabId.Type;

/**
 * All valid TabId values as array for iteration.
 */
export const ALL_TAB_IDS: readonly TabId[] = [
  'style',
  'data',
  'axes',
  'series',
  'labels',
  'statistics',
  'nodes',
  'regression',
  'thresholds',
  'words',
  'hierarchy',
  'layout',
] as const;

/**
 * Branded type for type-safe tab ID strings.
 * Use `asTabId()` to safely cast runtime strings.
 */
export const TabIdBrand = Schema.String.pipe(Schema.brand('TabId'));
export type TabIdBrand = typeof TabIdBrand.Type;

/**
 * Safely decode a string to TabId with validation.
 * Throws ParseError if string is not a valid TabId.
 *
 * @example
 * ```ts
 * const tabId = decodeTabId('style'); // 'style'
 * decodeTabId('invalid'); // throws ParseError
 * ```
 */
export const decodeTabId = Schema.decodeSync(TabId);

/**
 * Try to decode a string to TabId without throwing.
 * Returns Either<ParseError, TabId>.
 *
 * @example
 * ```ts
 * const result = tryDecodeTabId('style');
 * if (Either.isRight(result)) {
 *   console.log(result.right); // 'style'
 * }
 * ```
 */
export const tryDecodeTabId = Schema.decodeEither(TabId);

/**
 * Check if a string is a valid TabId.
 *
 * @example
 * ```ts
 * isValidTabId('style'); // true
 * isValidTabId('invalid'); // false
 * ```
 */
export function isValidTabId(value: string): value is TabId {
  return (ALL_TAB_IDS as readonly string[]).includes(value);
}

/**
 * Tab metadata for UI rendering.
 */
export interface TabMeta {
  /** Tab ID */
  readonly id: TabId;
  /** Display label */
  readonly label: string;
  /** Lucide icon name (optional) */
  readonly icon?: string;
  /** Tab priority for ordering (lower = first) */
  readonly priority: number;
}

/**
 * Default tab metadata for all tabs.
 * Can be overridden per-chart or per-category.
 */
export const TAB_META: Record<TabId, TabMeta> = {
  style: { id: 'style', label: 'Style', icon: 'Palette', priority: 0 },
  data: { id: 'data', label: 'Data', icon: 'Database', priority: 1 },
  axes: { id: 'axes', label: 'Axes', icon: 'AxisLabel', priority: 2 },
  series: { id: 'series', label: 'Series', icon: 'LineChart', priority: 2 },
  labels: { id: 'labels', label: 'Labels', icon: 'Tag', priority: 2 },
  statistics: { id: 'statistics', label: 'Statistics', icon: 'BarChart3', priority: 2 },
  nodes: { id: 'nodes', label: 'Nodes', icon: 'Circle', priority: 2 },
  regression: { id: 'regression', label: 'Regression', icon: 'TrendingUp', priority: 2 },
  thresholds: { id: 'thresholds', label: 'Thresholds', icon: 'AlertTriangle', priority: 2 },
  words: { id: 'words', label: 'Words', icon: 'Type', priority: 2 },
  hierarchy: { id: 'hierarchy', label: 'Hierarchy', icon: 'GitBranch', priority: 2 },
  layout: { id: 'layout', label: 'Layout', icon: 'LayoutGrid', priority: 2 },
};
