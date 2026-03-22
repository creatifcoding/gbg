/**
 * GEOINT Machines Module
 *
 * XState machines and providers for GEOINT dashboard state management.
 *
 * @module geoint/machines
 */

// Dashboard Machine
export {
  dashboardMachine,
  type DashboardContext,
  type DashboardEvent,
  type DashboardMachine,
  type DashboardSnapshot,
} from './dashboardMachine'

// Dashboard Provider (XState + effect-atom integration)
export {
  DashboardProvider,
  GeointRegistryProvider,
  useDashboard,
  useSearchResults,
  useResultsBySource,
  useSourceCounts,
  useSelectedEntity,
  useLayerVisibility,
  useDashboardState,
  // Note: Atoms are exported from ../atoms, not re-exported here to avoid conflicts
} from './DashboardProvider'

// Search Machine - Complex multi-source search workflow
export {
  searchMachine,
  type SearchFilters,
  type SourceStatus,
  type SearchProgress,
  type SearchOptions,
  type SearchContext,
  type SearchEvent as SearchMachineEvent,
  type SearchMachine,
  type SearchActor,
  type SearchSnapshot,
} from './searchMachine'

// Search Provider - XState + effect-atom integration
// Note: Some hooks renamed to avoid collision with DashboardProvider
export {
  SearchProvider,
  SearchRegistryProvider,
  useSearch,
  useSearchQuery,
  useSearchBounds,
  useSearchSources,
  useSearchResults as useSearchProviderResults,
  useResultsBySource as useSearchProviderResultsBySource,
  useSourceStatuses,
  useSearchProgress,
  useSearchState,
  useSearchError as useSearchProviderError,
  useSelectedResultIds,
  useHoveredResultId,
  useSourceCounts as useSearchProviderSourceCounts,
  useResultSelection,
  useResultHover,
  searchRegistry,
  searchQueryAtom,
  searchBoundsAtom,
  searchSourcesAtom,
  searchResultsAtom,
  resultsBySourceAtom,
  sourceStatusesAtom,
  searchProgressAtom,
  searchStateAtom,
  searchErrorAtom as searchProviderErrorAtom,
  selectedResultIdsAtom,
  hoveredResultIdAtom,
  sourceCountsAtom,
  type SearchProviderProps,
  type SearchProviderContextValue,
} from './SearchProvider'

// Layout Machine - Layout variant orchestration (command/focus/analytics)
export {
  layoutMachine,
  getInitialLayoutContext,
  type LayoutContext,
  type LayoutEvent,
  type LayoutMachineRef,
  type LayoutMachineSnapshot,
  type PanelStates,
  type FloatingPanelConfig,
  type AnimationPhase,
} from './layoutMachine'

// Note: LayoutMode type is exported from ./atoms/layoutAtoms (canonical source)
// Import directly: import { type LayoutMode } from '@/lib/geoint/atoms/layoutAtoms'

// Entity Detail Machine - Tab navigation with animations
export {
  entityDetailMachine,
  TAB_ORDER,
  getTabIndex,
  getTabByIndex,
  getNextTab,
  getPrevTab,
  type EntityDetailContext,
  type EntityDetailEvent,
  type EntityDetailEmittedEvent,
  type EntityDetailInput,
} from './entityDetailMachine'

// Search Form Machine - Form UI orchestration with suggestions
export {
  searchFormMachine,
  type FormSection,
  type ValidationStatus,
  type FormFieldState,
  type SearchFormContext,
  type SearchFormEvent,
  type SearchFormEmittedEvent,
  type SearchFormInput,
  type SearchFormMachine,
  type SearchFormSnapshot,
} from './searchFormMachine'

// Timeline Playback Machine - Temporal playback orchestration
export {
  timelinePlaybackMachine,
  SPEED_OPTIONS as TIMELINE_SPEED_OPTIONS,
  type TimelineSpeed,
  type LoopMode,
  type TimelineRange as TimelinePlaybackRange,
  type TimelinePlaybackContext,
  type TimelinePlaybackEvent,
  type TimelinePlaybackEmittedEvent,
  type TimelinePlaybackInput,
  type TimelinePlaybackMachine,
  type TimelinePlaybackSnapshot,
} from './timelineMachine'

// FilterBar Machine - Filter orchestration with presets
export {
  filterBarMachine,
  FILTER_PRESETS,
  FILTER_PRESET_MAP,
  type FilterPreset,
  type FilterGroup,
  type FilterPresetConfig,
  type FilterBarMachineContext,
  type FilterBarMachineEvent,
  type FilterBarEmittedEvent,
  type FilterBarMachineInput,
  type FilterBarMachine,
  type FilterBarMachineSnapshot,
} from './filterBarMachine'

