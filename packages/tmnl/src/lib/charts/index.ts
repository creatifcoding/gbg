/**
 * TMNL Charts Module
 *
 * Comprehensive charting library with 40 Ant Design chart types.
 * Supports both standalone usage and json-render catalog integration.
 *
 * ## Features
 * - 40 chart types: statistical, tiny, relational
 * - Data-first chart selection
 * - Effect Schema validation
 * - json-render catalog integration
 * - Lazy-loaded components
 *
 * ## Usage
 *
 * ### Direct rendering
 * ```tsx
 * import { ChartRenderer } from '@/lib/charts'
 *
 * <ChartRenderer
 *   chartType="Line"
 *   config={{ data, xField: 'x', yField: 'y' }}
 * />
 * ```
 *
 * ### Catalog integration
 * ```ts
 * import { chartDomainCatalog } from '@/lib/charts'
 * import { createCatalogLayer } from '@/lib/json-render/core/CatalogService'
 *
 * const CatalogLive = createCatalogLayer(
 *   layoutDomainCatalog,
 *   chartDomainCatalog
 * )
 * ```
 *
 * @module charts
 */

// Schemas
export * from './schemas';

// Registry
export {
  CHART_DEFINITIONS,
  CHART_DEFINITIONS_BY_TYPE,
  getChartDefinition,
  getChartsByCategory,
  getChartsByDataShape,
  type ChartDefinition,
  type ChartCategory,
  type DataShape,
} from './registry';

// Factory
export {
  createChartComponentDef,
  createChartDomainCatalog,
  chartDomainCatalog,
  getChartRecommendations,
  generateChartSelectionPrompt,
} from './registry';

// Components
export { ChartRenderer, type ChartRendererProps } from './components';

// Lock System
export {
  LockTierSchema,
  LockStateSchema,
  LockActionSchema,
  DEFAULT_LOCK_STATE,
  canUserEdit,
  canAgentModify,
  requiresUnlock,
  getLockTierInfo,
  chartLockRegistry,
  createChartLockAtoms,
  getChartLockAtoms,
  disposeChartLockAtoms,
  createLockActions,
  useChartLockActions,
  useChartLockAtoms,
  type LockTier,
  type LockState,
  type LockAction,
  type ChartLockAtoms,
} from './locks';

// Composable Catalogs
export {
  ComposableCatalog,
  ChartCatalog,
  allCharts,
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
  statisticalCharts,
  relationalCharts,
  dashboardCharts,
  analyticsCharts,
  biCharts,
  scientificCharts,
  CATEGORY_DESCRIPTIONS,
  getCategoryCatalog,
  ALL_CATEGORIES,
  type CategoryName,
} from './composable';

// Chart Discriminator
export {
  ChartDiscriminator,
  ChartDiscriminatorLive,
  makeChartDiscriminator,
  NoSuitableChartError,
  InvalidInputError,
  AmbiguousRequestError,
  generateSystemPrompt as generateDiscriminatorPrompt,
  generateMiniSchema,
  generateMiniSchemas,
  generateScopedPrompt,
  // AI Tool for external agents
  createChartDiscriminatorTool,
  type ChartDiscriminatorTool,
  type ChartDiscriminatorToolResult,
  type ChartDiscriminatorToolError,
  type ChartDiscriminatorToolOutput,
  // Types
  type DiscriminatorInput,
  type DiscriminatorOutput,
  type ChartRecommendation,
  type MiniSchema,
  type SelectionConstraints,
} from './discriminator';
