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
  // XState-enhanced version
  SearchPanelWithMachine,
  SearchPanelXStateRoot,
  SearchPanelXStateInput,
  SearchPanelXStateSection,
  useXStateSearchPanel,
  type SearchPanelRootProps,
  type SearchPanelInputProps,
  type SearchPanelSourceTogglesProps,
  type SearchPanelTimeRangeProps,
  type SearchPanelStatusBarProps,
  type SearchPanelResultsProps,
  type SearchPanelActionsProps,
  type SearchPanelCollapsibleSectionProps,
  type XStateSearchPanelContextValue,
  type SearchPanelWithMachineProps,
  type SearchPanelXStateInputProps,
  type SearchPanelXStateSectionProps,
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

// Virtualized Results List - @tanstack/react-virtual with anime.js animations
export {
  VirtualizedResultsList,
  VirtualizedResultsListRoot,
  VirtualizedResultsListHeader,
  VirtualizedResultsListRow,
  VirtualizedResultsListEmptyState,
  VirtualizedResultsListLoadingState,
  useVirtualizedResults,
  type SortField,
  type SortDirection,
  type SortConfig,
  type VirtualizedResultsContextValue,
  type VirtualizedResultsListRootProps,
  type HeaderProps as VirtualizedResultsHeaderProps,
  type RowProps as VirtualizedResultsRowProps,
  type EmptyStateProps as VirtualizedResultsEmptyStateProps,
  type LoadingStateProps as VirtualizedResultsLoadingStateProps,
} from './VirtualizedResultsList'

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

// Radial Command Dial - Ctrl+Click entity actions with XState gesture support
export {
  RadialCommandDial,
  useRadialDial,
  useCtrlClickDial,
  // XState-enhanced version with gesture detection
  RadialDialWithMachine,
  RadialDialProvider,
  XStateRadialDial,
  useGestureDialTrigger,
  useXStateRadialDial,
  type RadialCommandDialProps,
  type UseRadialDialResult,
  // XState-enhanced types
  type XStateRadialDialContextValue,
  type RadialDialProviderProps,
  type XStateRadialDialProps,
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
  // XState-enhanced version with presets
  FilterBarWithMachine,
  FilterBarXStateRoot,
  FilterBarXStateSourceChips,
  FilterBarXStateGroup,
  FilterBarXStateActiveSummary,
  FilterBarPresetSelector,
  useXStateFilterBar,
  type FilterBarState,
  type FilterBarContextValue,
  type FilterBarRootProps,
  type SourceChipsProps,
  type ClassificationChipsProps,
  type ConfidenceSliderProps,
  type BoundsIndicatorProps,
  type ActiveFilterSummaryProps,
  type CollapsibleFilterSectionProps,
  // XState-enhanced types
  type XStateFilterBarContextValue,
  type FilterBarWithMachineProps,
  type PresetSelectorProps as FilterPresetSelectorProps,
  type XStateGroupProps,
  type XStateActiveSummaryProps,
  type XStateSourceChipsProps,
} from './FilterBar'

// Layer Palette Compound - Enhanced layer control system
export {
  LayerPaletteCompound,
  LayerPaletteCompoundRoot,
  LayerPaletteHeader,
  LayerPaletteGroup,
  LayerPaletteLayerToggle,
  LayerPalettePresets,
  LayerPaletteQuickToggles,
  useLayerPalette,
  layerOpacitiesAtom,
  type PaletteLayerConfig,
  type LayerPreset,
  type LayerPaletteContextValue,
  type LayerPaletteRootProps,
  type HeaderProps,
  type GroupProps,
  type LayerToggleCompoundProps,
  type PresetsProps,
  type QuickTogglesProps,
} from './LayerPaletteCompound'

// Minimap - Navigation overview component
export {
  Minimap,
  type MinimapViewport,
  type MinimapBounds,
  type MinimapEntity,
  type MinimapProps,
} from './Minimap'

