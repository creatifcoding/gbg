/**
 * Chart Color Palettes
 *
 * Intent-based and category-based color palettes for chart styling.
 * These palettes are derived from VANTA design tokens and optimized
 * for different visualization contexts.
 *
 * @module charts/themes/palettes
 */

import { VANTA_COLORS } from '@/components/portal/tokens';

// =============================================================================
// Intent-Based Palettes
// =============================================================================

/**
 * Color palettes organized by styling intent.
 * Use these when you know the visualization's purpose.
 */
export const INTENT_PALETTES: Record<string, string[]> = {
  /**
   * Emphasize trends in time-series data.
   * Single-hue progression for clear direction.
   */
  'emphasize-trend': [
    VANTA_COLORS.accent.cyan,
    '#0891b2', // cyan-600
    '#06b6d4', // cyan-500
    '#22d3ee', // cyan-400
    '#67e8f9', // cyan-300
  ],

  /**
   * Compare categorical data.
   * High contrast between distinct categories.
   */
  'compare-categories': [
    VANTA_COLORS.accent.cyan,
    VANTA_COLORS.accent.emerald,
    VANTA_COLORS.accent.amber,
    VANTA_COLORS.accent.rose,
    VANTA_COLORS.accent.violet,
  ],

  /**
   * Show data distribution.
   * Sequential gradient for density perception.
   */
  'show-distribution': [
    VANTA_COLORS.accent.violet,
    '#8b5cf6', // violet-500
    '#a78bfa', // violet-400
    '#c4b5fd', // violet-300
    '#ddd6fe', // violet-200
  ],

  /**
   * Highlight outliers or anomalies.
   * High attention colors for exceptional values.
   */
  'highlight-outliers': [
    VANTA_COLORS.accent.rose,
    '#f43f5e', // rose-500
    '#fb7185', // rose-400
    VANTA_COLORS.text.secondary,
    VANTA_COLORS.text.tertiary,
  ],

  /**
   * Positive/negative diverging scale.
   * Green for positive, red for negative.
   */
  'positive-negative': [
    VANTA_COLORS.accent.emerald,  // Strong positive
    '#34d399',                     // Positive
    VANTA_COLORS.text.tertiary,   // Neutral
    '#fb7185',                     // Negative
    VANTA_COLORS.accent.rose,     // Strong negative
  ],

  /**
   * Cyberpunk aesthetic.
   * Neon colors for high-tech dashboards.
   */
  'cyberpunk': [
    '#00ff9f', // neon green
    '#00b8ff', // neon blue
    '#ff00ff', // neon magenta
    '#ffb800', // neon orange
    '#ff0055', // neon red
  ],

  /**
   * Minimal / understated.
   * Subtle colors that don't compete for attention.
   */
  'minimal': [
    VANTA_COLORS.text.secondary,
    VANTA_COLORS.text.tertiary,
    VANTA_COLORS.text.muted,
    'rgba(163, 163, 163, 0.5)',
    'rgba(163, 163, 163, 0.3)',
  ],

  /**
   * Status-based coloring.
   * Standard semantic colors for status indicators.
   */
  'status': [
    VANTA_COLORS.accent.emerald,  // Success
    VANTA_COLORS.accent.cyan,     // Info
    VANTA_COLORS.accent.amber,    // Warning
    VANTA_COLORS.accent.rose,     // Error
    VANTA_COLORS.text.tertiary,   // Neutral
  ],

  /**
   * Sequential cool.
   * Blue-to-cyan gradient for ordered data.
   */
  'sequential-cool': [
    '#1e3a5f',
    '#0c4a6e',
    '#0369a1',
    '#0891b2',
    VANTA_COLORS.accent.cyan,
  ],

  /**
   * Sequential warm.
   * Orange-to-yellow gradient for ordered data.
   */
  'sequential-warm': [
    '#7c2d12',
    '#c2410c',
    '#ea580c',
    '#f97316',
    VANTA_COLORS.accent.amber,
  ],
} as const;

// =============================================================================
// Category-Based Palettes
// =============================================================================

/**
 * Chart category type for palette selection.
 */
export type ChartCategory =
  | 'trend'
  | 'comparison'
  | 'part-to-whole'
  | 'distribution'
  | 'flow'
  | 'correlation'
  | 'hierarchy'
  | 'network';

/**
 * Color palettes organized by chart category.
 * Use these when you know the chart type but not specific intent.
 */
