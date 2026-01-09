/**
 * SearchPanel Compound Components
 *
 * Composable search interface following compound component pattern:
 * - SearchPanel.Root - Container with context
 * - SearchPanel.Input - Query input with autocomplete
 * - SearchPanel.SourceToggles - Intel source filter chips
 * - SearchPanel.TimeRange - Temporal filter controls
 * - SearchPanel.Results - Virtualized results with animations
 * - SearchPanel.StatusBar - Status and summary display
 * - SearchPanel.Actions - Search action buttons
 *
 * @module geoint/components/SearchPanelCompound
 */

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  memo,
  type FC,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { animate } from 'animejs'
import {
  Search,
  X,
  Loader2,
  Filter,
  Clock,
  MapPin,
  Plane,
  Building,
  Layers,
  Satellite,
  CloudSun,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  searchStatusAtom,
  totalResultCountAtom,
  sourceCountsAtom,
  filteredResultsAtom,
  activeFiltersAtom,
  searchErrorAtom,
  updateFilters,
} from '../atoms'
import type { IntelSource, SearchResultItem, BBox } from '../schemas'
import { SOURCE_COLORS, TIMING, EASING } from '../tokens'
import { VirtualizedSearchResults } from './VirtualizedSearchResults'

// =============================================================================
// CONTEXT
// =============================================================================

interface SearchPanelContextValue {
  // Query state
  query: string
  setQuery: (query: string) => void

  // Source state
  enabledSources: IntelSource[]
  toggleSource: (source: IntelSource) => void
  setAllSources: (enabled: boolean) => void

  // UI state
  isExpanded: boolean
  toggleExpanded: () => void
  showFilters: boolean
  toggleFilters: () => void
  showTimeRange: boolean
  toggleTimeRange: () => void

  // Search actions
  executeSearch: () => void
  clearSearch: () => void
  isSearching: boolean

  // Results
  results: readonly SearchResultItem[]
  resultsCount: number
  error: string | null

  // Callbacks
  onResultSelect?: (result: SearchResultItem) => void
  onResultActivate?: (result: SearchResultItem) => void

  // Viewport
  viewportBounds?: BBox
}

const SearchPanelContext = createContext<SearchPanelContextValue | null>(null)

const useSearchPanel = () => {
  const ctx = useContext(SearchPanelContext)
  if (!ctx) throw new Error('useSearchPanel must be used within SearchPanel.Root')
  return ctx
}

// =============================================================================
// TYPES
// =============================================================================

export interface SearchPanelRootProps {
  /** Children components */
  children: ReactNode
  /** Current viewport bounds for search */
  viewportBounds?: BBox
  /** Callback when search is executed */
  onSearch?: (bounds: BBox, sources: IntelSource[]) => void
  /** Callback when a result is selected */
  onResultSelect?: (result: SearchResultItem) => void
  /** Callback when a result is activated (double-click/Enter) */
  onResultActivate?: (result: SearchResultItem) => void
  /** Additional CSS classes */
  className?: string
  /** Default expanded state */
  defaultExpanded?: boolean
}

// =============================================================================
// SOURCE CONFIG
// =============================================================================

