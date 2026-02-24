/**
 * ResultsPanel - Virtualized ALLINT COP Results Display
 *
 * High-performance results panel with:
 * - CSS content-visibility virtualization for moderate lists
 * - Multiple view modes (list, grid, compact)
 * - Group by source capability
 * - Keyboard navigation (↑/↓/Enter/Esc)
 * - Multi-select with Shift+Click
 * - Anime.js selection animations
 *
 * For lists > 10k items, consider adding @tanstack/react-virtual.
 *
 * @module geoint/components/ResultsPanel
 */

import {
  useState,
  useCallback,
  useMemo,
  memo,
  useRef,
  useEffect,
  forwardRef,
  type KeyboardEvent,
} from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { animate } from 'animejs'
import {
  List,
  Grid3X3,
  Rows3,
  ChevronDown,
  ChevronRight,
  MapPin,
  Plane,
  Building,
  Layers,
  Satellite,
  CloudSun,
  Radio,
  Check,
} from 'lucide-react'
import {
  filteredResultsAtom,
  totalResultCountAtom,
  selectResult,
  selectedResultAtom,
  hoveredResultAtom,
  geointRegistry,
} from '../atoms'
import type { IntelSource, SearchResultItem } from '../schemas'
import { SOURCE_COLORS, TIMING, EASING } from '../tokens'
import { cn } from '@/lib/utils'

// =============================================================================
// Types
// =============================================================================

export type ViewMode = 'list' | 'grid' | 'compact'

export interface ResultsPanelProps {
  /** Override results (otherwise uses filteredResultsAtom) */
  results?: readonly SearchResultItem[]
  /** View mode */
  viewMode?: ViewMode
  /** Enable grouping by source */
  groupBySource?: boolean
  /** Enable multi-select */
  multiSelect?: boolean
  /** Batch size for rendering (virtualization) */
  batchSize?: number
  /** Called when result is selected */
  onSelect?: (result: SearchResultItem) => void
  /** Called when selection changes (multi-select mode) */
  onSelectionChange?: (results: readonly SearchResultItem[]) => void
  /** Called when result is double-clicked */
  onActivate?: (result: SearchResultItem) => void
  /** Additional CSS classes */
  className?: string
}

interface GroupedResults {
  source: IntelSource
  results: SearchResultItem[]
  expanded: boolean
}

// =============================================================================
// Source Icons
// =============================================================================

const SOURCE_ICONS: Record<IntelSource, typeof MapPin> = {
  track: Radio,
  osm: Building,
  opensky: Plane,
  feature: Layers,
  'adsb-lol': Plane,
  planet: Satellite,
  sentinel: Satellite,
  openmeteo: CloudSun,
  custom: MapPin,
}

const SOURCE_LABELS: Record<IntelSource, string> = {
  track: 'Tracks',
  osm: 'POI',
  opensky: 'OpenSky',
  feature: 'Features',
  'adsb-lol': 'ADS-B',
  planet: 'Planet',
  sentinel: 'Sentinel',
  openmeteo: 'Weather',
  custom: 'Custom',
}

// =============================================================================
// Result Item Component
// =============================================================================

interface ResultItemProps {
  result: SearchResultItem
  viewMode: ViewMode
  isSelected: boolean
  isHovered: boolean
  isMultiSelected: boolean
  onSelect: (result: SearchResultItem, event: React.MouseEvent) => void
  onHover: (result: SearchResultItem | null) => void
  onActivate: (result: SearchResultItem) => void
}

