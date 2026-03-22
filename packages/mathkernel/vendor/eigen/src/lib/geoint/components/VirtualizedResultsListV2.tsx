/**
 * VirtualizedResultsListV2 - Kori-Integrated Virtualized Search Results
 *
 * Enhanced version of VirtualizedResultsList with:
 * - Kori entity state integration (selection, hover, pin from atoms)
 * - Score visualization bars
 * - Selection ring highlighting
 * - Auto-sync with useGeointSelection
 *
 * @module geoint/components/VirtualizedResultsListV2
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type FC,
  type KeyboardEvent,
} from 'react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { useAtomValue } from '@effect-atom/atom-react'
import { animate, stagger } from 'animejs'
import {
  MapPin,
  Ship,
  Plane,
  Cloud,
  Satellite,
  Layers,
  Pin,
  Check,
  Search,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import { resultsAtom, searchStatusAtom } from '../atoms'
import { useGeointSelection, useGeointEntityUI } from '../hooks'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type SortField = 'score' | 'timestamp' | 'name' | 'source'
export type SortDirection = 'asc' | 'desc'

export interface SortConfig {
  field: SortField
  direction: SortDirection
}

export interface VirtualizedResultsListV2Props {
  /** Initial sort config */
  initialSort?: SortConfig
  /** Row height override */
  rowHeight?: number
  /** Container height */
  height?: number | string
  /** Compact mode */
  compact?: boolean
  /** Show score bars */
  showScoreBars?: boolean
  /** On result click */
  onResultClick?: (result: SearchResultItem) => void
  /** On result double click (fly to) */
  onResultDoubleClick?: (result: SearchResultItem) => void
  /** Additional class */
  className?: string
}

// =============================================================================
// HELPERS
// =============================================================================

function getEntityIdFromResult(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultFlight':
      return `flight:${result.icao24}`
    case 'SearchResultPoi':
      return `poi:${result.poiId}`
    case 'SearchResultWeather':
      return `weather:${result.locationName}`
    case 'SearchResultTrack':
      return `track:${result.trackId}`
    case 'SearchResultImagery':
      return `imagery:${result.itemId}`
    case 'SearchResultFeature':
      return `feature:${result.featureId}`
    default:
      return `unknown:${Date.now()}`
  }
}

function getResultName(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultPoi':
      return result.name
    case 'SearchResultTrack':
      return result.label || result.trackId
    case 'SearchResultFlight':
      return result.callsign || result.icao24
    case 'SearchResultFeature':
      return result.label || result.featureId
    case 'SearchResultWeather':
      return result.locationName
    case 'SearchResultImagery':
      return result.label || result.itemId
  }
}

function getResultType(result: SearchResultItem): string {
  switch (result._tag) {
    case 'SearchResultPoi':
      return result.category || 'POI'
    case 'SearchResultTrack':
      return result.objectType || 'Track'
    case 'SearchResultFlight':
      return 'Flight'
    case 'SearchResultFeature':
      return result.geometryType || 'Feature'
    case 'SearchResultWeather':
      return 'Weather'
    case 'SearchResultImagery':
      return 'Imagery'
  }
}

function getResultIcon(result: SearchResultItem) {
  switch (result._tag) {
    case 'SearchResultPoi':
      return MapPin
    case 'SearchResultTrack':
      return Ship
    case 'SearchResultFlight':
      return Plane
    case 'SearchResultWeather':
      return Cloud
    case 'SearchResultImagery':
      return Satellite
    case 'SearchResultFeature':
      return Layers
  }
}

function sortResults(
  results: readonly SearchResultItem[],
  sort: SortConfig
): readonly SearchResultItem[] {
  return [...results].sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case 'score':
        comparison = b.score - a.score
        break
      case 'timestamp':
        comparison = b.retrievedAt.getTime() - a.retrievedAt.getTime()
        break
      case 'name':
        comparison = getResultName(a).localeCompare(getResultName(b))
        break
      case 'source':
        comparison = a.source.localeCompare(b.source)
        break
    }

    return sort.direction === 'asc' ? comparison : -comparison
  })
}