// Radial Dial Machine - Gesture-based radial menu
export {
  radialDialMachine,
  SECTION_ORDER,
  type DialSection,
  type GestureType,
  type DialPosition,
  type RadialDialContext,
  type RadialDialEvent,
  type RadialDialEmittedEvent,
  type RadialDialInput,
  type RadialDialMachine,
  type RadialDialSnapshot,
} from './radialDialMachine'

// Immersive HUD Machine - Overlay orchestration for immersive mode
export {
  immersiveHudMachine,
  PRESET_CONFIGS,
  ALL_OVERLAYS,
  type HudOverlay,
  type HudPosition,
  type HudVisibility,
  type OverlayState,
  type EntityTrackingState,
  type ImmersiveHudContext,
  type ImmersiveHudEvent,
  type ImmersiveHudEmittedEvent,
  type ImmersiveHudInput,
  type ImmersiveHudMachine,
  type ImmersiveHudSnapshot,
} from './immersiveHudMachine'

// Swimlane Timeline Machine - Temporal swimlane orchestration
export {
  swimlaneMachine,
  ZOOM_LEVELS,
  ZOOM_DURATIONS,
  PLAYBACK_SPEEDS,
  type PlaybackState,
  type ZoomLevel,
  type TimeRange as SwimlaneTimeRange,
  type SwimlaneLane,
  type SwimlaneEvent,
  type SwimlaneContext,
  type SwimlaneEvent_Machine,
  type SwimlaneEmittedEvent,
  type SwimlaneInput,
  type SwimlaneMachine,
  type SwimlaneSnapshot,
} from './swimlaneMachine'

// Network Graph Machine - Entity relationship visualization
export {
  networkGraphMachine,
  LAYOUT_ALGORITHMS,
  EDGE_TYPES,
  EDGE_TYPE_COLORS,
  NODE_TYPE_COLORS,
  type LayoutAlgorithm,
  type NodeType,
  type EdgeType,
  type GraphNode,
  type GraphEdge,
  type GraphCluster,
  type ViewportState as NetworkGraphViewportState,
  type NetworkGraphContext,
  type NetworkGraphEvent,
  type NetworkGraphEmittedEvent,
  type NetworkGraphInput,
  type NetworkGraphMachine,
  type NetworkGraphSnapshot,
} from './networkGraphMachine'

// Split Compare Machine - Temporal comparison views
export {
  splitCompareMachine,
  COMPARE_MODES,
  FLICKER_SPEEDS,
  type CompareMode,
  type SyncMode,
  type PaneId,
  type TimePoint,
  type ViewportSync,
  type DifferenceHighlight,
  type PaneState,
  type SplitCompareContext,
  type SplitCompareEvent,
  type SplitCompareEmittedEvent,
  type SplitCompareInput,
  type SplitCompareMachine,
  type SplitCompareSnapshot,
} from './splitCompareMachine'

// Mission Planner Machine - Mission planning and objective tracking
export {
  missionPlannerMachine,
  PHASE_ORDER,
  WAYPOINT_COLORS,
  PRIORITY_WEIGHTS,
  type MissionPhase,
  type ObjectiveStatus,
  type ObjectivePriority,
  type WaypointType,
  type ResourceType,
  type ResourceStatus,
  type Objective,
  type Waypoint,
  type Resource,
  type MissionTimeline,
  type MissionPlannerContext,
  type MissionPlannerEvent,
  type MissionPlannerEmittedEvent,
  type MissionPlannerInput,
  type MissionPlannerMachine,
  type MissionPlannerSnapshot,
} from './missionPlannerMachine'

// Fusion View Machine - Multi-source intelligence fusion
export {
  fusionViewMachine,
  SOURCE_COLORS,
  SOURCE_NAMES,
  CORRELATION_TYPES,
  DEFAULT_SOURCES,
  getCorrelationStrength,
  getFusionConfidence,
  type FusionSource,
  type CorrelationType,
  type CorrelationStrength,
  type FusionConfidence,
  type SourceMetadata,
  type CorrelationPair,
  type FusedEntity,
  type FusionRule,
  type FusionViewContext,
  type FusionViewEvent,
  type FusionViewEmittedEvent,
  type FusionViewInput,
  type FusionViewMachine,
  type FusionViewSnapshot,
} from './fusionViewMachine'

// Heatmap Machine - Temporal heatmap analysis
export {
  heatmapMachine,
  RESOLUTION_DURATIONS,
  COLOR_SCHEMES,
  PLAYBACK_SPEEDS as HEATMAP_PLAYBACK_SPEEDS,
  type TemporalResolution,
  type ColorScheme,
  type AnalysisMode,
  type HotspotSeverity,
  type HeatmapCell,
  type Hotspot,
  type TemporalPattern,
  type HeatmapBounds,
  type TimeRange as HeatmapTimeRange,
  type HeatmapContext,
  type HeatmapEvent,
  type HeatmapEmittedEvent,
  type HeatmapInput,
  type HeatmapMachine,
  type HeatmapSnapshot,
} from './heatmapMachine'
