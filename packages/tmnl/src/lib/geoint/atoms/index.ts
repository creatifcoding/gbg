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
 */
export const viewportAtom = Atom.make<ViewportState>(DEFAULT_VIEWPORT)

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
 */
export const searchStatusAtom = Atom.make<SearchStatus>('idle')

/**
 * Current search query (null when no active search).
 */
export const searchQueryAtom = Atom.make<SearchQuery | null>(null)

/**
 * Error message from last search failure.
 */
export const searchErrorAtom = Atom.make<string | null>(null)

/**
 * Last search timestamp.
 */
export const lastSearchTimeAtom = Atom.make<number | null>(null)

// =============================================================================
// RESULTS STATE
// =============================================================================

/**
 * All search results from the last search.
 */
export const resultsAtom = Atom.make<readonly SearchResultItem[]>([])

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
 */
export const selectedResultAtom = Atom.make<SearchResultItem | null>(null)

/**
 * Hovered result (for highlighting on map).
 */
export const hoveredResultAtom = Atom.make<SearchResultItem | null>(null)

/**
 * Multi-selection for batch operations.
 */
export const selectedResultsAtom = Atom.make<readonly SearchResultItem[]>([])

// =============================================================================
// FILTER STATE
// =============================================================================

export interface ActiveFilters {
  readonly sources: readonly IntelSource[]
  readonly textQuery: string
  readonly geoFilter: 'viewport' | 'radius' | 'polygon'
  readonly radiusKm: number
  readonly temporalFilter: 'live' | 'lastHour' | 'last24h' | 'custom'
}

const DEFAULT_FILTERS: ActiveFilters = {
  sources: [],
  textQuery: '',
  geoFilter: 'viewport',
  radiusKm: 50,
  temporalFilter: 'live',
}

/**
 * Active filter configuration.
 */
export const activeFiltersAtom = Atom.make<ActiveFilters>(DEFAULT_FILTERS)

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
 */
export const layerVisibilityAtom = Atom.make<LayerVisibility>(DEFAULT_LAYER_VISIBILITY)

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
 */
export const layerOpacityAtom = Atom.make<LayerOpacity>(DEFAULT_LAYER_OPACITY)

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
 */
export const panelStateAtom = Atom.make<PanelState>(DEFAULT_PANEL_STATE)

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
 */
export const streamingStateAtom = Atom.make<StreamingState>(DEFAULT_STREAMING_STATE)

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