// =============================================================================
// SCORE BAR COMPONENT
// =============================================================================

interface ScoreBarProps {
  score: number
  source: IntelSource
  compact?: boolean
}

const ScoreBar: FC<ScoreBarProps> = memo(function ScoreBar({ score, source, compact }) {
  const color = SOURCE_COLORS[source]?.primary ?? '#6b7280'
  const percentage = Math.round(score * 100)

  return (
    <div className={cn('flex items-center gap-1.5', compact ? 'w-12' : 'w-16')}>
      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-xs font-mono text-text-tertiary w-6 text-right">
        {percentage}
      </span>
    </div>
  )
})

// =============================================================================
// ROW COMPONENT (with Kori integration)
// =============================================================================

interface ResultRowProps {
  result: SearchResultItem
  index: number
  compact?: boolean
  showScoreBar?: boolean
  isFocused?: boolean
  onSelect: () => void
  onHover: () => void
  onUnhover: () => void
  onClick: () => void
  onDoubleClick: () => void
}

const ResultRow: FC<ResultRowProps> = memo(function ResultRow({
  result,
  index,
  compact,
  showScoreBar = true,
  isFocused,
  onSelect,
  onHover,
  onUnhover,
  onClick,
  onDoubleClick,
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  // Get entity ID for Kori integration
  const entityId = getEntityIdFromResult(result)

  // Use Kori entity UI state
  const entityUI = useGeointEntityUI(entityId)

  const Icon = getResultIcon(result)
  const name = getResultName(result)
  const type = getResultType(result)
  const sourceColor = SOURCE_COLORS[result.source]?.primary ?? '#6b7280'

  // Handle click with multi-select
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        entityUI.toggleSelect()
      } else {
        onSelect()
        onClick()
      }
    },
    [entityUI, onSelect, onClick]
  )

  return (
    <div
      ref={rowRef}
      className={cn(
        'flex items-center gap-3 border-b border-border-subtle transition-all duration-150',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        // Selection ring
        entityUI.selected && 'ring-2 ring-accent-primary ring-inset bg-accent-primary/10',
        // Hover state
        entityUI.hovered && !entityUI.selected && 'bg-surface-2',
        // Focused state (keyboard nav)
        isFocused && 'outline-2 outline-accent-secondary outline-offset-[-2px]'
      )}
      data-index={index}
      data-entity-id={entityId}
      role="option"
      aria-selected={entityUI.selected}
      onMouseEnter={() => {
        entityUI.hovered || onHover()
      }}
      onMouseLeave={onUnhover}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Selection checkbox */}
      <div
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          entityUI.selected
            ? 'bg-accent-primary border-accent-primary'
            : 'border-border-subtle hover:border-accent-primary/50'
        )}
      >
        {entityUI.selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Source icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${sourceColor}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: sourceColor }} />
      </div>

      {/* Name and type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-text-primary',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {name}
          </span>
          {entityUI.pinned && (
            <Pin className="w-3 h-3 text-accent-primary flex-shrink-0" />
          )}
        </div>
        <span className="text-xs text-text-tertiary">{type}</span>
      </div>

      {/* Source badge */}
      <div
        className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-mono uppercase"
        style={{
          backgroundColor: `${sourceColor}20`,
          color: sourceColor,
        }}
      >
        {result.source}
      </div>

      {/* Score bar */}
      {showScoreBar && (
        <ScoreBar score={result.score} source={result.source} compact={compact} />
      )}
    </div>
  )
})

// =============================================================================
// VIRTUAL LIST
// =============================================================================

interface VirtualListProps {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  results: readonly SearchResultItem[]
  compact?: boolean
  showScoreBars?: boolean
  focusedIndex: number
  onResultClick: (result: SearchResultItem) => void
  onResultDoubleClick: (result: SearchResultItem) => void
}

