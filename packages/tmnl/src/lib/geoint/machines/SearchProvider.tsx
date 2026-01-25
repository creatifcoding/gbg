/**
 * SearchProvider - XState + effect-atom Integration
 *
 * Bridges the searchMachine with effect-atom for reactive state:
 * - Machine state synced to atoms for React consumption
 * - Streaming search results pushed to resultsAtom
 * - Per-source status tracking via sourceStatusesAtom
 * - Debounced viewport search integration
 *
 * @module geoint/machines/SearchProvider
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import { useMachine } from '@xstate/react'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { RegistryContext, useAtomValue } from '@effect-atom/atom-react'
import { searchMachine, type SourceStatus } from './searchMachine'
import type { IntelSource, BBox, SearchResultItem } from '../schemas'

// =============================================================================
// ATOMS
// =============================================================================

/** Search query text */
export const searchQueryAtom = Atom.make<string>('')

/** Current search bounds */
export const searchBoundsAtom = Atom.make<BBox | null>(null)

/** Enabled sources */
export const searchSourcesAtom = Atom.make<readonly IntelSource[]>([
  'track',
  'osm',
  'opensky',
  'feature',
])

/** Search results (populated by streaming) */
export const searchResultsAtom = Atom.make<readonly SearchResultItem[]>([])

/** Results grouped by source */
export const resultsBySourceAtom = Atom.make((get) => {
  const results = get(searchResultsAtom)
  const grouped = new Map<IntelSource, SearchResultItem[]>()

  for (const result of results) {
    const source = result.source
    const existing = grouped.get(source) ?? []
    existing.push(result)
    grouped.set(source, existing)
  }

  return grouped
})

/** Per-source status tracking */
export const sourceStatusesAtom = Atom.make<Record<IntelSource, SourceStatus>>(
  {} as Record<IntelSource, SourceStatus>
)

/** Search progress */
export const searchProgressAtom = Atom.make<{
  totalSources: number
  completedSources: number
  totalResults: number
  percentage: number
}>({
  totalSources: 0,
  completedSources: 0,
  totalResults: 0,
  percentage: 0,
})

/** Current search state */
export const searchStateAtom = Atom.make<
  'idle' | 'debouncing' | 'searching' | 'results' | 'error'
>('idle')

/** Search error message */
export const searchErrorAtom = Atom.make<string | null>(null)

/** Selected result IDs (using array for simpler typing) */
export const selectedResultIdsAtom = Atom.make<readonly string[]>([])

/** Hovered result ID */
export const hoveredResultIdAtom = Atom.make<string | null>(null)

/** Result count by source (derived) */
export const sourceCountsAtom = Atom.make((get) => {
  const statuses = get(sourceStatusesAtom)
  return Object.fromEntries(
    Object.entries(statuses).map(([source, status]) => [source, status.resultCount])
  ) as Record<IntelSource, number>
})

// =============================================================================
// REGISTRY
// =============================================================================

export const searchRegistry = Registry.make()

// =============================================================================
// CONTEXT
// =============================================================================

type SearchState = 'idle' | 'debouncing' | 'searching' | 'results' | 'error'

/** Search filters interface (matches searchMachine.SearchFilters) */
export interface SearchFilters {
  minConfidence: number
  maxAgeHours: number | null
  classifications: string[]
  entityTypes: string[]
}

export interface SearchProviderContextValue {
  /** Current machine state name */
  stateName: SearchState
  /** Is currently searching */
  isSearching: boolean
  /** Has results */
  hasResults: boolean

  // Actions
  search: () => void
  cancel: () => void
  clear: () => void
  setQuery: (query: string) => void
  setBounds: (bounds: BBox | null) => void
  toggleSource: (source: IntelSource) => void
  setSources: (sources: IntelSource[]) => void
  setFilters: (filters: Partial<SearchFilters>) => void
  onViewportChange: (bounds: BBox) => void

  // Streaming handlers
  pushResults: (results: readonly SearchResultItem[]) => void
  sourceStarted: (source: IntelSource) => void
  sourceProgress: (source: IntelSource, count: number) => void
  sourceComplete: (source: IntelSource, count: number) => void
  sourceError: (source: IntelSource, error: string) => void
  searchComplete: (totalResults: number) => void
  searchError: (error: string) => void
}

