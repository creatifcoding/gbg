/**
 * GEOINT Dashboard Atoms
 *
 * Reactive state management for the All-Source Intelligence COP dashboard.
 * Uses effect-atom with registry pattern for cross-component state sharing.
 *
 * Pattern: Source atoms (writable) + Derived atoms (computed)
 * Registry for sync mutations, Atom.set/get for Effect operations.
 *
 * @module geoint/atoms
 */

import { Atom, Registry } from '@effect-atom/atom'
import { HashMap, pipe, Option, Array as Arr } from 'effect'
import type {
  SearchResultItem,
  IntelSource,
  SearchQuery,
} from '../schemas'

// =============================================================================
// REGISTRY
// =============================================================================

/**
 * Global registry for GEOINT dashboard state.
 * Use `registry.get/set` in React callbacks, `Atom.get/set` inside Effect.gen().
 */
export const geointRegistry = Registry.make()

// =============================================================================
// ATOM FAMILIES (Panel-Scoped State)
// =============================================================================

// Re-export atom families and context for panel-scoped state
export * from './families'
export * from '../context'

import {
  type PanelId,
  asPanelId,
  viewportFamily,
  searchStatusFamily,
  searchQueryFamily,
  searchErrorFamily,
  searchTypedErrorFamily,
  searchRetryCountFamily,
  lastSearchTimeFamily,
  resultsFamily,
  selectedResultFamily,
  hoveredResultFamily,
  selectedResultsFamily,
  activeFiltersFamily,
  layerVisibilityFamily,
  layerOpacityFamily,
  panelStateFamily,
  streamingStateFamily,
  timelinePlaybackFamily,
} from './families'

// =============================================================================
// BACKWARD COMPATIBILITY LAYER
// =============================================================================

/**
 * Default panel ID for backward compatibility.
 * Used by legacy code that doesn't use panel context.
 *
 * @internal
 */
export const DEFAULT_PANEL_ID: PanelId = asPanelId('__default__')

// =============================================================================
// VIEWPORT STATE
// =============================================================================

export interface ViewportState {
  readonly longitude: number
  readonly latitude: number
  readonly zoom: number
  readonly pitch: number
  readonly bearing: number
}

const DEFAULT_VIEWPORT: ViewportState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

/**
 * Current map viewport state.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 * This global atom maps to the default panel for backward compatibility.
 *
 * Migration:
 * ```tsx
 * // Old
 * const viewport = useAtomValue(viewportAtom)
 *
 * // New
 * const { atoms } = useGeointPanel()
 * const viewport = useAtomValue(atoms.viewportAtom)
 * ```
 */
export const viewportAtom = viewportFamily(DEFAULT_PANEL_ID)

/**
 * Derived bounding box from viewport as [minLon, minLat, maxLon, maxLat].
 */
export const viewportBoundsAtom = Atom.make((get): readonly [number, number, number, number] => {
  const { longitude, latitude, zoom } = get(viewportAtom)
  // Approximate bounds calculation based on zoom level
  const latDelta = 180 / Math.pow(2, zoom)
  const lonDelta = 360 / Math.pow(2, zoom)
  return [
    longitude - lonDelta / 2,
    latitude - latDelta / 2,
    longitude + lonDelta / 2,
    latitude + latDelta / 2,
  ] as const
})

// =============================================================================
// SEARCH STATE
// =============================================================================

export type SearchStatus = 'idle' | 'validating' | 'searching' | 'completed' | 'error'

/**
 * Current search status.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const searchStatusAtom = searchStatusFamily(DEFAULT_PANEL_ID)

/**
 * Current search query (null when no active search).
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const searchQueryAtom = searchQueryFamily(DEFAULT_PANEL_ID)

/**
 * Error message from last search failure (string for display).
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const searchErrorAtom = searchErrorFamily(DEFAULT_PANEL_ID)

/**
 * Typed error from last search failure (for programmatic handling).
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 * @see SearchError discriminated union in schemas/errors.ts
 */
export const searchTypedErrorAtom = searchTypedErrorFamily(DEFAULT_PANEL_ID)

/**
 * Retry count for current error.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const searchRetryCountAtom = searchRetryCountFamily(DEFAULT_PANEL_ID)

/**
 * Maximum retries before giving up.
 */
export const MAX_SEARCH_RETRIES = 3