const VirtualList: FC<VirtualListProps> = memo(function VirtualList({
  virtualizer,
  results,
  compact,
  showScoreBars,
  focusedIndex,
  onResultClick,
  onResultDoubleClick,
}) {
  const selection = useGeointSelection()
  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      className="relative w-full"
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualItems.map((virtualItem) => {
        const result = results[virtualItem.index]

        return (
          <div
            key={virtualItem.key}
            className="absolute top-0 left-0 w-full"
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ResultRow
              result={result}
              index={virtualItem.index}
              compact={compact}
              showScoreBar={showScoreBars}
              isFocused={focusedIndex === virtualItem.index}
              onSelect={() => selection.clearSelection()}
              onHover={() => {
                /* Hover handled by Kori */
              }}
              onUnhover={() => {
                /* Unhover handled by Kori */
              }}
              onClick={() => onResultClick(result)}
              onDoubleClick={() => onResultDoubleClick(result)}
            />
          </div>
        )
      })}
    </div>
  )
})

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  resultCount: number
  sort: SortConfig
  onSort: (field: SortField) => void
  compact?: boolean
}

const Header: FC<HeaderProps> = memo(function Header({
  resultCount,
  sort,
  onSort,
  compact,
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-3 bg-surface-2 border-b border-border-subtle',
        compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
      )}
    >
      {/* Selection checkbox column spacer */}
      <div className="w-5 flex-shrink-0" />

      {/* Icon column spacer */}
      <div className="w-8 flex-shrink-0" />

      {/* Name column - sortable */}
      <button
        className="flex-1 flex items-center gap-1 text-left text-text-tertiary hover:text-text-primary"
        onClick={() => onSort('name')}
      >
        <span>Name</span>
        {sort.field === 'name' &&
          (sort.direction === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </button>

      {/* Source column - sortable */}
      <button
        className="w-16 flex items-center gap-1 text-text-tertiary hover:text-text-primary"
        onClick={() => onSort('source')}
      >
        <span>Source</span>
        {sort.field === 'source' &&
          (sort.direction === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </button>

      {/* Score column - sortable */}
      <button
        className={cn(
          'flex items-center gap-1 text-text-tertiary hover:text-text-primary',
          compact ? 'w-12' : 'w-16'
        )}
        onClick={() => onSort('score')}
      >
        <span>Score</span>
        {sort.field === 'score' &&
          (sort.direction === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </button>

      {/* Result count */}
      <div className="text-text-tertiary font-mono text-xs">
        {resultCount.toLocaleString()}
      </div>
    </div>
  )
})

// =============================================================================
// EMPTY STATE
// =============================================================================

const EmptyState: FC = memo(function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-text-tertiary">
      <Search className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm">No results found</p>
      <p className="text-xs mt-1 text-text-tertiary/70">
        Try adjusting your search filters
      </p>
    </div>
  )
})

// =============================================================================
// LOADING STATE
// =============================================================================

const LoadingState: FC = memo(function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-text-tertiary">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-accent-primary" />
      <p className="text-sm">Searching...</p>
    </div>
  )
})

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * VirtualizedResultsListV2 - Kori-integrated virtualized results list.
 *
 * Features:
 * - TanStack Virtual for smooth scrolling with 10k+ items
 * - Kori entity state for selection/hover (syncs across components)
 * - Score visualization bars
 * - Selection ring highlighting
 * - Keyboard navigation (j/k/Enter)
 *
 * @example
 * ```tsx
 * <GeointShell>
 *   <SearchProvider>
 *     <VirtualizedResultsListV2
 *       onResultClick={handleResultClick}
 *       onResultDoubleClick={handleFlyTo}
 *     />
 *   </SearchProvider>
 * </GeointShell>
 * ```
 */