const SOURCE_CONFIG: Record<IntelSource, { icon: typeof MapPin; label: string; description: string }> = {
  track: { icon: Radio, label: 'Tracks', description: 'Internal track system' },
  osm: { icon: Building, label: 'POI', description: 'OpenStreetMap POIs' },
  opensky: { icon: Plane, label: 'OpenSky', description: 'ADS-B flights' },
  feature: { icon: Layers, label: 'Features', description: 'Static features' },
  adsb_lol: { icon: Plane, label: 'ADS-B', description: 'Community ADS-B' },
  planet: { icon: Satellite, label: 'Planet', description: 'Satellite imagery' },
  sentinel: { icon: Satellite, label: 'Sentinel', description: 'Copernicus data' },
  weather: { icon: CloudSun, label: 'Weather', description: 'Open-Meteo weather' },
  custom: { icon: MapPin, label: 'Custom', description: 'User-defined sources' },
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<SearchPanelRootProps> = ({
  children,
  viewportBounds,
  onSearch,
  onResultSelect,
  onResultActivate,
  className,
  defaultExpanded = true,
}) => {
  // Local state
  const [query, setQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showFilters, setShowFilters] = useState(false)
  const [showTimeRange, setShowTimeRange] = useState(false)

  // Atom values
  const status = useAtomValue(searchStatusAtom)
  const results = useAtomValue(filteredResultsAtom)
  const resultsCount = useAtomValue(totalResultCountAtom)
  const sourceCounts = useAtomValue(sourceCountsAtom)
  const filters = useAtomValue(activeFiltersAtom)
  const error = useAtomValue(searchErrorAtom)

  const isSearching = status === 'searching' || status === 'validating'

  // Source toggle
  const toggleSource = useCallback((source: IntelSource) => {
    const current = [...filters.sources] as IntelSource[]
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    updateFilters({ sources: updated })
  }, [filters.sources])

  const setAllSources = useCallback((enabled: boolean) => {
    if (enabled) {
      updateFilters({ sources: Object.keys(SOURCE_CONFIG) as IntelSource[] })
    } else {
      updateFilters({ sources: [] })
    }
  }, [])

  // Execute search
  const executeSearch = useCallback(() => {
    if (!viewportBounds) return
    const sources: IntelSource[] = filters.sources.length > 0
      ? [...filters.sources]
      : ['track', 'osm', 'opensky', 'feature']
    onSearch?.(viewportBounds, sources)
  }, [viewportBounds, filters.sources, onSearch])

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('')
  }, [])

  // Context value
  const contextValue: SearchPanelContextValue = {
    query,
    setQuery,
    enabledSources: [...filters.sources],
    toggleSource,
    setAllSources,
    isExpanded,
    toggleExpanded: () => setIsExpanded(p => !p),
    showFilters,
    toggleFilters: () => setShowFilters(p => !p),
    showTimeRange,
    toggleTimeRange: () => setShowTimeRange(p => !p),
    executeSearch,
    clearSearch,
    isSearching,
    results,
    resultsCount,
    error,
    onResultSelect,
    onResultActivate,
    viewportBounds,
  }

  return (
    <SearchPanelContext.Provider value={contextValue}>
      <div
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </SearchPanelContext.Provider>
  )
}

// =============================================================================
// INPUT COMPONENT
// =============================================================================

interface InputProps {
  /** Placeholder text */
  placeholder?: string
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Show clear button */
  showClear?: boolean
  /** Additional className */
  className?: string
}

const Input: FC<InputProps> = memo(function Input({
  placeholder = 'Search ALLINT COP...',
  autoFocus = false,
  showClear = true,
  className,
}) {
  const { query, setQuery, executeSearch, clearSearch, isSearching } = useSearchPanel()
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      executeSearch()
    }
    if (e.key === 'Escape') {
      clearSearch()
    }
  }

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <div className="relative flex-1">
        {isSearching ? (
          <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-accent-primary animate-spin" />
        ) : (
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2 bg-surface-2 border border-border-subtle rounded-md text-sm text-text-primary placeholder:text-text-quaternary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-colors"
        />
        {showClear && query && (
          <button
            onClick={clearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// SOURCE TOGGLES COMPONENT
// =============================================================================

interface SourceTogglesProps {
  /** Which sources to show */
  sources?: IntelSource[]
  /** Compact mode */
  compact?: boolean
  /** Show counts */
  showCounts?: boolean
  /** Additional className */
  className?: string
}

const SourceToggles: FC<SourceTogglesProps> = memo(function SourceToggles({
  sources = Object.keys(SOURCE_CONFIG) as IntelSource[],
  compact = false,
  showCounts = true,
  className,
}) {
  const { enabledSources, toggleSource } = useSearchPanel()
  const sourceCounts = useAtomValue(sourceCountsAtom)

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {sources.map((source) => {
        const config = SOURCE_CONFIG[source]
        const colors = SOURCE_COLORS[source]
        const Icon = config.icon
        const enabled = enabledSources.includes(source)
        const count = sourceCounts[source] ?? 0

        return (
          <SourceChip
            key={source}
            source={source}
            icon={Icon}
            label={config.label}
            enabled={enabled}
            count={showCounts ? count : undefined}
            compact={compact}
            colors={colors}
            onToggle={() => toggleSource(source)}
          />
        )
      })}
    </div>
  )
})

interface SourceChipProps {
  source: IntelSource
  icon: typeof MapPin
  label: string
  enabled: boolean
  count?: number
  compact?: boolean
  colors: typeof SOURCE_COLORS[IntelSource]
  onToggle: () => void
}

const SourceChip: FC<SourceChipProps> = memo(function SourceChip({
  icon: Icon,
  label,
  enabled,
  count,
  compact,
  colors,
  onToggle,
}) {
  const chipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!chipRef.current) return
    animate(chipRef.current, {
      scale: enabled ? [0.95, 1] : 1,
      duration: TIMING.fast,
      ease: EASING.anime.out,
    })
  }, [enabled])

  return (
    <button
      ref={chipRef}
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors',
        compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
        enabled
          ? 'ring-1'
          : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
      )}
      style={{
        backgroundColor: enabled ? colors.tailwind.bg : undefined,
        color: enabled ? colors.primary : undefined,
        borderColor: enabled ? colors.primary : undefined,
      }}
    >
      <Icon className={cn(compact ? 'h-3 w-3' : 'h-4 w-4')} />
      {!compact && <span>{label}</span>}
      {count !== undefined && count > 0 && (
        <span className={cn(
          'px-1 bg-surface-3/50 rounded',
          compact ? 'text-[9px]' : 'text-[10px]'
        )}>
          {count}
        </span>
      )}
    </button>
  )
})