// Entity Detail Card - Comprehensive entity detail view
export {
  EntityDetailCard,
  EntityDetailCardRoot,
  EntityDetailCardHeader,
  EntityDetailCardTabNav,
  EntityDetailCardOverview,
  EntityDetailCardHistory,
  EntityDetailCardRelations,
  EntityDetailCardRawData,
  EntityDetailCardActionBar,
  useEntityDetail,
  type DetailTab,
  type EntityDetailContextValue,
  type EntityDetailCardRootProps,
  type EntityAttribute,
  type EntityEvent,
  type EntityRelation,
  type HeaderProps as EntityDetailHeaderProps,
  type TabNavProps,
  type OverviewProps,
  type HistoryProps,
  type RelationsProps,
  type RawDataProps,
  type ActionBarProps,
} from './EntityDetailCard'

// Multi-Select Action Bar - Batch operations on selected entities
export {
  MultiSelectActionBar,
  MultiSelectActionBarRoot,
  MultiSelectActionBarBadge,
  MultiSelectActionBarActions,
  MultiSelectActionBarAction,
  MultiSelectActionBarDivider,
  MultiSelectActionBarClearButton,
  MultiSelectActionBarSelectAllButton,
  MultiSelectActionBarMoreActions,
  useMultiSelect,
  createDefaultActions,
  type MultiSelectContextValue,
  type MultiSelectActionBarRootProps,
  type ActionProps as MultiSelectActionProps,
  type ActionsProps as MultiSelectActionsProps,
  type DividerProps as MultiSelectDividerProps,
  type BadgeProps as MultiSelectBadgeProps,
  type DefaultActionsConfig,
} from './MultiSelectActionBar'

// Spatial Query Panel - Visual polygon/radius search interface
export {
  SpatialQueryPanel,
  SpatialQueryPanelRoot,
  SpatialQueryPanelHeader,
  SpatialQueryPanelModeSelector,
  SpatialQueryPanelDrawControls,
  SpatialQueryPanelRadiusInput,
  SpatialQueryPanelBufferInput,
  SpatialQueryPanelSourceFilter,
  SpatialQueryPanelPreview,
  SpatialQueryPanelExecuteButton,
  useSpatialQuery,
  type DrawMode,
  type DrawStatus,
  type SpatialGeometry,
  type SpatialQueryContextValue,
  type SpatialQueryPanelRootProps,
  type HeaderProps as SpatialQueryHeaderProps,
  type ModeSelectorProps,
  type DrawControlsProps,
  type RadiusInputProps,
  type BufferInputProps,
  type SourceFilterProps,
  type PreviewProps as SpatialQueryPreviewProps,
  type ExecuteButtonProps,
} from './SpatialQueryPanel'

// Alert Panel - Real-time intel notifications
export {
  AlertPanel,
  AlertPanelRoot,
  AlertPanelHeader,
  AlertPanelAlertList,
  AlertPanelAlertItem,
  AlertPanelEmptyState,
  AlertPanelBadge,
  AlertPanelSettings,
  useAlertPanel,
  type AlertSeverity,
  type AlertCategory,
  type IntelAlert,
  type AlertPanelContextValue,
  type AlertPanelRootProps,
  type HeaderProps as AlertPanelHeaderProps,
  type AlertListProps,
  type AlertItemProps,
  type EmptyStateProps as AlertEmptyStateProps,
  type BadgeProps as AlertBadgeProps,
  type SettingsProps as AlertSettingsProps,
} from './AlertPanel'

// Correlation View - Entity relationship visualization
export {
  CorrelationView,
  CorrelationViewRoot,
  CorrelationViewGraph,
  CorrelationViewLegend,
  CorrelationViewControls,
  CorrelationViewDetailPanel,
  useCorrelationView,
  type RelationType,
  type CorrelationNode,
  type CorrelationEdge,
  type CorrelationViewContextValue,
  type CorrelationViewRootProps,
  type GraphProps,
  type LegendProps as CorrelationLegendProps,
  type ControlsProps as CorrelationControlsProps,
  type DetailPanelProps,
} from './CorrelationView'