/**
 * Derived: Can retry the search (error is recoverable and retry count < max).
 */
export const canRetrySearchAtom = Atom.make((get): boolean => {
  const error = get(searchTypedErrorAtom)
  const retryCount = get(searchRetryCountAtom)
  return error !== null && error.recoverable && retryCount < MAX_SEARCH_RETRIES
})

/**
 * Last search timestamp.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const lastSearchTimeAtom = lastSearchTimeFamily(DEFAULT_PANEL_ID)

// =============================================================================
// RESULTS STATE
// =============================================================================

/**
 * All search results from the last search.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const resultsAtom = resultsFamily(DEFAULT_PANEL_ID)

/**
 * Results grouped by source for filtering/display.
 */
export const resultsBySourceAtom = Atom.make((get): HashMap.HashMap<IntelSource, readonly SearchResultItem[]> => {
  const results = get(resultsAtom)
  let grouped = HashMap.empty<IntelSource, SearchResultItem[]>()

  for (const result of results) {
    const existing = pipe(
      HashMap.get(grouped, result.source),
      Option.getOrElse(() => [] as SearchResultItem[])
    )
    grouped = HashMap.set(grouped, result.source, [...existing, result])
  }

  return grouped as HashMap.HashMap<IntelSource, readonly SearchResultItem[]>
})

/**
 * Count of results per source.
 */
export const sourceCountsAtom = Atom.make((get): Partial<Record<IntelSource, number>> => {
  const bySource = get(resultsBySourceAtom)
  const counts: Partial<Record<IntelSource, number>> = {}

  // Use HashMap.forEach instead of iteration
  HashMap.forEach(bySource, (items, source) => {
    counts[source] = items.length
  })

  return counts
})

/**
 * Total result count.
 */
export const totalResultCountAtom = Atom.make((get): number => {
  return get(resultsAtom).length
})

// =============================================================================
// SELECTION STATE
// =============================================================================

/**
 * Currently selected result (for details panel).
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const selectedResultAtom = selectedResultFamily(DEFAULT_PANEL_ID)

/**
 * Hovered result (for highlighting on map).
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const hoveredResultAtom = hoveredResultFamily(DEFAULT_PANEL_ID)

/**
 * Multi-selection for batch operations.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const selectedResultsAtom = selectedResultsFamily(DEFAULT_PANEL_ID)

// =============================================================================
// FILTER STATE
// =============================================================================

export interface TimeRange {
  readonly start: Date
  readonly end: Date
}

export interface ActiveFilters {
  readonly sources: readonly IntelSource[]
  readonly textQuery: string
  readonly geoFilter: 'viewport' | 'radius' | 'polygon'
  readonly radiusKm: number
  readonly temporalFilter: 'live' | 'lastHour' | 'last24h' | 'custom'
  /** Custom time range for 'custom' temporalFilter */
  readonly customTimeRange: TimeRange | null
}

const DEFAULT_FILTERS: ActiveFilters = {
  sources: [],
  textQuery: '',
  geoFilter: 'viewport',
  radiusKm: 50,
  temporalFilter: 'live',
  customTimeRange: null,
}

/**
 * Active filter configuration.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const activeFiltersAtom = activeFiltersFamily(DEFAULT_PANEL_ID)

/**
 * Get searchable text from a result item.
 */
const getSearchableText = (r: SearchResultItem): string => {
  switch (r._tag) {
    case 'SearchResultTrack':
      return `${r.trackId} ${r.classification}`
    case 'SearchResultPoi':
      return `${r.name} ${r.category}`
    case 'SearchResultFlight':
      return `${r.callsign ?? ''} ${r.icao24}`
    case 'SearchResultFeature':
      return `${r.featureId} ${r.geometryType}`
    case 'SearchResultWeather':
      return r.locationName ?? ''
    case 'SearchResultImagery':
      return `${r.provider} ${r.collection}`
    default:
      return ''
  }
}

/**
 * Get the retrievedAt timestamp from a result item.
 */
const getResultTimestamp = (r: SearchResultItem): Date => {
  return r.retrievedAt
}

/**
 * Calculate time range for temporal filter presets.
 */