// =============================================================================
// TIME RANGE COMPONENT
// =============================================================================

interface TimeRangeProps {
  /** Additional className */
  className?: string
}

const TimeRange: FC<TimeRangeProps> = memo(function TimeRange({ className }) {
  const [timeMode, setTimeMode] = useState<'live' | 'historical'>('live')
  const [range, setRange] = useState<[Date, Date]>([
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    new Date(),
  ])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTimeMode('live')}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
            timeMode === 'live'
              ? 'bg-status-success/20 text-status-success'
              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
          )}
        >
          <div className={cn(
            'w-2 h-2 rounded-full',
            timeMode === 'live' ? 'bg-status-success animate-pulse' : 'bg-text-quaternary'
          )} />
          Live
        </button>
        <button
          onClick={() => setTimeMode('historical')}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
            timeMode === 'historical'
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
          )}
        >
          <Clock className="h-3 w-3" />
          Historical
        </button>
      </div>

      {timeMode === 'historical' && (
        <div className="flex items-center gap-2 text-xs">
          <input
            type="datetime-local"
            value={range[0].toISOString().slice(0, 16)}
            onChange={(e) => setRange([new Date(e.target.value), range[1]])}
            className="flex-1 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-text-primary"
          />
          <span className="text-text-tertiary">to</span>
          <input
            type="datetime-local"
            value={range[1].toISOString().slice(0, 16)}
            onChange={(e) => setRange([range[0], new Date(e.target.value)])}
            className="flex-1 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-text-primary"
          />
        </div>
      )}
    </div>
  )
})

// =============================================================================
// STATUS BAR COMPONENT
// =============================================================================

interface StatusBarProps {
  /** Show viewport indicator */
  showViewport?: boolean
  /** Additional className */
  className?: string
}

const StatusBar: FC<StatusBarProps> = memo(function StatusBar({
  showViewport = false,
  className,
}) {
  const { results, resultsCount, error, isSearching, viewportBounds } = useSearchPanel()
  const status = useAtomValue(searchStatusAtom)

  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-1.5 bg-surface-0 text-xs border-t border-border-subtle',
      className
    )}>
      <span className="text-text-tertiary">
        {status === 'idle' && 'Ready to search'}
        {status === 'searching' && 'Searching...'}
        {status === 'validating' && 'Validating...'}
        {status === 'completed' && `${resultsCount} results`}
        {error && <span className="text-status-error">Error: {error}</span>}
      </span>

      {showViewport && viewportBounds && (
        <span className="text-text-quaternary font-mono text-[10px]">
          {viewportBounds[0].toFixed(2)}, {viewportBounds[1].toFixed(2)}
        </span>
      )}
    </div>
  )
})