// Keyboard Shortcuts Overlay - Which-key style shortcut display
export {
  KeyboardShortcutsOverlay,
  KeyboardShortcutsOverlayRoot,
  KeyboardShortcutsOverlayHeader,
  KeyboardShortcutsOverlaySearchInput,
  KeyboardShortcutsOverlayShortcutList,
  KeyboardShortcutsOverlayShortcutItem,
  useKeyboardShortcuts,
  GEOINT_SHORTCUTS,
  type ShortcutBinding,
  type ShortcutCategory,
  type KeyboardShortcutsContextValue,
  type KeyboardShortcutsOverlayRootProps,
  type HeaderProps as KeyboardShortcutsHeaderProps,
  type SearchInputProps,
  type ShortcutListProps,
  type ShortcutItemProps,
} from './KeyboardShortcutsOverlay'

// Measurement Tools - Distance, area, bearing measurement
export {
  MeasurementTools,
  MeasurementToolsRoot,
  MeasurementToolsModeSelector,
  MeasurementToolsUnitSelector,
  MeasurementToolsResults,
  MeasurementToolsHistory,
  useMeasurement,
  haversineDistance,
  calculatePathDistance,
  calculatePolygonArea,
  calculateBearing,
  convertDistance,
  convertArea,
  type MeasurementMode,
  type UnitSystem,
  type MeasurementPoint,
  type MeasurementResult,
  type MeasurementContextValue,
  type MeasurementToolsRootProps,
  type ModeSelectorProps as MeasurementModeSelectorProps,
  type UnitSelectorProps as MeasurementUnitSelectorProps,
  type ResultsProps as MeasurementResultsProps,
  type HistoryProps as MeasurementHistoryProps,
} from './MeasurementTools'

// Collection Manager - Entity watchlists and groups
export {
  CollectionManager,
  CollectionManagerRoot,
  CollectionManagerHeader,
  CollectionManagerCollectionList,
  CollectionManagerCollectionItem,
  CollectionManagerEntityList,
  CollectionManagerEntityItem,
  CollectionManagerCreateDialog,
  CollectionManagerAddToCollectionButton,
  useCollectionManager,
  collectionRegistry,
  collectionsAtom,
  selectedCollectionIdAtom,
  collectionSearchFilterAtom,
  selectedCollectionAtom,
  CollectionRegistryProvider,
  type CollectionType,
  type Collection,
  type CollectionContextValue,
  type CollectionManagerRootProps,
  type HeaderProps as CollectionManagerHeaderProps,
  type CollectionListProps,
  type CollectionItemProps,
  type EntityListProps as CollectionEntityListProps,
  type EntityItemProps as CollectionEntityItemProps,
  type CreateDialogProps as CollectionCreateDialogProps,
  type AddToCollectionButtonProps,
} from './CollectionManager'

// Track History Player - Entity movement playback
export {
  TrackHistoryPlayer,
  TrackHistoryPlayerRoot,
  TrackHistoryPlayerTimeline,
  TrackHistoryPlayerPlaybackControls,
  TrackHistoryPlayerPositionDisplay,
  TrackHistoryPlayerTrailConfig,
  useTrackHistory,
  type TrackPoint,
  type PlaybackSpeed,
  type TrackHistoryData,
  type TrackHistoryContextValue,
  type TrackHistoryPlayerRootProps,
  type TimelineProps as TrackHistoryTimelineProps,
  type PlaybackControlsProps as TrackHistoryPlaybackControlsProps,
  type PositionDisplayProps as TrackHistoryPositionDisplayProps,
  type TrailConfigProps as TrackHistoryTrailConfigProps,
} from './TrackHistoryPlayer'

