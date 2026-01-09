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

// Timeline Panel - Temporal filtering and playback
export {
  TimelinePanel,
  TimelinePanelRoot,
  TimelinePanelPlaybackControls,
  TimelinePanelBrushSelector,
  TimelinePanelPresetSelector,
  TimelinePanelRangeDisplay,
  TimelinePanelStatusIndicator,
  useTimeline,
  timelineRangeAtom,
  timelinePlayheadAtom,
  timelinePlayingAtom,
  timelineSpeedAtom,
  type TimelineRange,
  type TimelineContextValue,
  type TimelinePanelRootProps,
  type PlaybackControlsProps,
  type BrushSelectorProps,
  type PresetSelectorProps,
  type RangeDisplayProps,
  type StatusIndicatorProps,
} from './TimelinePanel'

// Stats Widget - Dashboard statistics components
export {
  StatsWidget,
  StatsWidgetRoot,
  StatsWidgetCounter,
  StatsWidgetBreakdown,
  StatsWidgetSourceBreakdown,
  StatsWidgetClassificationBreakdown,
  StatsWidgetSparkline,
  StatsWidgetStatusGrid,
  type StatsWidgetRootProps,
  type CounterProps,
  type BreakdownProps,
  type BreakdownItem,
  type SourceBreakdownProps,
  type ClassificationBreakdownProps,
  type SparklineProps,
  type StatusGridProps,
  type StatusGridItem,
} from './StatsWidget'

// Filter Bar - Advanced filtering compound component
export {
  FilterBar,
  FilterBarRoot,
  FilterBarSourceChips,
  FilterBarClassificationChips,
  FilterBarConfidenceSlider,
  FilterBarBoundsIndicator,
  FilterBarActiveSummary,
  FilterBarCollapsibleSection,
  useFilterBar,
  filterStateAtom,
  type FilterBarState,
  type FilterBarContextValue,
  type FilterBarRootProps,
  type SourceChipsProps,
  type ClassificationChipsProps,
  type ConfidenceSliderProps,
  type BoundsIndicatorProps,
  type ActiveFilterSummaryProps,
  type CollapsibleFilterSectionProps,
} from './FilterBar'