const getTemporalFilterRange = (filter: ActiveFilters['temporalFilter'], customRange: TimeRange | null): TimeRange | null => {
  const now = new Date()
  switch (filter) {
    case 'live':
      // Live mode: no time filter (show all recent)
      return null
    case 'lastHour':
      return { start: new Date(now.getTime() - 60 * 60 * 1000), end: now }
    case 'last24h':
      return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now }
    case 'custom':
      return customRange
    default:
      return null
  }
}

/**
 * Filtered results based on active filters.
 */
export const filteredResultsAtom = Atom.make((get): readonly SearchResultItem[] => {
  const results = get(resultsAtom)
  const filters = get(activeFiltersAtom)

  let filtered = [...results]

  // Filter by sources
  if (filters.sources.length > 0) {
    filtered = filtered.filter((r) => filters.sources.includes(r.source))
  }

  // Filter by text query
  if (filters.textQuery.trim()) {
    const query = filters.textQuery.toLowerCase()
    filtered = filtered.filter((r) =>
      getSearchableText(r).toLowerCase().includes(query)
    )
  }

  // Filter by temporal range
  const timeRange = getTemporalFilterRange(filters.temporalFilter, filters.customTimeRange)
  if (timeRange) {
    filtered = filtered.filter((r) => {
      const timestamp = getResultTimestamp(r)
      return timestamp >= timeRange.start && timestamp <= timeRange.end
    })
  }

  return filtered
})

// =============================================================================
// LAYER VISIBILITY STATE
// =============================================================================

export interface LayerVisibility {
  readonly tracks: boolean
  readonly pois: boolean
  readonly flights: boolean
  readonly features: boolean
  readonly imagery: boolean
  readonly weather: boolean
  readonly heatmap: boolean
  readonly labels: boolean
}

const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  tracks: true,
  pois: true,
  flights: true,
  features: true,
  imagery: false,
  weather: false,
  heatmap: false,
  labels: true,
}

/**
 * Layer visibility state.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const layerVisibilityAtom = layerVisibilityFamily(DEFAULT_PANEL_ID)

export interface LayerOpacity {
  readonly tracks: number
  readonly pois: number
  readonly flights: number
  readonly features: number
  readonly imagery: number
  readonly weather: number
  readonly heatmap: number
}

const DEFAULT_LAYER_OPACITY: LayerOpacity = {
  tracks: 1,
  pois: 1,
  flights: 1,
  features: 1,
  imagery: 0.8,
  weather: 0.7,
  heatmap: 0.6,
}

/**
 * Layer opacity state.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const layerOpacityAtom = layerOpacityFamily(DEFAULT_PANEL_ID)

// =============================================================================
// PANEL STATE
// =============================================================================

export type PanelMode = 'collapsed' | 'default' | 'expanded'

export interface PanelState {
  readonly sidebar: PanelMode
  readonly intelPanel: PanelMode
  readonly detailsPanel: boolean
}

const DEFAULT_PANEL_STATE: PanelState = {
  sidebar: 'default',
  intelPanel: 'default',
  detailsPanel: false,
}

/**
 * Panel visibility and mode state.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const panelStateAtom = panelStateFamily(DEFAULT_PANEL_ID)

// =============================================================================
// STREAMING STATE
// =============================================================================

export interface StreamingState {
  readonly isStreaming: boolean
  readonly pendingCount: number
  readonly lastUpdate: number | null
}

const DEFAULT_STREAMING_STATE: StreamingState = {
  isStreaming: false,
  pendingCount: 0,
  lastUpdate: null,
}

/**
 * Real-time streaming state for live data feeds.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const streamingStateAtom = streamingStateFamily(DEFAULT_PANEL_ID)

// =============================================================================
// ACTIONS (Registry-based mutations)
// These are sync functions that use registry.get/set directly.
// =============================================================================

/**
 * Clear all search results and reset state.
 */
export const clearResults = () => {
  geointRegistry.set(resultsAtom, [])
  geointRegistry.set(selectedResultAtom, null)
  geointRegistry.set(hoveredResultAtom, null)
  geointRegistry.set(selectedResultsAtom, [])
  geointRegistry.set(searchStatusAtom, 'idle')
  geointRegistry.set(searchErrorAtom, null)
}

/**
 * Append new results (for streaming).
 */