// Live Feed Indicator - Real-time data stream status
export {
  LiveFeedIndicator,
  LiveFeedIndicatorRoot,
  LiveFeedIndicatorStatusBadge,
  LiveFeedIndicatorFeedList,
  LiveFeedIndicatorFeedItem,
  LiveFeedIndicatorMetrics,
  LiveFeedIndicatorGlobalControls,
  useLiveFeed,
  type FeedStatus,
  type LiveFeed,
  type LiveFeedContextValue,
  type LiveFeedIndicatorRootProps,
  type StatusBadgeProps as LiveFeedStatusBadgeProps,
  type FeedListProps as LiveFeedListProps,
  type FeedItemProps as LiveFeedItemProps,
  type MetricsProps as LiveFeedMetricsProps,
  type GlobalControlsProps as LiveFeedGlobalControlsProps,
} from './LiveFeedIndicator'

// Bookmarks Panel - Saved views and locations
export {
  BookmarksPanel,
  BookmarksPanelRoot,
  BookmarksPanelHeader,
  BookmarksPanelFolderList,
  BookmarksPanelBookmarkList,
  BookmarksPanelBookmarkItem,
  BookmarksPanelRecentLocations,
  BookmarksPanelCreateDialog,
  BookmarksPanelImportExport,
  useBookmarks,
  type ViewState,
  type LayerState,
  type MapBookmark,
  type BookmarkFolder,
  type RecentLocation,
  type BookmarksContextValue,
  type BookmarksPanelRootProps,
  type HeaderProps as BookmarksPanelHeaderProps,
  type FolderListProps as BookmarksPanelFolderListProps,
  type BookmarkListProps as BookmarksPanelBookmarkListProps,
  type BookmarkItemProps as BookmarksPanelBookmarkItemProps,
  type RecentLocationsProps as BookmarksPanelRecentLocationsProps,
  type CreateDialogProps as BookmarksPanelCreateDialogProps,
  type ImportExportProps as BookmarksPanelImportExportProps,
} from './BookmarksPanel'

// Export Panel - Data export with format options
export {
  ExportPanel,
  ExportPanelRoot,
  ExportPanelHeader,
  ExportPanelFormatSelector,
  ExportPanelEntityScope,
  ExportPanelFormatOptions,
  ExportPanelPreview,
  ExportPanelProgress,
  ExportPanelActions,
  useExport,
  type ExportFormat,
  type EntityScope,
  type ExportStatus,
  type GeoJSONOptions,
  type KMLOptions,
  type CSVOptions,
  type PNGOptions,
  type PDFOptions,
  type FormatOptions,
  type ExportConfig,
  type ExportResult,
  type ExportContextValue,
  type ExportPanelRootProps,
  type HeaderProps as ExportPanelHeaderProps,
  type FormatSelectorProps as ExportPanelFormatSelectorProps,
  type EntityScopeProps as ExportPanelEntityScopeProps,
  type FormatOptionsProps as ExportPanelFormatOptionsProps,
  type PreviewProps as ExportPanelPreviewProps,
  type ProgressProps as ExportPanelProgressProps,
  type ActionsProps as ExportPanelActionsProps,
} from './ExportPanel'

// Command Palette - M-x style global command search
export {
  CommandPalette,
  CommandPaletteProvider,
  useCommandPalette,
  commandPaletteRegistry,
  registeredCommandsAtom,
  paletteOpenAtom,
  paletteQueryAtom,
  recentCommandIdsAtom,
  createGeointCommands,
  type CommandCategory,
  type CommandItem,
  type CommandGroup,
  type CommandPaletteContextValue,
  type CommandPaletteProviderProps,
  type CommandPaletteRootProps,
  type CommandPaletteInputProps,
  type CommandPaletteListProps,
  type CommandPaletteFooterProps,
  type CommandPaletteTriggerProps,
} from './CommandPalette'

