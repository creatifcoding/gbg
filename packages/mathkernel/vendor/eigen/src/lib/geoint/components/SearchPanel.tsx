/**
 * SearchPanel - ALLINT COP Search UI Component
 *
 * Compound component for multi-source intelligence search with:
 * - cmdk-powered search input with autocomplete
 * - Source filter chips (OSM, OpenSky, ADS-B, etc.)
 * - Temporal filters (live, historical)
 * - Geographic filters (viewport, radius)
 * - Result summary and navigation
 * - VirtualizedSearchResults for high-performance result display
 *
 * @module geoint/components/SearchPanel
 */

import { useState, useCallback, memo, useRef, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { animate } from 'animejs'
import { Search, X, Loader2, Filter, MapPin, Plane, Building, Layers, Satellite, CloudSun, Radio } from 'lucide-react'
import { useSearchContextOptional } from './SearchProvider'
import { VirtualizedSearchResults } from './VirtualizedSearchResults'
import {
  searchStatusAtom,
  totalResultCountAtom,
  sourceCountsAtom,
  filteredResultsAtom,
  activeFiltersAtom,
  searchErrorAtom,
  updateFilters,
  viewportBoundsAtom,
} from '../atoms'
import type { IntelSource, SearchResultItem, BBox } from '../schemas'
import { SOURCE_COLORS, TIMING, EASING } from '../tokens'
import { cn } from '@/lib/utils'

// =============================================================================
// Constants
// =============================================================================

/** Maximum results to display before showing pagination */
const MAX_DISPLAY_RESULTS = 50

// =============================================================================
// Types
// =============================================================================

export interface SearchPanelProps {
  /** Instance ID for atom scoping */
  instanceId?: string
  /** Current viewport bounds [minLon, minLat, maxLon, maxLat] */
  viewportBounds?: readonly [number, number, number, number]
  /** Callback when search is executed */
  onSearch?: (bounds: BBox, sources: IntelSource[]) => void
  /** Callback when a result is selected */
  onResultSelect?: (result: SearchResultItem) => void
  /** Enable auto-search on viewport change */
  autoSearch?: boolean
  /** Additional CSS classes */
  className?: string
}

// =============================================================================
// Source Icons & Labels
// =============================================================================

const SOURCE_CONFIG: Record<IntelSource, { icon: typeof MapPin; label: string; description: string }> = {
  track: { icon: Radio, label: 'Tracks', description: 'Internal track system' },
  osm: { icon: Building, label: 'POI', description: 'OpenStreetMap POIs' },
  opensky: { icon: Plane, label: 'OpenSky', description: 'ADS-B flights' },
  feature: { icon: Layers, label: 'Features', description: 'Static features' },
  'adsb-lol': { icon: Plane, label: 'ADS-B', description: 'Community ADS-B' },
  planet: { icon: Satellite, label: 'Planet', description: 'Satellite imagery' },
  sentinel: { icon: Satellite, label: 'Sentinel', description: 'Copernicus data' },
  openmeteo: { icon: CloudSun, label: 'Weather', description: 'Open-Meteo weather' },
  custom: { icon: MapPin, label: 'Custom', description: 'User-defined sources' },
}

// =============================================================================
// Source Toggle Component
// =============================================================================

interface SourceToggleProps {
  source: IntelSource
  enabled: boolean
  count?: number
  onToggle: (source: IntelSource) => void
}

const SourceToggle = memo(function SourceToggle({
  source,
  enabled,
  count,
  onToggle,
}: SourceToggleProps) {
  const config = SOURCE_CONFIG[source]
  const colors = SOURCE_COLORS[source]
  const Icon = config.icon
  const chipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!chipRef.current) return
    animate(chipRef.current, {
      scale: enabled ? [0.95, 1] : 1,
      duration: TIMING.fast,
      easing: EASING.anime.out,
    })
  }, [enabled])

  return (
    <button
      ref={chipRef}
      onClick={() => onToggle(source)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        enabled
          ? 'ring-1'
          : 'bg-surface-2 text-foreground-tertiary hover:bg-surface-3'
      )}
      style={{
        backgroundColor: enabled ? colors.tailwind.bg : undefined,
        color: enabled ? colors.primary : undefined,
        borderColor: enabled ? colors.primary : undefined,
      }}
      title={config.description}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-surface-3 rounded text-xs">
          {count}
        </span>
      )}
    </button>
  )
})

