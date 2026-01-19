/**
 * InteractiveChartPanel Module
 *
 * Domain-specific compound component wrapper for interactive charts.
 * Provides panel state management, tab navigation, and chart controls.
 *
 * @module charts/interactive-panel
 *
 * @example
 * ```tsx
 * import { InteractiveChartPanel } from '@/lib/charts/interactive-panel';
 *
 * function MyChart() {
 *   return (
 *     <InteractiveChartPanel
 *       panelId="chart-1-panel"
 *       chartId="chart-1"
 *       category="trend"
 *     >
 *       <InteractiveChartPanel.Header title="Market Trends" />
 *       <InteractiveChartPanel.SettingsPanel />
 *     </InteractiveChartPanel>
 *   );
 * }
 * ```
 */

// =============================================================================
// Components
// =============================================================================

export {
  InteractiveChartPanel,
  type InteractiveChartPanelProps,
  // Sub-components
  Header,
  type HeaderProps,
  TabBar,
  type TabBarProps,
  Content,
  type ContentProps,
  SettingsPanel,
  type SettingsPanelProps,
} from './components';

// =============================================================================
// Schemas
// =============================================================================

export {
  // Tab ID
  TabId,
  ALL_TAB_IDS,
  TabIdBrand,
  decodeTabId,
  tryDecodeTabId,
  isValidTabId,
  TAB_META,
  type TabMeta,

  // Tab Registry
  TABS_BY_CATEGORY,
  getTabsForCategory,
  isTabAvailable,
  getDefaultTab,
  getCategoriesWithTab,
  isValidTabContract,
  type TabsForCategory,
  type TabContract,

  // Panel State
  PanelId,
  asPanelId,
  FoldState,
  StreamStatus,
  PanelState,
  DEFAULT_PANEL_STATE,
  createPanelState,
  applyPanelPatch,
  toPersistence,
  fromPersistence,
  type PanelStatePatch,
  type SerializablePanelState,
} from './schemas';

// =============================================================================
// Atoms
// =============================================================================

export {
  // Factory
  createPanelAtoms,
  getPanelAtoms,
  disposePanelAtoms,
  type PanelAtoms,

  // Actions
  usePanelActions,
  type PanelActions,

  // React hooks
  usePanelState,
  useActiveTab,
  useShowControls,
  useContentVisible,
  useIsStreaming,
} from './atoms';

// =============================================================================
// Context
// =============================================================================

export {
  // Provider
  PanelProvider,
  type PanelProviderProps,

  // Context value type
  type PanelContextValue,

  // Hooks
  usePanelContext,
  usePanelContextSafe,
  usePanelAtoms,
  usePanelActionsFromContext,
  useChartId,
  useChartCategory,
  useAvailableTabs,
} from './context';

// =============================================================================
// Hooks
// =============================================================================

export {
  // Dataplane integration
  useChartPorts,
  useChartHasConnections,
  useChartConnectionCount,
  usePortIsConnected,
  useChartInputPorts,
  useChartOutputPorts,
  type ChartPortsState,
  type UseChartPortsOptions,
} from './hooks';

// =============================================================================
// Tabs
// =============================================================================

export {
  // Tab components
  StyleTab,
  DataTab,
  AxesTab,
  SeriesTab,
  LabelsTab,
  StatisticsTab,
  NodesTab,
  RegressionTab,
  ThresholdsTab,
  WordsTab,
  HierarchyTab,
  LayoutTab,

  // Registry
  TAB_RENDERERS,
  getTabComponent,
  resolveTabRenderer,
  hasTabComponent,

  // Types
  type TabProps,
  type TabComponent,

  // Guards
  isStyleTab,
  isDataTab,
  isAxesTab,
  isSeriesTab,
  isLabelsTab,
  isStatisticsTab,
  isNodesTab,
  isRegressionTab,
  isThresholdsTab,
  isWordsTab,
  isHierarchyTab,
  isLayoutTab,
  createTabGuard,
} from './tabs';
