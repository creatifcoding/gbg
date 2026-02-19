/**
 * TMNL Charts Module
 *
 * Comprehensive charting library with 40 Ant Design chart types.
 * Supports both standalone usage and genifer catalog integration.
 *
 * ## Features
 * - 40 chart types: statistical, tiny, relational
 * - Data-first chart selection
 * - Effect Schema validation
 * - genifer catalog integration
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
 * import { createCatalogLayer } from '@/lib/genifer'
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

// Themes
export * from './themes';

// Styler (per-chart style atoms)
export * from './styler';

// Hooks
export * from './hooks';

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
  type ChartPanelType,
} from './registry';

// Interactive Panel
export {
  // Main compound component
  InteractiveChartPanel,
  type InteractiveChartPanelProps,
  // Sub-components
  Header as PanelHeader,
  TabBar as PanelTabBar,
  Content as PanelContent,
  SettingsPanel,
  type HeaderProps as PanelHeaderProps,
  type TabBarProps as PanelTabBarProps,
  type ContentProps as PanelContentProps,
  type SettingsPanelProps,
  // Schemas
  TabId,
  ALL_TAB_IDS,
  TAB_META,
  TABS_BY_CATEGORY,
  getTabsForCategory,
  isTabAvailable,
  getDefaultTab,
  PanelId,
  asPanelId,
  FoldState,
  PanelState,
  DEFAULT_PANEL_STATE,
  type TabsForCategory,
  type PanelStatePatch,
  // Atoms
  createPanelAtoms,
  getPanelAtoms,
  disposePanelAtoms,
  usePanelActions,
  usePanelState,
  type PanelAtoms,
  type PanelActions,
  // Context
  PanelProvider,
  usePanelContext,
  usePanelAtoms,
  useChartId,
  useChartCategory,
  useAvailableTabs,
  type PanelProviderProps,
  type PanelContextValue,
  // Hooks
  useChartPorts,
  useChartHasConnections,
  type ChartPortsState,
} from './interactive-panel';

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