// Keyboard Provider - Unified keyboard system for GEOINT
export {
  GeointKeyboardProvider,
  useGeointKeyboard,
  createGeointKeyboardCommands,
  GEOINT_CATEGORIES,
  GEOINT_BINDINGS,
  type GeointCommand,
  type GeointKeyboardActions,
  type GeointKeyboardProviderProps,
} from './GeointKeyboardProvider'

// GeointShell - Layout orchestrator compound component
export {
  GeointShell,
  useGeointShell,
  type GeointShellProps,
  type HeaderProps as GeointShellHeaderProps,
  type SidebarProps as GeointShellSidebarProps,
  type MapProps as GeointShellMapProps,
  type IntelProps as GeointShellIntelProps,
  type TimelineProps as GeointShellTimelineProps,
  type AnalyticsTopProps as GeointShellAnalyticsTopProps,
  type AnalyticsBottomProps as GeointShellAnalyticsBottomProps,
} from './GeointShell'

// ImmersiveHUD - Full-screen immersive mode with glassmorphism overlays
export {
  ImmersiveHUD,
  useImmersiveHUD,
  type ImmersiveHUDRootProps,
  type QuickStatsProps as ImmersiveHUDQuickStatsProps,
  type AlertItem as ImmersiveHUDAlertItem,
  type AlertsOverlayProps as ImmersiveHUDAlertsProps,
  type EntityInfoOverlayProps as ImmersiveHUDEntityInfoProps,
  type MinimapOverlayProps as ImmersiveHUDMinimapProps,
  type TimelineOverlayProps as ImmersiveHUDTimelineProps,
  type CompassOverlayProps as ImmersiveHUDCompassProps,
  type CoordinatesOverlayProps as ImmersiveHUDCoordinatesProps,
  type ImmersiveHUDContextValue,
} from './ImmersiveHUD'

// SwimlaneTimeline - Temporal visualization with entity swimlanes
export {
  SwimlaneTimeline,
  useSwimlaneTimeline,
  type SwimlaneTimelineRootProps,
  type SwimlaneHeaderProps,
  type TimeAxisProps,
  type LaneListProps,
  type PlaybackControlsProps as SwimlanePlaybackControlsProps,
} from './SwimlaneTimeline'

// NetworkGraph - Entity relationship visualization with @xyflow/react
export {
  NetworkGraph,
  useNetworkGraph,
  type NetworkGraphRootProps,
  type CanvasProps as NetworkGraphCanvasProps,
  type ControlsProps as NetworkGraphControlsProps,
  type EdgeLegendProps as NetworkGraphEdgeLegendProps,
  type MinimapProps as NetworkGraphMinimapProps,
  type SearchInputProps as NetworkGraphSearchInputProps,
  type SelectionInfoProps as NetworkGraphSelectionInfoProps,
  type StatsOverlayProps as NetworkGraphStatsOverlayProps,
} from './NetworkGraph'

// SplitCompareView - Temporal comparison views
export {
  SplitCompareView,
  useSplitCompare,
  type SplitCompareRootProps,
  type PaneContainerProps as SplitComparePaneContainerProps,
  type LeftPaneProps as SplitCompareLeftPaneProps,
  type RightPaneProps as SplitCompareRightPaneProps,
  type SwipeHandleProps as SplitCompareSwipeHandleProps,
  type ControlsProps as SplitCompareControlsProps,
  type TimelineSelectorProps as SplitCompareTimelineSelectorProps,
  type DifferenceOverlayProps as SplitCompareDifferenceOverlayProps,
} from './SplitCompareView'

// MissionPlanner - Mission planning with objectives, waypoints, resources
export {
  MissionPlanner,
  useMissionPlanner,
} from './MissionPlanner'

// FusionView - Multi-source intelligence fusion and correlation
export {
  FusionView,
  useFusionView,
} from './FusionView'

// TemporalHeatmap - Activity density visualization over time
export {
  TemporalHeatmap,
  useTemporalHeatmap,
} from './TemporalHeatmap'