export const appendResults = (newResults: readonly SearchResultItem[]) => {
  const current = geointRegistry.get(resultsAtom)
  geointRegistry.set(resultsAtom, [...current, ...newResults])
  const streamState = geointRegistry.get(streamingStateAtom)
  geointRegistry.set(streamingStateAtom, {
    ...streamState,
    lastUpdate: Date.now(),
  })
}

/**
 * Set results from search.
 */
export const setResults = (results: readonly SearchResultItem[]) => {
  geointRegistry.set(resultsAtom, results)
  geointRegistry.set(lastSearchTimeAtom, Date.now())
}

/**
 * Select a result and open details panel.
 */
export const selectResult = (result: SearchResultItem | null) => {
  geointRegistry.set(selectedResultAtom, result)
  if (result) {
    const current = geointRegistry.get(panelStateAtom)
    geointRegistry.set(panelStateAtom, {
      ...current,
      detailsPanel: true,
    })
  }
}

/**
 * Toggle layer visibility.
 */
export const toggleLayer = (layer: keyof LayerVisibility) => {
  const current = geointRegistry.get(layerVisibilityAtom)
  geointRegistry.set(layerVisibilityAtom, {
    ...current,
    [layer]: !current[layer],
  })
}

/**
 * Set layer opacity.
 */
export const setLayerOpacity = (layer: keyof LayerOpacity, opacity: number) => {
  const current = geointRegistry.get(layerOpacityAtom)
  geointRegistry.set(layerOpacityAtom, {
    ...current,
    [layer]: Math.max(0, Math.min(1, opacity)),
  })
}

/**
 * Update filters.
 */
export const updateFilters = (updates: Partial<ActiveFilters>) => {
  const current = geointRegistry.get(activeFiltersAtom)
  geointRegistry.set(activeFiltersAtom, {
    ...current,
    ...updates,
  })
}

/**
 * Reset filters to defaults.
 */
export const resetFilters = () => {
  geointRegistry.set(activeFiltersAtom, DEFAULT_FILTERS)
}

/**
 * Set custom time range for temporal filtering.
 * Automatically sets temporalFilter to 'custom'.
 */
export const setCustomTimeRange = (range: TimeRange) => {
  const current = geointRegistry.get(activeFiltersAtom)
  geointRegistry.set(activeFiltersAtom, {
    ...current,
    temporalFilter: 'custom',
    customTimeRange: range,
  })
}

/**
 * Set temporal filter preset.
 */
export const setTemporalFilter = (filter: ActiveFilters['temporalFilter']) => {
  const current = geointRegistry.get(activeFiltersAtom)
  geointRegistry.set(activeFiltersAtom, {
    ...current,
    temporalFilter: filter,
    // Clear custom range if not using custom
    customTimeRange: filter === 'custom' ? current.customTimeRange : null,
  })
}

/**
 * Fly to a specific location.
 */
export const flyTo = (lon: number, lat: number, zoom?: number) => {
  const current = geointRegistry.get(viewportAtom)
  geointRegistry.set(viewportAtom, {
    ...current,
    longitude: lon,
    latitude: lat,
    zoom: zoom ?? current.zoom,
  })
}

/**
 * Set search status.
 */
export const setSearchStatus = (status: SearchStatus) => {
  geointRegistry.set(searchStatusAtom, status)
}

/**
 * Set search error.
 */
export const setSearchError = (error: string | null) => {
  geointRegistry.set(searchErrorAtom, error)
}

/**
 * Update viewport state.
 */
export const setViewport = (viewport: Partial<ViewportState>) => {
  const current = geointRegistry.get(viewportAtom)
  geointRegistry.set(viewportAtom, {
    ...current,
    ...viewport,
  })
}

/**
 * Set panel state.
 */
export const setPanelState = (updates: Partial<PanelState>) => {
  const current = geointRegistry.get(panelStateAtom)
  geointRegistry.set(panelStateAtom, {
    ...current,
    ...updates,
  })
}

/**
 * Set streaming state.
 */
export const setStreamingState = (updates: Partial<StreamingState>) => {
  const current = geointRegistry.get(streamingStateAtom)
  geointRegistry.set(streamingStateAtom, {
    ...current,
    ...updates,
  })
}

// =============================================================================
// TIMELINE PLAYBACK ATOMS
// =============================================================================