const SearchProviderContext = createContext<SearchProviderContextValue | null>(null)

export const useSearch = () => {
  const ctx = useContext(SearchProviderContext)
  if (!ctx) throw new Error('useSearch must be used within SearchProvider')
  return ctx
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

export interface SearchProviderProps {
  initialQuery?: string
  initialBounds?: BBox | null
  initialSources?: IntelSource[]
  autoSearch?: boolean
  children: ReactNode
}

export const SearchProvider: FC<SearchProviderProps> = ({
  initialQuery = '',
  initialBounds = null,
  initialSources = ['track', 'osm', 'opensky', 'feature'],
  autoSearch = true,
  children,
}) => {
  const [state, send] = useMachine(searchMachine, {
    input: {
      query: initialQuery,
      bounds: initialBounds,
      sources: initialSources,
      options: {
        autoSearch,
        debounceMs: 300,
        sourceTimeoutMs: 30000,
        maxResultsPerSource: 500,
      },
    },
  })

  // Derive state name
  const stateName = (typeof state.value === 'string' ? state.value : 'idle') as SearchState

  // Sync machine context to atoms
  useEffect(() => {
    const ctx = state.context
    searchRegistry.set(searchQueryAtom, ctx.query)
    searchRegistry.set(searchBoundsAtom, ctx.bounds)
    searchRegistry.set(searchSourcesAtom, ctx.sources)
    searchRegistry.set(sourceStatusesAtom, ctx.sourceStatuses)
    searchRegistry.set(searchProgressAtom, ctx.progress)
    searchRegistry.set(searchErrorAtom, ctx.error)
    searchRegistry.set(searchStateAtom, stateName)
  }, [state.context, stateName])

  // Actions
  const search = useCallback(() => send({ type: 'SEARCH' }), [send])
  const cancel = useCallback(() => send({ type: 'CANCEL' }), [send])

  const clear = useCallback(() => {
    send({ type: 'CLEAR' })
    searchRegistry.set(searchResultsAtom, [])
    searchRegistry.set(selectedResultIdsAtom, [])
  }, [send])

  const setQuery = useCallback((query: string) => send({ type: 'SET_QUERY', query }), [send])
  const setBounds = useCallback(
    (bounds: BBox | null) => send({ type: 'SET_BOUNDS', bounds }),
    [send]
  )
  const toggleSource = useCallback(
    (source: IntelSource) => send({ type: 'TOGGLE_SOURCE', source }),
    [send]
  )
  const setSources = useCallback(
    (sources: IntelSource[]) => send({ type: 'SET_SOURCES', sources }),
    [send]
  )
  const setFilters = useCallback(
    (filters: Partial<SearchFilters>) => send({ type: 'SET_FILTERS', filters }),
    [send]
  )
  const onViewportChange = useCallback(
    (bounds: BBox) => send({ type: 'VIEWPORT_CHANGED', bounds }),
    [send]
  )

  // Streaming handlers
  const pushResults = useCallback((results: readonly SearchResultItem[]) => {
    const current = searchRegistry.get(searchResultsAtom)
    searchRegistry.set(searchResultsAtom, [...current, ...results])
  }, [])

  const sourceStarted = useCallback(
    (source: IntelSource) => send({ type: 'SOURCE_STARTED', source }),
    [send]
  )
  const sourceProgress = useCallback(
    (source: IntelSource, resultCount: number) =>
      send({ type: 'SOURCE_PROGRESS', source, resultCount }),
    [send]
  )
  const sourceComplete = useCallback(
    (source: IntelSource, resultCount: number) =>
      send({ type: 'SOURCE_COMPLETE', source, resultCount }),
    [send]
  )
  const sourceError = useCallback(
    (source: IntelSource, error: string) => send({ type: 'SOURCE_ERROR', source, error }),
    [send]
  )
  const searchComplete = useCallback(
    (totalResults: number) => send({ type: 'SEARCH_COMPLETE', totalResults }),
    [send]
  )
  const searchError = useCallback(
    (error: string) => send({ type: 'SEARCH_ERROR', error }),
    [send]
  )

  const value = useMemo<SearchProviderContextValue>(
    () => ({
      stateName,
      isSearching: stateName === 'searching' || stateName === 'debouncing',
      hasResults: stateName === 'results',
      search,
      cancel,
      clear,
      setQuery,
      setBounds,
      toggleSource,
      setSources,
      setFilters,
      onViewportChange,
      pushResults,
      sourceStarted,
      sourceProgress,
      sourceComplete,
      sourceError,
      searchComplete,
      searchError,
    }),
    [
      stateName,
      search,
      cancel,
      clear,
      setQuery,
      setBounds,
      toggleSource,
      setSources,
      setFilters,
      onViewportChange,
      pushResults,
      sourceStarted,
      sourceProgress,
      sourceComplete,
      sourceError,
      searchComplete,
      searchError,
    ]
  )

  return (
    <RegistryContext.Provider value={searchRegistry as any}>
      <SearchProviderContext.Provider value={value}>
        {children}
      </SearchProviderContext.Provider>
    </RegistryContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/** Get current search query from atom */
export const useSearchQuery = () => useAtomValue(searchQueryAtom)

/** Get current search bounds from atom */
export const useSearchBounds = () => useAtomValue(searchBoundsAtom)

/** Get enabled sources from atom */
export const useSearchSources = () => useAtomValue(searchSourcesAtom)

/** Get search results from atom */
export const useSearchResults = () => useAtomValue(searchResultsAtom)

/** Get results grouped by source */
export const useResultsBySource = () => useAtomValue(resultsBySourceAtom)

/** Get source statuses from atom */
export const useSourceStatuses = () => useAtomValue(sourceStatusesAtom)

/** Get search progress from atom */
export const useSearchProgress = () => useAtomValue(searchProgressAtom)

/** Get current search state from atom */
export const useSearchState = () => useAtomValue(searchStateAtom)

/** Get search error from atom */
export const useSearchError = () => useAtomValue(searchErrorAtom)

/** Get selected result IDs */
export const useSelectedResultIds = () => useAtomValue(selectedResultIdsAtom)

/** Get hovered result ID */
export const useHoveredResultId = () => useAtomValue(hoveredResultIdAtom)

/** Get result counts by source */
export const useSourceCounts = () => useAtomValue(sourceCountsAtom)

/** Selection operations */
export const useResultSelection = () => {
  const select = useCallback((id: string) => {
    const current = searchRegistry.get(selectedResultIdsAtom)
    if (!current.includes(id)) {
      searchRegistry.set(selectedResultIdsAtom, [...current, id])
    }
  }, [])

  const deselect = useCallback((id: string) => {
    const current = searchRegistry.get(selectedResultIdsAtom)
    searchRegistry.set(
      selectedResultIdsAtom,
      current.filter((x) => x !== id)
    )
  }, [])

  const toggle = useCallback((id: string) => {
    const current = searchRegistry.get(selectedResultIdsAtom)
    if (current.includes(id)) {
      searchRegistry.set(
        selectedResultIdsAtom,
        current.filter((x) => x !== id)
      )
    } else {
      searchRegistry.set(selectedResultIdsAtom, [...current, id])
    }
  }, [])

  const clearSelection = useCallback(() => {
    searchRegistry.set(selectedResultIdsAtom, [])
  }, [])

  const selectAll = useCallback(() => {
    const results = searchRegistry.get(searchResultsAtom)
    const ids = results.map((r) => getResultId(r))
    searchRegistry.set(selectedResultIdsAtom, ids)
  }, [])

  return { select, deselect, toggle, clearSelection, selectAll }
}

/** Hover operations */
export const useResultHover = () => {
  const setHovered = useCallback((id: string | null) => {
    searchRegistry.set(hoveredResultIdAtom, id)
  }, [])

  return setHovered
}

// =============================================================================
// HELPERS
// =============================================================================

function getResultId(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultPoi':
      return result.poiId
    case 'SearchResultTrack':
      return result.trackId
    case 'SearchResultFlight':
      return result.icao24
    case 'SearchResultFeature':
      return result.featureId
    case 'SearchResultWeather':
      return result.id
    case 'SearchResultImagery':
      return result.itemId
  }
}

// =============================================================================
// REGISTRY PROVIDER (for external use)
// =============================================================================

export function SearchRegistryProvider({ children }: { children: ReactNode }) {
  return (
    <RegistryContext.Provider value={searchRegistry as any}>
      {children}
    </RegistryContext.Provider>
  )
}