// =============================================================================
// Search Panel Component
// =============================================================================

export const SearchPanel = memo(function SearchPanel({
  instanceId: _instanceId = 'default',
  viewportBounds: propViewportBounds,
  onSearch,
  onResultSelect,
  autoSearch = false,
  className,
}: SearchPanelProps) {
  // Get search context (optional - falls back to onSearch prop)
  const searchContext = useSearchContextOptional()

  // Local state
  const [searchText, setSearchText] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Atoms - get viewport from atom if not provided via props
  const atomViewportBounds = useAtomValue(viewportBoundsAtom)
  const viewportBounds = propViewportBounds ?? atomViewportBounds

  // Search state atoms
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(filteredResultsAtom)
  const resultsCount = useAtomValue(totalResultCountAtom)
  const sourceCounts = useAtomValue(sourceCountsAtom)
  const filters = useAtomValue(activeFiltersAtom)
  const error = useAtomValue(searchErrorAtom)

  // Compute isSearching from status
  const isSearching = status === 'searching' || status === 'validating'

  // Toggle source
  const handleToggleSource = useCallback((source: IntelSource) => {
    const current = filters.sources
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    updateFilters({ sources: updated })
  }, [filters.sources])

  // Execute search - uses context if available, otherwise falls back to onSearch prop
  const handleSearch = useCallback(() => {
    if (!viewportBounds) return
    const sources = filters.sources.length > 0
      ? filters.sources
      : (['track', 'osm', 'opensky', 'feature'] as IntelSource[])

    // Use context executeSearch if available (preferred)
    if (searchContext) {
      searchContext.executeSearch(viewportBounds as [number, number, number, number], [...sources])
    } else if (onSearch) {
      // Fallback to prop callback
      onSearch(viewportBounds as [number, number, number, number], [...sources])
    }
  }, [viewportBounds, filters.sources, searchContext, onSearch])

  // Handle result selection
  const handleResultSelect = useCallback(
    (result: SearchResultItem) => {
      onResultSelect?.(result)
    },
    [onResultSelect]
  )

  // Clear search
  const handleClear = useCallback(() => {
    setSearchText('')
  }, [])

  return (
    <div
      className={cn(
        'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Search Input */}
      <div className="flex items-center gap-2 p-3 border-b border-border-subtle">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search ALLINT COP..."
            className="w-full pl-8 pr-8 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchText && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'p-2 rounded-md transition-colors',
            showFilters
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
          )}
        >
          <Filter className="h-4 w-4" />
        </button>
        <button
          onClick={handleSearch}
          disabled={isSearching || !viewportBounds}
          className="px-3 py-2 bg-accent-primary text-text-inverse rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-primary/90 transition-colors"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Source Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 border-b border-border-subtle bg-surface-0">
          {(Object.keys(SOURCE_CONFIG) as IntelSource[]).map((source) => (
            <SourceToggle
              key={source}
              source={source}
              enabled={filters.sources.includes(source)}
              count={sourceCounts[source]}
              onToggle={handleToggleSource}
            />
          ))}
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-0 text-xs text-text-tertiary border-b border-border-subtle">
        <span>
          {status === 'idle' && 'Ready to search'}
          {status === 'searching' && 'Searching...'}
          {status === 'completed' && `${resultsCount} results found`}
          {status === 'error' && (
            <span className="text-status-error">Error: {error}</span>
          )}
        </span>
        {autoSearch && viewportBounds && (
          <span className="text-text-quaternary">Auto-search enabled</span>
        )}
      </div>

      {/* Results List - Using VirtualizedSearchResults from search subsystem */}
      <div className="flex-1 flex flex-col max-h-[400px]">
        {results.length === 0 && status === 'completed' ? (
          <div className="p-6 text-center text-text-tertiary text-sm">
            No results found in this area
          </div>
        ) : results.length > 0 ? (
          <>
            <VirtualizedSearchResults
              results={results.slice(0, MAX_DISPLAY_RESULTS)}
              onSelect={handleResultSelect}
              onActivate={handleResultSelect}
              height={360}
              animateEnter={true}
              staggerDelay={20}
            />
            {results.length > MAX_DISPLAY_RESULTS && (
              <div className="p-3 text-center text-text-tertiary text-xs border-t border-border-subtle">
                Showing {MAX_DISPLAY_RESULTS} of {resultsCount} results
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
})

// =============================================================================
// Exports
// =============================================================================

export default SearchPanel