const ResultItem = memo(
  forwardRef<HTMLDivElement, ResultItemProps>(function ResultItem(
    {
      result,
      viewMode,
      isSelected,
      isHovered,
      isMultiSelected,
      onSelect,
      onHover,
      onActivate,
    },
    ref
  ) {
    const itemRef = useRef<HTMLDivElement>(null)
    const colors = SOURCE_COLORS[result.source]
    const Icon = SOURCE_ICONS[result.source]

    // Extract display info based on result type
    const displayInfo = useMemo(() => {
      switch (result._tag) {
        case 'SearchResultTrack':
          return {
            title: result.label || `Track ${result.trackId}`,
            subtitle: `${result.classification} • ${result.objectType}`,
            detail: `${Math.round(result.speed)} m/s`,
          }
        case 'SearchResultPoi':
          return {
            title: result.name,
            subtitle: result.category,
            detail: '',
          }
        case 'SearchResultFlight':
          return {
            title: result.callsign || result.icao24,
            subtitle: `${result.originCountry} • ${Math.round(result.velocity)} m/s`,
            detail: `Alt: ${Math.round(result.position[2])}m`,
          }
        case 'SearchResultFeature':
          return {
            title: result.label || `Feature ${result.featureId}`,
            subtitle: result.geometryType,
            detail: '',
          }
        case 'SearchResultWeather':
          return {
            title: result.locationName,
            subtitle: `${result.temperature}°C`,
            detail: result.windSpeed !== undefined ? `Wind: ${result.windSpeed} m/s` : '',
          }
        case 'SearchResultImagery':
          return {
            title: result.provider,
            subtitle: result.acquired.toLocaleDateString(),
            detail: result.cloudCover !== undefined ? `${result.cloudCover}% cloud` : '',
          }
        default:
          return { title: 'Unknown', subtitle: '', detail: '' }
      }
    }, [result])

    // Animate selection
    useEffect(() => {
      if (!itemRef.current) return
      if (isSelected) {
        animate(itemRef.current, {
          scale: [0.98, 1],
          duration: TIMING.fast,
          easing: EASING.anime.out,
        })
      }
    }, [isSelected])

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        onSelect(result, e)
      },
      [result, onSelect]
    )

    const handleDoubleClick = useCallback(() => {
      onActivate(result)
    }, [result, onActivate])

    // CSS content-visibility for virtualization
    const virtualizationStyle = {
      contentVisibility: 'auto' as const,
      containIntrinsicSize: viewMode === 'grid' ? '0 120px' : '0 56px',
    }

    if (viewMode === 'grid') {
      return (
        <div
          ref={ref}
          style={virtualizationStyle}
          className={cn(
            'relative p-3 rounded-lg border transition-all cursor-pointer',
            'hover:bg-surface-2',
            isSelected && 'ring-2 ring-accent-primary bg-surface-2',
            isHovered && !isSelected && 'bg-surface-1',
            isMultiSelected && 'ring-1 ring-accent-secondary'
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => onHover(result)}
          onMouseLeave={() => onHover(null)}
        >
          {/* Multi-select checkbox */}
          {isMultiSelected && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded bg-accent-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          )}

          {/* Icon */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
            style={{ backgroundColor: colors.tailwind.bg }}
          >
            <Icon className="w-5 h-5" style={{ color: colors.primary }} />
          </div>

          {/* Content */}
          <div className="text-sm font-medium text-text-primary truncate">{displayInfo.title}</div>
          <div className="text-xs text-text-tertiary truncate">{displayInfo.subtitle}</div>

          {/* Score */}
          <div className="mt-2 text-xs text-text-quaternary">
            {Math.round(result.score * 100)}% match
          </div>
        </div>
      )
    }

    if (viewMode === 'compact') {
      return (
        <div
          ref={ref}
          style={virtualizationStyle}
          className={cn(
            'flex items-center gap-2 px-2 py-1 rounded transition-all cursor-pointer',
            'hover:bg-surface-2',
            isSelected && 'bg-accent-primary/20',
            isHovered && !isSelected && 'bg-surface-1',
            isMultiSelected && 'ring-1 ring-accent-secondary'
          )}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => onHover(result)}
          onMouseLeave={() => onHover(null)}
        >
          <Icon className="w-3 h-3 flex-shrink-0" style={{ color: colors.primary }} />
          <span className="text-xs text-text-primary truncate flex-1">{displayInfo.title}</span>
          <span className="text-xs text-text-quaternary">{Math.round(result.score * 100)}%</span>
        </div>
      )
    }

    // List view (default)
    return (
      <div
        ref={(el) => {
          (itemRef as React.MutableRefObject<HTMLDivElement | null>).current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        style={virtualizationStyle}
        className={cn(
          'flex items-center gap-3 px-3 py-2 border-b border-border-subtle transition-all cursor-pointer',
          'hover:bg-surface-2',
          isSelected && 'bg-accent-primary/10 border-l-2 border-l-accent-primary',
          isHovered && !isSelected && 'bg-surface-1',
          isMultiSelected && 'bg-accent-secondary/10'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => onHover(result)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Multi-select checkbox area */}
        {isMultiSelected && (
          <div className="w-5 h-5 rounded bg-accent-primary flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}

        {/* Source icon */}
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.tailwind.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: colors.primary }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">{displayInfo.title}</div>
          <div className="text-xs text-text-tertiary truncate">{displayInfo.subtitle}</div>
        </div>

        {/* Detail & Score */}
        <div className="flex flex-col items-end flex-shrink-0">
          {displayInfo.detail && (
            <div className="text-xs text-text-tertiary">{displayInfo.detail}</div>
          )}
          <div className="text-xs text-text-quaternary">{Math.round(result.score * 100)}%</div>
        </div>
      </div>
    )
  })
)

// =============================================================================
// Group Header Component
// =============================================================================

interface GroupHeaderProps {
  source: IntelSource
  count: number
  expanded: boolean
  onToggle: () => void
}

const GroupHeader = memo(function GroupHeader({
  source,
  count,
  expanded,
  onToggle,
}: GroupHeaderProps) {
  const colors = SOURCE_COLORS[source]
  const Icon = SOURCE_ICONS[source]
  const label = SOURCE_LABELS[source]

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 bg-surface-0 border-b border-border-subtle hover:bg-surface-1 transition-colors"
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-text-tertiary" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-tertiary" />
      )}
      <Icon className="w-4 h-4" style={{ color: colors.primary }} />
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <span className="text-xs text-text-tertiary ml-auto">{count}</span>
    </button>
  )
})