export const CATEGORY_PALETTES: Record<ChartCategory, string[]> = {
  /**
   * Trend charts: Line, Area, Stock.
   * Single or dual-hue for temporal patterns.
   */
  trend: [
    VANTA_COLORS.accent.cyan,
    VANTA_COLORS.accent.emerald,
    '#0891b2',
    '#059669',
  ],

  /**
   * Comparison charts: Bar, Column, Radar, Rose.
   * High contrast categorical colors.
   */
  comparison: [
    VANTA_COLORS.accent.cyan,
    VANTA_COLORS.accent.amber,
    VANTA_COLORS.accent.rose,
    VANTA_COLORS.accent.emerald,
    VANTA_COLORS.accent.violet,
  ],

  /**
   * Part-to-whole charts: Pie, Treemap, Sunburst.
   * Distinct colors for each segment.
   */
  'part-to-whole': [
    VANTA_COLORS.accent.cyan,
    VANTA_COLORS.accent.emerald,
    VANTA_COLORS.accent.amber,
    VANTA_COLORS.accent.violet,
    VANTA_COLORS.accent.rose,
    VANTA_COLORS.accent.cyanMuted,
    VANTA_COLORS.accent.emeraldMuted,
  ],

  /**
   * Distribution charts: Scatter, Histogram, Box, Violin.
   * Gradient or single color for density.
   */
  distribution: [
    VANTA_COLORS.accent.violet,
    VANTA_COLORS.accent.cyan,
    '#8b5cf6',
    '#06b6d4',
  ],

  /**
   * Flow charts: Sankey, Waterfall.
   * Progressive colors showing movement.
   */
  flow: [
    VANTA_COLORS.accent.cyan,
    VANTA_COLORS.accent.emerald,
    VANTA_COLORS.text.secondary,
    VANTA_COLORS.accent.amber,
    VANTA_COLORS.accent.rose,
  ],

  /**
   * Correlation charts: Scatter, Heatmap.
   * Colors that show relationship strength.
   */
  correlation: [
    VANTA_COLORS.accent.rose,     // Strong negative
    VANTA_COLORS.text.muted,      // No correlation
    VANTA_COLORS.accent.emerald,  // Strong positive
  ],

  /**
   * Hierarchy charts: Treemap, Sunburst, Organization.
   * Colors that distinguish levels.
   */
  hierarchy: [
    VANTA_COLORS.accent.cyan,
    '#0891b2',
    '#06b6d4',
    '#67e8f9',
    VANTA_COLORS.text.secondary,
  ],

  /**
   * Network charts: NetworkGraph, MindMap.
   * Node and edge distinction colors.
   */
  network: [
    VANTA_COLORS.accent.cyan,     // Primary nodes
    VANTA_COLORS.accent.violet,   // Secondary nodes
    VANTA_COLORS.text.tertiary,   // Edges
    VANTA_COLORS.accent.emerald,  // Highlighted
    VANTA_COLORS.accent.rose,     // Alerts
  ],
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get a palette by intent name.
 *
 * @param intent - The styling intent
 * @returns Color array, or minimal palette if intent not found
 */
export function getPaletteForIntent(intent: string): string[] {
  return INTENT_PALETTES[intent] ?? INTENT_PALETTES['minimal'];
}

/**
 * Get a palette by chart category.
 *
 * @param category - The chart category
 * @returns Color array for the category
 */
export function getPaletteForCategory(category: ChartCategory): string[] {
  return CATEGORY_PALETTES[category];
}

/**
 * Extend a palette to a minimum size by cycling colors.
 *
 * @param palette - Base color palette
 * @param minSize - Minimum number of colors needed
 * @returns Extended palette with at least minSize colors
 */
export function extendPalette(palette: string[], minSize: number): string[] {
  if (palette.length >= minSize) {
    return palette;
  }

  const result = [...palette];
  let i = 0;
  while (result.length < minSize) {
    result.push(palette[i % palette.length]);
    i++;
  }
  return result;
}

/**
 * Available intent names for documentation/autocomplete.
 */
export const AVAILABLE_INTENTS = Object.keys(INTENT_PALETTES);

/**
 * Available category names for documentation/autocomplete.
 */
export const AVAILABLE_CATEGORIES: ChartCategory[] = [
  'trend',
  'comparison',
  'part-to-whole',
  'distribution',
  'flow',
  'correlation',
  'hierarchy',
  'network',
];
