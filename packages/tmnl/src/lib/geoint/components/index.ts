// =============================================================================
// GEOINT Components - Barrel Export
// =============================================================================

export {
  GeointMap,
  GeointMapPositioned,
  geointRegistry,
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

// Results Panel - Virtualized results display
export {
  ResultsPanel,
  type ResultsPanelProps,
  type ViewMode,
} from './ResultsPanel'

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