// =============================================================================
// RESULTS COMPONENT
// =============================================================================

interface ResultsProps {
  /** Max height */
  maxHeight?: number
  /** Show empty state */
  showEmpty?: boolean
  /** Additional className */
  className?: string
}

const Results: FC<ResultsProps> = memo(function Results({
  maxHeight = 400,
  showEmpty = true,
  className,
}) {
  const { results, onResultSelect, onResultActivate } = useSearchPanel()
  const status = useAtomValue(searchStatusAtom)

  if (results.length === 0 && status === 'completed' && showEmpty) {
    return (
      <div className={cn('p-6 text-center text-text-tertiary text-sm', className)}>
        No results found in this area
      </div>
    )
  }

  return (
    <VirtualizedSearchResults
      results={results}
      height={maxHeight}
      onSelect={onResultSelect}
      onActivate={onResultActivate}
      animateEnter
      staggerDelay={30}
      className={className}
    />
  )
})

// =============================================================================
// ACTIONS COMPONENT
// =============================================================================

interface ActionsProps {
  /** Show filter toggle */
  showFilterToggle?: boolean
  /** Show time toggle */
  showTimeToggle?: boolean
  /** Additional className */
  className?: string
}

const Actions: FC<ActionsProps> = memo(function Actions({
  showFilterToggle = true,
  showTimeToggle = false,
  className,
}) {
  const {
    executeSearch,
    isSearching,
    viewportBounds,
    showFilters,
    toggleFilters,
    showTimeRange,
    toggleTimeRange,
  } = useSearchPanel()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showFilterToggle && (
        <button
          onClick={toggleFilters}
          className={cn(
            'p-2 rounded-md transition-colors',
            showFilters
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
          )}
          title="Toggle source filters"
        >
          <Filter className="h-4 w-4" />
        </button>
      )}

      {showTimeToggle && (
        <button
          onClick={toggleTimeRange}
          className={cn(
            'p-2 rounded-md transition-colors',
            showTimeRange
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
          )}
          title="Toggle time range"
        >
          <Clock className="h-4 w-4" />
        </button>
      )}

      <button
        onClick={executeSearch}
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
  )
})

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

interface CollapsibleSectionProps {
  /** Section title */
  title: string
  /** Default open state */
  defaultOpen?: boolean
  /** Children content */
  children: ReactNode
  /** Additional className */
  className?: string
}

const CollapsibleSection: FC<CollapsibleSectionProps> = memo(function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contentRef.current) return
    animate(contentRef.current, {
      maxHeight: isOpen ? [0, contentRef.current.scrollHeight] : [contentRef.current.scrollHeight, 0],
      opacity: isOpen ? [0, 1] : [1, 0],
      duration: TIMING.normal,
      ease: EASING.anime.out,
    })
  }, [isOpen])

  return (
    <div className={cn('border-b border-border-subtle', className)}>
      <button
        onClick={() => setIsOpen(p => !p)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        )}
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{ maxHeight: defaultOpen ? undefined : 0 }}
      >
        <div className="p-3 pt-0">
          {children}
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const SearchPanelCompound = Object.assign(Root, {
  Root,
  Input,
  SourceToggles,
  TimeRange,
  StatusBar,
  Results,
  Actions,
  CollapsibleSection,
})

// Export individual components for flexibility
export {
  Root as SearchPanelRoot,
  Input as SearchPanelInput,
  SourceToggles as SearchPanelSourceToggles,
  TimeRange as SearchPanelTimeRange,
  StatusBar as SearchPanelStatusBar,
  Results as SearchPanelResults,
  Actions as SearchPanelActions,
  CollapsibleSection as SearchPanelCollapsibleSection,
  useSearchPanel,
}

export type {
  InputProps as SearchPanelInputProps,
  SourceTogglesProps as SearchPanelSourceTogglesProps,
  TimeRangeProps as SearchPanelTimeRangeProps,
  StatusBarProps as SearchPanelStatusBarProps,
  ResultsProps as SearchPanelResultsProps,
  ActionsProps as SearchPanelActionsProps,
  CollapsibleSectionProps as SearchPanelCollapsibleSectionProps,
}

export default SearchPanelCompound
