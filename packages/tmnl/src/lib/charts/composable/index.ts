/**
 * Composable Chart Catalogs
 *
 * Set-based operations for building chart subsets.
 *
 * @module charts/composable
 */

export { ComposableCatalog, ChartCatalog } from './ComposableCatalog';
export {
  // Master catalog
  allCharts,

  // Category catalogs
  trendCharts,
  comparisonCharts,
  partToWholeCharts,
  distributionCharts,
  rankingCharts,
  flowCharts,
  correlationCharts,
  kpiCharts,
  textCharts,
  hierarchicalCharts,
  networkCharts,

  // Convenience groupings
  statisticalCharts,
  relationalCharts,
  timeSeriesCharts,
  multiSeriesCharts,
  hierarchicalDataCharts,

  // Common combinations
  dashboardCharts,
  analyticsCharts,
  biCharts,
  scientificCharts,

  // Utilities
  CATEGORY_DESCRIPTIONS,
  getCategoryCatalog,
  ALL_CATEGORIES,
  type CategoryName,
} from './categories';
