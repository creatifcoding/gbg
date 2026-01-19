/**
 * Static Category Sub-Catalogs
 *
 * Pre-built chart groupings by purpose. Zero runtime cost, tree-shakeable.
 * Import only the catalogs you need.
 *
 * @module charts/composable/categories
 *
 * @example
 * ```typescript
 * import { trendCharts, comparisonCharts, allCharts } from '@/lib/charts/composable/categories';
 *
 * // Use directly
 * const availableTypes = trendCharts.getTypeNames();
 *
 * // Compose
 * const forTimeSeries = trendCharts.union(correlationCharts);
 * ```
 */

import { CHART_DEFINITIONS } from '../registry/definitions';
import { ChartCatalog } from './ComposableCatalog';

// =============================================================================
// Master Catalog
// =============================================================================

/**
 * All charts - the master catalog
 */
export const allCharts = ChartCatalog.fromDefinitions(CHART_DEFINITIONS);

// =============================================================================
// Category Sub-Catalogs (11 categories)
// =============================================================================

/**
 * Trend charts - time-series and sequential data
 *
 * Charts: Line, Area, Stock
 */
export const trendCharts = allCharts.byCategory('trend');

/**
 * Comparison charts - categorical comparisons
 *
 * Charts: Bar, Column, Radar, Rose, BidirectionalBar
 */
export const comparisonCharts = allCharts.byCategory('comparison');

/**
 * Part-to-whole charts - proportions and hierarchies
 *
 * Charts: Pie, Treemap, Sunburst, CirclePacking
 */
export const partToWholeCharts = allCharts.byCategory('part-to-whole');

/**
 * Distribution charts - statistical distributions
 *
 * Charts: Scatter, Histogram, Box, Violin
 */
export const distributionCharts = allCharts.byCategory('distribution');

/**
 * Ranking charts - ordered data and performance
 *
 * Charts: Funnel, Bullet, RadialBar
 */
export const rankingCharts = allCharts.byCategory('ranking');

/**
 * Flow charts - process and movement
 *
 * Charts: Sankey, Waterfall
 */
export const flowCharts = allCharts.byCategory('flow');

/**
 * Correlation charts - relationships between variables
 *
 * Charts: DualAxes, Heatmap, Venn
 */
export const correlationCharts = allCharts.byCategory('correlation');

/**
 * KPI charts - single metrics and progress
 *
 * Charts: Gauge, Liquid
 */
export const kpiCharts = allCharts.byCategory('kpi');

/**
 * Text charts - word frequency and text analysis
 *
 * Charts: WordCloud
 */
export const textCharts = allCharts.byCategory('text');

/**
 * Hierarchical charts - tree structures
 *
 * Charts: OrganizationChart, MindMap, IndentedTree, Dendrogram, Fishbone
 */
export const hierarchicalCharts = allCharts.byCategory('hierarchical');

/**
 * Network charts - graph and node-edge visualizations
 *
 * Charts: FlowGraph, NetworkGraph, FlowDirectionGraph
 */
export const networkCharts = allCharts.byCategory('network');

// =============================================================================
// Convenience Groupings
// =============================================================================

/**
 * Statistical charts - all charts from @ant-design/charts
 *
 * Excludes relational charts from @ant-design/graphs
 */
export const statisticalCharts = allCharts.filter(
  def => !['hierarchical', 'network'].includes(def.category)
);

/**
 * Relational charts - graphs and networks
 *
 * All charts from @ant-design/graphs
 */
export const relationalCharts = allCharts.byCategories('hierarchical', 'network');

/**
 * Time-based charts - any chart that works well with time series
 */
export const timeSeriesCharts = allCharts.byDataShape('time-series');

/**
 * Multi-series charts - charts supporting series grouping
 */
export const multiSeriesCharts = allCharts.withSeriesSupport();

/**
 * Hierarchical data charts - charts that accept nested data
 */
export const hierarchicalDataCharts = allCharts.hierarchical();

// =============================================================================
// Common Combinations
// =============================================================================

/**
 * Dashboard basics - common charts for dashboards
 *
 * Includes: trends, comparisons, KPIs
 */
export const dashboardCharts = trendCharts
  .union(comparisonCharts)
  .union(kpiCharts)
  .union(partToWholeCharts);

/**
 * Analytics charts - for data analysis use cases
 *
 * Includes: distribution, correlation, comparison
 */
export const analyticsCharts = distributionCharts
  .union(correlationCharts)
  .union(comparisonCharts)
  .union(trendCharts);

/**
 * Business intelligence - common BI chart types
 *
 * Includes: trends, comparison, ranking, part-to-whole
 */
export const biCharts = trendCharts
  .union(comparisonCharts)
  .union(rankingCharts)
  .union(partToWholeCharts)
  .union(flowCharts);

/**
 * Scientific/research charts - statistical and analytical
 *
 * Includes: distribution, correlation, hierarchical
 */
export const scientificCharts = distributionCharts
  .union(correlationCharts)
  .union(hierarchicalCharts);

// =============================================================================
// Category Metadata
// =============================================================================

/**
 * Category descriptions for AI prompts
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  trend: 'Time-series data showing change over time. Use for: stock prices, metrics over time, growth curves.',
  comparison: 'Comparing categorical values. Use for: survey results, A/B tests, feature comparison.',
  'part-to-whole': 'Showing proportions and hierarchy. Use for: market share, budget breakdown, nested categories.',
  distribution: 'Statistical distribution of data. Use for: histograms, scatter plots, outlier detection.',
  ranking: 'Ordered data with stages or progress. Use for: funnels, leaderboards, goal tracking.',
  flow: 'Movement and process between stages. Use for: user journeys, energy flow, budget reconciliation.',
  correlation: 'Relationships between variables. Use for: correlation matrices, dual metrics, set overlaps.',
  kpi: 'Single metric progress indicators. Use for: completion rate, performance score, health metrics.',
  text: 'Text and frequency visualization. Use for: word clouds, tag analysis, keyword frequency.',
  hierarchical: 'Tree and hierarchical structures. Use for: org charts, mind maps, file systems.',
  network: 'Graph and network relationships. Use for: social networks, workflows, system architecture.',
};

/**
 * Get category catalog by name
 */
export const getCategoryCatalog = (category: string): ChartCatalog | undefined => {
  switch (category) {
    case 'trend': return trendCharts;
    case 'comparison': return comparisonCharts;
    case 'part-to-whole': return partToWholeCharts;
    case 'distribution': return distributionCharts;
    case 'ranking': return rankingCharts;
    case 'flow': return flowCharts;
    case 'correlation': return correlationCharts;
    case 'kpi': return kpiCharts;
    case 'text': return textCharts;
    case 'hierarchical': return hierarchicalCharts;
    case 'network': return networkCharts;
    default: return undefined;
  }
};

/**
 * All category names
 */
export const ALL_CATEGORIES = [
  'trend',
  'comparison',
  'part-to-whole',
  'distribution',
  'ranking',
  'flow',
  'correlation',
  'kpi',
  'text',
  'hierarchical',
  'network',
] as const;

export type CategoryName = typeof ALL_CATEGORIES[number];
