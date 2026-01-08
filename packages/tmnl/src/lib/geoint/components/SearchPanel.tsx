/**
 * SearchPanel - ALLINT COP Search UI Component
 *
 * Provides search interface for the GEOINT map:
 * - Text search input
 * - Source filters (tracks, OSM, flights, features)
 * - Auto-search on viewport change
 * - Result summary and navigation
 *
 * Uses SearchService atoms for reactive state management.
 *
 * @see beads:tmnl-j5pyc ALLINT COP Search System
 * @module
 */

import { useState, useCallback, useMemo, memo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Search, X, Loader2, Filter, MapPin, Plane, Building, Layers } from 'lucide-react'
import {
  searchStatusAtom,
  allResultsAtom,
  resultsCountAtom,
  isSearchingAtom,
  searchErrorAtom,
  resultsBySourceAtom,
} from '../services/SearchService'
import type { IntelSource, SearchResultItem, BBox } from '../schemas'
import { cn } from '@/lib/utils'

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

const SOURCE_CONFIG: Record<IntelSource, { icon: typeof MapPin; label: string; color: string }> = {
  track: { icon: MapPin, label: 'Tracks', color: 'text-green-400' },
  osm: { icon: Building, label: 'POI', color: 'text-blue-400' },
  opensky: { icon: Plane, label: 'Flights', color: 'text-yellow-400' },
  feature: { icon: Layers, label: 'Features', color: 'text-purple-400' },
  adsb_lol: { icon: Plane, label: 'ADS-B', color: 'text-orange-400' },
  planet: { icon: MapPin, label: 'Satellite', color: 'text-cyan-400' },
  custom: { icon: MapPin, label: 'Custom', color: 'text-gray-400' },
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
  const Icon = config.icon

  return (
    <button
      onClick={() => onToggle(source)}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        enabled
          ? `bg-surface-3 ${config.color} border border-current/20`
          : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-surface-4 rounded text-[10px]">
          {count}
        </span>
      )}
    </button>
  )
})

// =============================================================================
// Result Item Component
// =============================================================================

interface ResultItemProps {
  result: SearchResultItem
  onSelect: (result: SearchResultItem) => void
}

const ResultItem = memo(function ResultItem({ result, onSelect }: ResultItemProps) {
  const config = SOURCE_CONFIG[result.source]
  const Icon = config.icon

  // Extract display info based on result type
  const displayInfo = useMemo(() => {
    switch (result._tag) {
      case 'SearchResultTrack':
        return {
          title: result.label || `Track ${result.trackId}`,
          subtitle: `${result.classification} • ${result.objectType}`,
        }
      case 'SearchResultPoi':
        return {
          title: result.name,
          subtitle: result.category,
        }
      case 'SearchResultFlight':
        return {
          title: result.callsign || result.icao24,
          subtitle: `${result.originCountry} • ${Math.round(result.velocity)} m/s`,
        }
      case 'SearchResultFeature':
        return {
          title: result.label || `Feature ${result.featureId}`,
          subtitle: result.geometryType,
        }
      default:
        return { title: 'Unknown', subtitle: '' }
    }
  }, [result])

  return (
    <button
      onClick={() => onSelect(result)}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-3 transition-colors text-left"
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">
          {displayInfo.title}
        </div>
        <div className="text-xs text-text-tertiary truncate">
          {displayInfo.subtitle}
        </div>
      </div>
      <div className="text-[10px] text-text-quaternary">
        {Math.round(result.score * 100)}%
      </div>
    </button>
  )
})

// =============================================================================
// Search Panel Component
// =============================================================================

export const SearchPanel = memo(function SearchPanel({
  instanceId: _instanceId = 'default',
  viewportBounds,
  onSearch,
  onResultSelect,
  autoSearch = false,
  className,
}: SearchPanelProps) {
  // Local state
  const [searchText, setSearchText] = useState('')
  const [enabledSources, setEnabledSources] = useState<Set<IntelSource>>(
    new Set(['track', 'osm', 'opensky', 'feature'])
  )
  const [showFilters, setShowFilters] = useState(false)

  // Atoms
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(allResultsAtom)
  const resultsCount = useAtomValue(resultsCountAtom)
  const isSearching = useAtomValue(isSearchingAtom)
  const error = useAtomValue(searchErrorAtom)
  const resultsBySource = useAtomValue(resultsBySourceAtom)

  // Get count per source
  const sourceCounts = useMemo(() => {
    const counts: Partial<Record<IntelSource, number>> = {}
    for (const [source, items] of resultsBySource) {
      counts[source] = items.length
    }
    return counts
  }, [resultsBySource])

  // Toggle source
  const handleToggleSource = useCallback((source: IntelSource) => {
    setEnabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }, [])

  // Execute search
  const handleSearch = useCallback(() => {
    if (!viewportBounds) return
    onSearch?.(viewportBounds as [number, number, number, number], Array.from(enabledSources))
  }, [viewportBounds, enabledSources, onSearch])

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
              enabled={enabledSources.has(source)}
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
            <span className="text-status-error">Error: {error?.message}</span>
          )}
        </span>
        {autoSearch && viewportBounds && (
          <span className="text-text-quaternary">Auto-search enabled</span>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-border-subtle">
        {results.length === 0 && status === 'completed' && (
          <div className="p-6 text-center text-text-tertiary text-sm">
            No results found in this area
          </div>
        )}
        {results.slice(0, 50).map((result, index) => (
          <ResultItem
            key={`${result._tag}-${result.id}-${index}`}
            result={result}
            onSelect={handleResultSelect}
          />
        ))}
        {results.length > 50 && (
          <div className="p-3 text-center text-text-tertiary text-xs">
            Showing 50 of {resultsCount} results
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// Exports
// =============================================================================

export default SearchPanel