export const VirtualizedResultsListV2: FC<VirtualizedResultsListV2Props> = memo(
  function VirtualizedResultsListV2({
    initialSort = { field: 'score', direction: 'desc' },
    rowHeight: customRowHeight,
    height = 400,
    compact = false,
    showScoreBars = true,
    onResultClick,
    onResultDoubleClick,
    className,
  }) {
    const containerRef = useRef<HTMLDivElement>(null)

    // Get results from atoms
    const results = useAtomValue(resultsAtom)
    const status = useAtomValue(searchStatusAtom)
    const isLoading = status === 'searching' || status === 'validating'

    // Selection from Kori
    const selection = useGeointSelection()

    // Local state for sorting and focus
    const [sort, setSort] = React.useState<SortConfig>(initialSort as SortConfig)
    const [focusedIndex, setFocusedIndex] = React.useState(-1)
    const lastAnimatedCountRef = useRef(0)

    // Compute row height
    const rowHeight = customRowHeight ?? (compact ? 48 : 64)

    // Sort results
    const displayResults = useMemo(() => sortResults(results, sort), [results, sort])

    // Virtualizer
    const virtualizer = useVirtualizer({
      count: displayResults.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => rowHeight,
      overscan: 10,
    })

    // Animate new results
    useEffect(() => {
      if (
        displayResults.length > lastAnimatedCountRef.current &&
        containerRef.current
      ) {
        const items = containerRef.current.querySelectorAll('[data-index]')
        if (items.length > 0) {
          animate(items, {
            opacity: [0, 1],
            translateX: [-20, 0],
            duration: TIMING.normal,
            easing: EASING.anime.out,
            delay: stagger(20, { start: 0 }),
          })
        }
        lastAnimatedCountRef.current = displayResults.length
      }
    }, [displayResults.length])

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (displayResults.length === 0) return

        switch (e.key) {
          case 'j':
          case 'ArrowDown':
            e.preventDefault()
            setFocusedIndex((prev) =>
              Math.min(prev + 1, displayResults.length - 1)
            )
            break
          case 'k':
          case 'ArrowUp':
            e.preventDefault()
            setFocusedIndex((prev) => Math.max(prev - 1, 0))
            break
          case 'Enter':
          case ' ':
            e.preventDefault()
            if (focusedIndex >= 0 && focusedIndex < displayResults.length) {
              const result = displayResults[focusedIndex]
              onResultClick?.(result)
            }
            break
          case 'Escape':
            e.preventDefault()
            setFocusedIndex(-1)
            selection.clearSelection()
            break
        }
      },
      [displayResults, focusedIndex, onResultClick, selection]
    )

    // Scroll focused item into view
    useEffect(() => {
      if (focusedIndex >= 0) {
        virtualizer.scrollToIndex(focusedIndex, { align: 'auto' })
      }
    }, [focusedIndex, virtualizer])

    // Handle sort
    const handleSort = useCallback((field: SortField) => {
      setSort((prev) => ({
        field,
        direction:
          prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
      }))
    }, [])

    // Handle result click
    const handleResultClick = useCallback(
      (result: SearchResultItem) => {
        const entityId = getEntityIdFromResult(result)
        // Select only this entity via Kori
        selection.clearSelection()
        selection.selectAll([entityId])
        onResultClick?.(result)
      },
      [selection, onResultClick]
    )

    // Handle double click
    const handleResultDoubleClick = useCallback(
      (result: SearchResultItem) => {
        onResultDoubleClick?.(result)
      },
      [onResultDoubleClick]
    )

    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-auto bg-surface-1 border border-border-subtle rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-accent-primary/50',
          className
        )}
        style={{ height }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="listbox"
        aria-label="Search results"
        aria-busy={isLoading}
      >
        <Header
          resultCount={displayResults.length}
          sort={sort}
          onSort={handleSort}
          compact={compact}
        />

        {displayResults.length > 0 && (
          <VirtualList
            virtualizer={virtualizer}
            results={displayResults}
            compact={compact}
            showScoreBars={showScoreBars}
            focusedIndex={focusedIndex}
            onResultClick={handleResultClick}
            onResultDoubleClick={handleResultDoubleClick}
          />
        )}

        {displayResults.length === 0 && !isLoading && <EmptyState />}
        {isLoading && displayResults.length === 0 && <LoadingState />}
      </div>
    )
  }
)

// Need React import for useState
import * as React from 'react'

export default VirtualizedResultsListV2
