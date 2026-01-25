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
  useMemo,
  type FC,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { useMachine } from '@xstate/react'
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
  searchFormMachine,
  type FormSection,
  type SearchFormInput,
} from '../machines/searchFormMachine'
import {
  useGeointPanel,
  geointRegistry,
} from '../atoms'
import type { IntelSource, SearchResultItem, BBox } from '../schemas'
import { SOURCE_COLORS, TIMING, EASING } from '../tokens'
import { VirtualizedSearchResults } from './VirtualizedSearchResults'
import { InlineSearchError } from './SearchErrorDisplay'
// GEOINT Kori integration
import {
  GeointRegistryProvider,
  searchPanelUIAtom,
  timeRangeAtom,
  collapsibleSectionFamily,
  searchPanelOps,
} from '../kori/entity-atoms'

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
  status: 'idle' | 'validating' | 'searching' | 'completed' | 'error'

  // Results
  results: readonly SearchResultItem[]
  resultsCount: number
  sourceCounts: Record<IntelSource, number>
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
  // Access panel-scoped atoms
  const { atoms } = useGeointPanel()

  // Kori atom state (replaces useState)
  const panelUI = useAtomValue(searchPanelUIAtom)
  const { query, isExpanded, showFilters, showTimeRange } = panelUI

  // Initialize default expanded state on mount
  useEffect(() => {
    searchPanelOps.setExpanded(defaultExpanded)
  }, []) // Only on mount

  // Panel-scoped atom values
  const status = useAtomValue(atoms.searchStatusAtom)
  const results = useAtomValue(atoms.resultsAtom)
  const filters = useAtomValue(atoms.activeFiltersAtom)
  const error = useAtomValue(atoms.searchErrorAtom)

  // Derived values (computed inline - TODO: move to derived atom families)
  const resultsCount = results.length
  const sourceCounts = useMemo(() => {
    const counts: Record<IntelSource, number> = {} as Record<IntelSource, number>
    for (const result of results) {
      counts[result.source] = (counts[result.source] || 0) + 1
    }
    return counts
  }, [results])

  const isSearching = status === 'searching' || status === 'validating'

  // Source toggle
  const toggleSource = useCallback((source: IntelSource) => {
    const current = [...filters.sources] as IntelSource[]
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    geointRegistry.set(atoms.activeFiltersAtom, { ...filters, sources: updated })
  }, [filters, atoms])

  const setAllSources = useCallback((enabled: boolean) => {
    const current = geointRegistry.get(atoms.activeFiltersAtom)
    if (enabled) {
      geointRegistry.set(atoms.activeFiltersAtom, {
        ...current,
        sources: Object.keys(SOURCE_CONFIG) as IntelSource[],
      })
    } else {
      geointRegistry.set(atoms.activeFiltersAtom, { ...current, sources: [] })
    }
  }, [atoms])

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
    searchPanelOps.clearQuery()
  }, [])

  // Context value - use Kori ops for mutations
  const contextValue: SearchPanelContextValue = {
    query,
    setQuery: searchPanelOps.setQuery,
    enabledSources: [...filters.sources],
    toggleSource,
    setAllSources,
    isExpanded,
    toggleExpanded: searchPanelOps.toggleExpanded,
    showFilters,
    toggleFilters: searchPanelOps.toggleFilters,
    showTimeRange,
    toggleTimeRange: searchPanelOps.toggleTimeRange,
    executeSearch,
    clearSearch,
    isSearching,
    status,
    results,
    resultsCount,
    sourceCounts,
    error,
    onResultSelect,
    onResultActivate,
    viewportBounds,
  }

  return (
    <GeointRegistryProvider>
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
    </GeointRegistryProvider>
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
  const { enabledSources, toggleSource, sourceCounts } = useSearchPanel()

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
      easing: EASING.anime.out,
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
        <span className="px-1 bg-surface-3/50 rounded text-xs">
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
  // Kori atom state (replaces useState)
  const timeRangeState = useAtomValue(timeRangeAtom)
  const { mode: timeMode, rangeStart, rangeEnd } = timeRangeState

  // Memoized Date objects for datetime-local inputs
  const rangeStartDate = useMemo(() => new Date(rangeStart), [rangeStart])
  const rangeEndDate = useMemo(() => new Date(rangeEnd), [rangeEnd])

  // Handlers using Kori ops
  const handleSetLive = useCallback(() => {
    searchPanelOps.setTimeMode('live')
  }, [])

  const handleSetHistorical = useCallback(() => {
    searchPanelOps.setTimeMode('historical')
  }, [])

  const handleStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value).getTime()
    searchPanelOps.setTimeRange(newStart, rangeEnd)
  }, [rangeEnd])

  const handleEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value).getTime()
    searchPanelOps.setTimeRange(rangeStart, newEnd)
  }, [rangeStart])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSetLive}
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
          onClick={handleSetHistorical}
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
            value={rangeStartDate.toISOString().slice(0, 16)}
            onChange={handleStartChange}
            className="flex-1 px-2 py-1 bg-surface-2 border border-border-subtle rounded text-text-primary"
          />
          <span className="text-text-tertiary">to</span>
          <input
            type="datetime-local"
            value={rangeEndDate.toISOString().slice(0, 16)}
            onChange={handleEndChange}
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
  const { resultsCount, viewportBounds, status } = useSearchPanel()

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
        {status === 'error' && <InlineSearchError />}
      </span>

      {showViewport && viewportBounds && (
        <span className="text-text-quaternary font-mono text-xs">
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
  const { results, onResultSelect, onResultActivate, status } = useSearchPanel()

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
  /** Unique section ID for Kori atom state */
  sectionId: string
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
  sectionId,
  title,
  defaultOpen = false,
  children,
  className,
}) {
  // Kori atom state via family (replaces useState)
  const sectionAtom = useMemo(
    () => collapsibleSectionFamily(sectionId, defaultOpen),
    [sectionId, defaultOpen]
  )
  const isOpen = useAtomValue(sectionAtom)
  const contentRef = useRef<HTMLDivElement>(null)
  const prevIsOpen = useRef(isOpen)

  // Initialize to defaultOpen on mount
  useEffect(() => {
    searchPanelOps.setSection(sectionId, defaultOpen)
  }, []) // Only on mount

  // Animate on isOpen changes (skip initial)
  useEffect(() => {
    if (!contentRef.current) return
    // Skip animation on initial render
    if (prevIsOpen.current === isOpen) return
    prevIsOpen.current = isOpen

    animate(contentRef.current, {
      maxHeight: isOpen ? [0, contentRef.current.scrollHeight] : [contentRef.current.scrollHeight, 0],
      opacity: isOpen ? [0, 1] : [1, 0],
      duration: TIMING.normal,
      easing: EASING.anime.out,
    })
  }, [isOpen])

  // Handler using Kori ops
  const handleToggle = useCallback(() => {
    searchPanelOps.toggleSection(sectionId)
  }, [sectionId])

  return (
    <div className={cn('border-b border-border-subtle', className)}>
      <button
        onClick={handleToggle}
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
        style={{ maxHeight: isOpen ? undefined : 0 }}
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

// =============================================================================
// XSTATE-ENHANCED SEARCH PANEL
// =============================================================================

/**
 * XState-enhanced context value with form machine state
 */
interface XStateSearchPanelContextValue extends SearchPanelContextValue {
  // XState machine state
  formState: ReturnType<typeof searchFormMachine.getInitialSnapshot>
  formSend: (event: Parameters<ReturnType<typeof useMachine<typeof searchFormMachine>>[1]>[0]) => void
  // Suggestions
  suggestions: string[]
  showSuggestions: boolean
  selectedSuggestionIndex: number
  // Validation
  validationStatus: 'idle' | 'validating' | 'valid' | 'invalid'
  validationErrors: Partial<Record<FormSection, string>>
  // Animation
  animationPhase: 'idle' | 'expanding' | 'collapsing'
  animatingSection: FormSection | null
  // Expanded sections
  expandedSections: FormSection[]
}

const XStateSearchPanelContext = createContext<XStateSearchPanelContextValue | null>(null)

const useXStateSearchPanel = () => {
  const ctx = useContext(XStateSearchPanelContext)
  if (!ctx) throw new Error('useXStateSearchPanel must be used within SearchPanelWithMachine')
  return ctx
}

interface SearchPanelWithMachineProps {
  /** Children components */
  children: ReactNode
  /** Current viewport bounds for search */
  viewportBounds?: BBox
  /** Callback when search is executed */
  onSearch?: (bounds: BBox, sources: IntelSource[], query: string) => void
  /** Callback when a result is selected */
  onResultSelect?: (result: SearchResultItem) => void
  /** Callback when a result is activated (double-click/Enter) */
  onResultActivate?: (result: SearchResultItem) => void
  /** Additional CSS classes */
  className?: string
  /** Initial query string */
  initialQuery?: string
  /** Initial expanded sections */
  initialExpandedSections?: FormSection[]
}

/**
 * XState-enhanced Search Panel Root
 *
 * Uses searchFormMachine for:
 * - Debounced query input
 * - Autocomplete suggestions with keyboard navigation
 * - Form validation
 * - Section expand/collapse animations
 */
const XStateRoot: FC<SearchPanelWithMachineProps> = ({
  children,
  viewportBounds,
  onSearch,
  onResultSelect,
  onResultActivate,
  className,
  initialQuery = '',
  initialExpandedSections = ['sources'],
}) => {
  // Access panel-scoped atoms
  const { atoms } = useGeointPanel()

  // Initialize XState machine
  const [formState, formSend] = useMachine(searchFormMachine, {
    input: {
      initialQuery,
      initialExpandedSections,
    } satisfies SearchFormInput,
  })

  // Local UI state
  const [showFilters, setShowFilters] = useState(false)
  const [showTimeRange, setShowTimeRange] = useState(false)

  // Panel-scoped atom values
  const status = useAtomValue(atoms.searchStatusAtom)
  const results = useAtomValue(atoms.resultsAtom)
  const filters = useAtomValue(atoms.activeFiltersAtom)
  const error = useAtomValue(atoms.searchErrorAtom)

  // Derived values
  const resultsCount = results.length
  const sourceCounts = useMemo(() => {
    const counts: Record<IntelSource, number> = {} as Record<IntelSource, number>
    for (const result of results) {
      counts[result.source] = (counts[result.source] || 0) + 1
    }
    return counts
  }, [results])

  const isSearching = status === 'searching' || status === 'validating'

  // Get query from machine
  const query = formState.context.queryField.value
  const setQuery = useCallback((value: string) => {
    formSend({ type: 'QUERY_CHANGE', value })
  }, [formSend])

  // Source toggle
  const toggleSource = useCallback((source: IntelSource) => {
    const current = [...filters.sources] as IntelSource[]
    const updated = current.includes(source)
      ? current.filter((s) => s !== source)
      : [...current, source]
    geointRegistry.set(atoms.activeFiltersAtom, { ...filters, sources: updated })
  }, [filters, atoms])

  const setAllSources = useCallback((enabled: boolean) => {
    const current = geointRegistry.get(atoms.activeFiltersAtom)
    if (enabled) {
      geointRegistry.set(atoms.activeFiltersAtom, {
        ...current,
        sources: Object.keys(SOURCE_CONFIG) as IntelSource[],
      })
    } else {
      geointRegistry.set(atoms.activeFiltersAtom, { ...current, sources: [] })
    }
  }, [atoms])

  // Execute search
  const executeSearch = useCallback(() => {
    if (!viewportBounds) return
    const sources: IntelSource[] = filters.sources.length > 0
      ? [...filters.sources]
      : ['track', 'osm', 'opensky', 'feature']
    onSearch?.(viewportBounds, sources, query)
    formSend({ type: 'SUBMIT' })
  }, [viewportBounds, filters.sources, onSearch, query, formSend])

  // Clear search
  const clearSearch = useCallback(() => {
    formSend({ type: 'QUERY_CLEAR' })
  }, [formSend])

  // Context value
  const contextValue: XStateSearchPanelContextValue = {
    // Base context
    query,
    setQuery,
    enabledSources: [...filters.sources],
    toggleSource,
    setAllSources,
    isExpanded: formState.context.expandedSections.length > 0,
    toggleExpanded: () => {
      if (formState.context.expandedSections.length > 0) {
        formSend({ type: 'COLLAPSE_ALL' })
      } else {
        formSend({ type: 'EXPAND_SECTION', section: 'sources' })
      }
    },
    showFilters,
    toggleFilters: () => setShowFilters(p => !p),
    showTimeRange,
    toggleTimeRange: () => setShowTimeRange(p => !p),
    executeSearch,
    clearSearch,
    isSearching,
    status,
    results,
    resultsCount,
    sourceCounts,
    error,
    onResultSelect,
    onResultActivate,
    viewportBounds,
    // XState additions
    formState,
    formSend,
    suggestions: formState.context.suggestions,
    showSuggestions: formState.context.showSuggestions,
    selectedSuggestionIndex: formState.context.selectedSuggestionIndex,
    validationStatus: formState.context.validationStatus,
    validationErrors: formState.context.validationErrors,
    animationPhase: formState.context.animationPhase,
    animatingSection: formState.context.animatingSection,
    expandedSections: formState.context.expandedSections,
  }

  return (
    <XStateSearchPanelContext.Provider value={contextValue}>
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
    </XStateSearchPanelContext.Provider>
  )
}

/**
 * XState-enhanced input with autocomplete suggestions
 */
interface XStateInputProps {
  /** Placeholder text */
  placeholder?: string
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Additional className */
  className?: string
}

const XStateInput: FC<XStateInputProps> = memo(function XStateInput({
  placeholder = 'Search ALLINT COP...',
  autoFocus = false,
  className,
}) {
  const {
    query,
    formSend,
    executeSearch,
    isSearching,
    suggestions,
    showSuggestions,
    selectedSuggestionIndex,
    validationErrors,
  } = useXStateSearchPanel()

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const hasError = validationErrors.query != null

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Animate suggestions dropdown
  useEffect(() => {
    if (!suggestionsRef.current) return
    if (showSuggestions && suggestions.length > 0) {
      animate(suggestionsRef.current, {
        opacity: [0, 1],
        translateY: [-8, 0],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [showSuggestions, suggestions.length])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    formSend({ type: 'QUERY_CHANGE', value: e.target.value })
  }, [formSend])

  const handleFocus = useCallback(() => {
    formSend({ type: 'QUERY_FOCUS' })
  }, [formSend])

  const handleBlur = useCallback(() => {
    // Delay blur to allow suggestion clicks
    setTimeout(() => formSend({ type: 'QUERY_BLUR' }), 150)
  }, [formSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        e.preventDefault()
        executeSearch()
      }
      if (e.key === 'Escape') {
        formSend({ type: 'QUERY_CLEAR' })
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        formSend({ type: 'SUGGESTION_KEYBOARD', direction: 'down' })
        break
      case 'ArrowUp':
        e.preventDefault()
        formSend({ type: 'SUGGESTION_KEYBOARD', direction: 'up' })
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          formSend({ type: 'SUGGESTION_SELECT', index: selectedSuggestionIndex })
        } else {
          executeSearch()
        }
        break
      case 'Escape':
        formSend({ type: 'SUGGESTIONS_DISMISS' })
        break
    }
  }

  const handleSuggestionClick = useCallback((index: number) => {
    formSend({ type: 'SUGGESTION_SELECT', index })
  }, [formSend])

  const handleClear = useCallback(() => {
    formSend({ type: 'QUERY_CLEAR' })
    inputRef.current?.focus()
  }, [formSend])

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center gap-2">
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
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full pl-8 pr-8 py-2 bg-surface-2 border rounded-md text-sm text-text-primary',
              'placeholder:text-text-quaternary focus:outline-none focus:ring-1 transition-colors',
              hasError
                ? 'border-status-error focus:ring-status-error'
                : 'border-border-subtle focus:ring-accent-primary'
            )}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'query-error' : undefined}
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Validation error */}
      {hasError && (
        <p id="query-error" className="mt-1 text-xs text-status-error">
          {validationErrors.query}
        </p>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full mt-1 bg-surface-2 border border-border-subtle rounded-md shadow-lg z-50 overflow-hidden"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(index)}
              onMouseEnter={() => formSend({ type: 'SUGGESTION_HOVER', index })}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                index === selectedSuggestionIndex
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'text-text-secondary hover:bg-surface-3'
              )}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
            >
              <Search className="inline-block h-3 w-3 mr-2 opacity-50" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

/**
 * XState-controlled collapsible section
 */
interface XStateSectionProps {
  /** Section identifier */
  section: FormSection
  /** Section title */
  title: string
  /** Optional icon */
  icon?: typeof Search
  /** Children content */
  children: ReactNode
  /** Additional className */
  className?: string
}

const XStateSection: FC<XStateSectionProps> = memo(function XStateSection({
  section,
  title,
  icon: Icon,
  children,
  className,
}) {
  const { formSend, expandedSections, animationPhase, animatingSection } = useXStateSearchPanel()
  const contentRef = useRef<HTMLDivElement>(null)
  const isExpanded = expandedSections.includes(section)
  const isAnimating = animatingSection === section

  const handleToggle = useCallback(() => {
    formSend({ type: 'TOGGLE_SECTION', section })
  }, [formSend, section])

  // Animate expand/collapse
  useEffect(() => {
    if (!contentRef.current || !isAnimating) return

    const content = contentRef.current
    if (animationPhase === 'expanding') {
      content.style.height = '0px'
      content.style.opacity = '0'
      const targetHeight = content.scrollHeight
      animate(content, {
        height: [0, targetHeight],
        opacity: [0, 1],
        duration: TIMING.normal,
        easing: EASING.anime.out,
        complete: () => {
          content.style.height = 'auto'
          formSend({ type: 'ANIMATION_COMPLETE' })
        },
      })
    } else if (animationPhase === 'collapsing') {
      const currentHeight = content.scrollHeight
      content.style.height = `${currentHeight}px`
      animate(content, {
        height: [currentHeight, 0],
        opacity: [1, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
        complete: () => {
          formSend({ type: 'ANIMATION_COMPLETE' })
        },
      })
    }
  }, [animationPhase, isAnimating, formSend])

  return (
    <div className={cn('border-b border-border-subtle', className)}>
      <button
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-text-tertiary transition-transform duration-200',
            isExpanded ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{ height: isExpanded && !isAnimating ? 'auto' : 0 }}
      >
        <div className="p-3 pt-0">
          {children}
        </div>
      </div>
    </div>
  )
})

/**
 * Export XState-enhanced compound components
 */
export const SearchPanelWithMachine = Object.assign(XStateRoot, {
  Root: XStateRoot,
  Input: XStateInput,
  Section: XStateSection,
  SourceToggles,
  TimeRange,
  StatusBar,
  Results,
  Actions,
})

export {
  XStateRoot as SearchPanelXStateRoot,
  XStateInput as SearchPanelXStateInput,
  XStateSection as SearchPanelXStateSection,
  useXStateSearchPanel,
}

export type {
  XStateSearchPanelContextValue,
  SearchPanelWithMachineProps,
  XStateInputProps as SearchPanelXStateInputProps,
  XStateSectionProps as SearchPanelXStateSectionProps,
}
