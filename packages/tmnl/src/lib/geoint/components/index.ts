// =============================================================================
// GEOINT Components - Barrel Export
// =============================================================================

export {
  GeointMap,
  GeointMapPositioned,
  mapOverlayRegistry,
  createGeointInstanceAtoms,
  disposeGeointInstanceAtoms,
  positioningOps,
  type GeointMapProps,
  type GeointLayerVisibility,
  type FlyToTarget,
} from './GeointMap'

export {
  LayerPalette,
  LayerToggle,
  type LayerPaletteProps,
  type LayerToggleProps,
} from './LayerPalette'

export {
  IntelSummaryPanel,
  type IntelSummaryPanelProps,
} from './IntelSummaryPanel'

// Search Panel - ALLINT COP UI
export {
  SearchPanel,
  type SearchPanelProps,
} from './SearchPanel'

// Compound Search Panel - Composable search interface
export {
  SearchPanelCompound,
  SearchPanelRoot,
  SearchPanelInput,
  SearchPanelSourceToggles,
  SearchPanelTimeRange,
  SearchPanelStatusBar,
  SearchPanelResults,
  SearchPanelActions,
  SearchPanelCollapsibleSection,
  useSearchPanel,
  type SearchPanelRootProps,
  type SearchPanelInputProps,
  type SearchPanelSourceTogglesProps,
  type SearchPanelTimeRangeProps,
  type SearchPanelStatusBarProps,
  type SearchPanelResultsProps,
  type SearchPanelActionsProps,
  type SearchPanelCollapsibleSectionProps,
} from './SearchPanelCompound'

// Results Panel - Virtualized results display
export {
  ResultsPanel,
  type ResultsPanelProps,
  type ViewMode,
} from './ResultsPanel'

// Virtualized Search Results - High-performance list with animations
export {
  VirtualizedSearchResults,
  type VirtualizedSearchResultsProps,
} from './VirtualizedSearchResults'

// Viewport Search Hooks
export {
  useViewportSearch,
  useAutoViewportSearch,
  viewStateToBBox,
  bboxEqual,
  getViewportBoundsAtom,
  type UseViewportSearchOptions,
  type UseViewportSearchResult,
} from './hooks/useViewportSearch'

// Radial Command Dial - Ctrl+Click entity actions
export {
  RadialCommandDial,
  useRadialDial,
  useCtrlClickDial,
  type RadialCommandDialProps,
  type UseRadialDialResult,
} from './RadialCommandDial'

// Entity Panel - Trait-based entity display
export {
  EntityPanelContent,
  openEntityPanel,
  openEntityPanelFromResults,
  useEntityPanel,
  entityPanelStateAtom,
  panelEntitiesAtom,
  type EntityPanelMode,
  type EntityPanelState,
  type EntityPanelContextValue,
} from './EntityPanel'

// Main Dashboard - Layout system with three variants
export {
  GeointDashboard,
  Dashboard,
  useDashboardContext,
  dashboardLayoutAtom,
  searchPanelOpenAtom,
  entityPanelOpenAtom,
  layerPaletteOpenAtom,
  compactModeAtom,
  type LayoutMode,
  type GeointDashboardProps,
  type DashboardContextValue,
} from './GeointDashboard'