// =============================================================================
// View Mode Toggle
// =============================================================================

interface ViewModeToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

const ViewModeToggle = memo(function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  const modes: { value: ViewMode; icon: typeof List; label: string }[] = [
    { value: 'list', icon: Rows3, label: 'List' },
    { value: 'grid', icon: Grid3X3, label: 'Grid' },
    { value: 'compact', icon: List, label: 'Compact' },
  ]

  return (
    <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-md">
      {modes.map(({ value, icon: ModeIcon, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'p-1.5 rounded transition-colors',
            mode === value
              ? 'bg-surface-3 text-text-primary'
              : 'text-text-tertiary hover:text-text-secondary'
          )}
          title={label}
        >
          <ModeIcon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
})

// =============================================================================
// Results Panel Component
// =============================================================================

export const ResultsPanel = memo(function ResultsPanel({
  results: propResults,
  viewMode: initialViewMode = 'list',
  groupBySource = false,
  multiSelect = false,
  batchSize = 100,
  onSelect,
  onSelectionChange,
  onActivate,
  className,
}: ResultsPanelProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [expandedGroups, setExpandedGroups] = useState<Set<IntelSource>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [focusIndex, setFocusIndex] = useState<number>(-1)
  const [renderedCount, setRenderedCount] = useState(batchSize)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Atoms (fallback if no prop results)
  const atomResults = useAtomValue(filteredResultsAtom)
  const totalCount = useAtomValue(totalResultCountAtom)
  const selected = useAtomValue(selectedResultAtom)
  const hovered = useAtomValue(hoveredResultAtom)

  const results = propResults ?? atomResults

  // Group results by source if enabled
  const groupedResults = useMemo((): GroupedResults[] => {
    if (!groupBySource) return []

    const groups = new Map<IntelSource, SearchResultItem[]>()
    for (const result of results) {
      const existing = groups.get(result.source) ?? []
      existing.push(result)
      groups.set(result.source, existing)
    }

    return Array.from(groups.entries()).map(([source, items]) => ({
      source,
      results: items,
      expanded: expandedGroups.has(source),
    }))
  }, [results, groupBySource, expandedGroups])

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    if (groupBySource) {
      return groupedResults.flatMap((g) => (g.expanded ? g.results : []))
    }
    return results.slice(0, renderedCount)
  }, [results, groupBySource, groupedResults, renderedCount])

  // Progressive rendering - load more on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        setRenderedCount((prev) => Math.min(prev + batchSize, results.length))
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [results.length, batchSize])

  // Toggle group expansion
  const toggleGroup = useCallback((source: IntelSource) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }, [])

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResultItem, event: React.MouseEvent) => {
      if (multiSelect && event.shiftKey) {
        // Range selection
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(result.id)) {
            next.delete(result.id)
          } else {
            next.add(result.id)
          }
          return next
        })
      } else if (multiSelect && (event.ctrlKey || event.metaKey)) {
        // Toggle selection
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(result.id)) {
            next.delete(result.id)
          } else {
            next.add(result.id)
          }
          return next
        })
      } else {
        // Single selection
        setSelectedIds(new Set([result.id]))
        selectResult(result)
        onSelect?.(result)
      }

      // Update focus
      const idx = flatResults.findIndex((r) => r.id === result.id)
      setFocusIndex(idx)
    },
    [multiSelect, flatResults, onSelect]
  )

  // Handle hover
  const handleHover = useCallback((result: SearchResultItem | null) => {
    geointRegistry.set(hoveredResultAtom, result)
  }, [])

  // Handle double-click activation
  const handleActivate = useCallback(
    (result: SearchResultItem) => {
      onActivate?.(result)
    },
    [onActivate]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          if (focusIndex >= 0 && focusIndex < flatResults.length) {
            const result = flatResults[focusIndex]
            selectResult(result)
            onSelect?.(result)
          }
          break
        case 'Escape':
          setFocusIndex(-1)
          setSelectedIds(new Set())
          break
        case 'a':
          if ((e.ctrlKey || e.metaKey) && multiSelect) {
            e.preventDefault()
            setSelectedIds(new Set(flatResults.map((r) => r.id)))
          }
          break
      }
    },
    [flatResults, focusIndex, multiSelect, onSelect]
  )

  // Scroll focused item into view
  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < flatResults.length) {
      const result = flatResults[focusIndex]
      const el = itemRefs.current.get(result.id)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusIndex, flatResults])

  // Notify selection changes
  useEffect(() => {
    if (multiSelect && onSelectionChange) {
      const selectedResults = flatResults.filter((r) => selectedIds.has(r.id))
      onSelectionChange(selectedResults)
    }
  }, [selectedIds, flatResults, multiSelect, onSelectionChange])

  // Empty state
  if (results.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <MapPin className="w-12 h-12 text-text-quaternary mb-4" />
        <div className="text-sm text-text-tertiary">No results to display</div>
        <div className="text-xs text-text-quaternary mt-1">Perform a search to see results here</div>
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col bg-surface-1 rounded-lg overflow-hidden', className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-surface-0">
        <span className="text-xs text-text-tertiary">
          {results.length === totalCount
            ? `${results.length} results`
            : `${results.length} of ${totalCount} results`}
        </span>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Results container */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-y-auto',
          viewMode === 'grid' && 'p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
        )}
      >
        {groupBySource ? (
          // Grouped view
          groupedResults.map((group) => (
            <div key={group.source}>
              <GroupHeader
                source={group.source}
                count={group.results.length}
                expanded={group.expanded}
                onToggle={() => toggleGroup(group.source)}
              />
              {group.expanded && (
                <div className={viewMode === 'grid' ? 'p-3 grid grid-cols-2 gap-3' : ''}>
                  {group.results.map((result) => (
                    <ResultItem
                      key={result.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(result.id, el)
                      }}
                      result={result}
                      viewMode={viewMode}
                      isSelected={selected?.id === result.id}
                      isHovered={hovered?.id === result.id}
                      isMultiSelected={selectedIds.has(result.id)}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onActivate={handleActivate}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          // Flat view with progressive rendering
          flatResults.map((result, idx) => (
            <ResultItem
              key={result.id}
              ref={(el) => {
                if (el) itemRefs.current.set(result.id, el)
              }}
              result={result}
              viewMode={viewMode}
              isSelected={selected?.id === result.id || focusIndex === idx}
              isHovered={hovered?.id === result.id}
              isMultiSelected={selectedIds.has(result.id)}
              onSelect={handleSelect}
              onHover={handleHover}
              onActivate={handleActivate}
            />
          ))
        )}

        {/* Load more indicator */}
        {renderedCount < results.length && !groupBySource && (
          <div className="px-3 py-4 text-center text-xs text-text-quaternary">
            Scroll for more ({results.length - renderedCount} remaining)
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// Exports
// =============================================================================

export default ResultsPanel