export interface TimelinePlaybackState {
  /** Is timeline playback mode active */
  readonly enabled: boolean
  /** Current playhead position (for filtering) */
  readonly playhead: Date
  /** Visible time range */
  readonly range: TimeRange
  /** Window radius in ms (entities within ±window of playhead are visible) */
  readonly windowMs: number
  /** Is currently playing */
  readonly isPlaying: boolean
}

const DEFAULT_TIMELINE_PLAYBACK: TimelinePlaybackState = {
  enabled: false,
  playhead: new Date(),
  range: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  },
  windowMs: 5 * 60 * 1000, // 5 minute window by default
  isPlaying: false,
}

/**
 * Timeline playback state for temporal visualization.
 * When enabled, results are filtered to show only entities
 * within the playhead window.
 *
 * @deprecated Use panel-scoped atoms via `useGeointPanel()` instead.
 */
export const timelinePlaybackAtom = timelinePlaybackFamily(DEFAULT_PANEL_ID)

/**
 * Derived: Results filtered by timeline playhead (when timeline is enabled).
 * Layered on top of filteredResultsAtom.
 */
export const timelineFilteredResultsAtom = Atom.make((get): readonly SearchResultItem[] => {
  const baseResults = get(filteredResultsAtom)
  const timeline = get(timelinePlaybackAtom)

  // If timeline not enabled, return all filtered results
  if (!timeline.enabled) {
    return baseResults
  }

  // Filter by playhead window
  const playheadTime = timeline.playhead.getTime()
  const windowStart = playheadTime - timeline.windowMs
  const windowEnd = playheadTime + timeline.windowMs

  return baseResults.filter((r) => {
    const timestamp = getResultTimestamp(r).getTime()
    return timestamp >= windowStart && timestamp <= windowEnd
  })
})

/**
 * Enable/disable timeline playback mode.
 */
export const setTimelineEnabled = (enabled: boolean) => {
  const current = geointRegistry.get(timelinePlaybackAtom)
  geointRegistry.set(timelinePlaybackAtom, {
    ...current,
    enabled,
  })
}

/**
 * Update timeline playhead (called by TimelineControlsV2 onPlayheadChange).
 */
export const setTimelinePlayhead = (playhead: Date) => {
  const current = geointRegistry.get(timelinePlaybackAtom)
  geointRegistry.set(timelinePlaybackAtom, {
    ...current,
    playhead,
  })
}

/**
 * Set timeline range.
 */
export const setTimelineRange = (range: TimeRange) => {
  const current = geointRegistry.get(timelinePlaybackAtom)
  geointRegistry.set(timelinePlaybackAtom, {
    ...current,
    range,
  })
}

/**
 * Set timeline window size (how much time around playhead is visible).
 */
export const setTimelineWindow = (windowMs: number) => {
  const current = geointRegistry.get(timelinePlaybackAtom)
  geointRegistry.set(timelinePlaybackAtom, {
    ...current,
    windowMs,
  })
}

/**
 * Initialize timeline from search results (auto-detect time range).
 */
export const initTimelineFromResults = () => {
  const results = geointRegistry.get(resultsAtom)
  if (results.length === 0) return

  // Find min/max timestamps
  let minTime = Infinity
  let maxTime = -Infinity

  for (const r of results) {
    const timestamp = getResultTimestamp(r).getTime()
    if (timestamp < minTime) minTime = timestamp
    if (timestamp > maxTime) maxTime = timestamp
  }

  if (minTime === Infinity || maxTime === -Infinity) return

  // Set range with some padding
  const padding = (maxTime - minTime) * 0.1 || 60 * 60 * 1000 // 10% or 1 hour
  const range: TimeRange = {
    start: new Date(minTime - padding),
    end: new Date(maxTime + padding),
  }

  // Calculate appropriate window size (1% of range or 5 min, whichever is larger)
  const windowMs = Math.max((maxTime - minTime) * 0.01, 5 * 60 * 1000)

  geointRegistry.set(timelinePlaybackAtom, {
    enabled: true,
    playhead: new Date(maxTime), // Start at end
    range,
    windowMs,
    isPlaying: false,
  })
}

// =============================================================================
// LAYOUT ATOMS (Re-export from layoutAtoms.ts)
// =============================================================================

export * from './layoutAtoms'

// =============================================================================
// PANEL-SCOPED OPERATIONS
// =============================================================================

export * from './mapOperations'
