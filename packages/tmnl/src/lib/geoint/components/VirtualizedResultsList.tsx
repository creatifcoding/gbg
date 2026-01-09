/**
 * VirtualizedResultsList - High-Performance Search Results
 *
 * Features:
 * - @tanstack/react-virtual for windowed rendering
 * - anime.js stagger animations on mount/update
 * - Keyboard navigation (j/k, Enter to select)
 * - Multi-select with shift+click
 * - Hover preview integration
 * - Source-based grouping option
 *
 * Compound component architecture:
 * - VirtualizedResultsList.Root - Container with virtualization
 * - VirtualizedResultsList.Header - Column headers
 * - VirtualizedResultsList.Row - Individual result row
 * - VirtualizedResultsList.EmptyState - No results message
 * - VirtualizedResultsList.LoadingState - Skeleton loaders
 *
 * @module geoint/components/VirtualizedResultsList
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
  type FC,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { animate, stagger } from 'animejs'
import {
  MapPin,
  Ship,
  Plane,
  Cloud,
  Satellite,
  Layers,
  ChevronRight,
  Check,
  Circle,
  Search,
  Loader2,
  List,
  Grid3X3,
  Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type SortField = 'score' | 'timestamp' | 'name' | 'source' | 'distance'
export type SortDirection = 'asc' | 'desc'
export type ViewMode = 'list' | 'grid' | 'table'

export interface SortConfig {
  field: SortField
  direction: SortDirection
}

export interface VirtualizedResultsContextValue {
  /** All results */
  results: readonly SearchResultItem[]
  /** Sorted/filtered results for display */
  displayResults: readonly SearchResultItem[]
  /** Selected result IDs */
  selectedIds: ReadonlySet<string>
  /** Hovered result ID */
  hoveredId: string | null
  /** Focused index for keyboard nav */
  focusedIndex: number
  /** Sort configuration */
  sort: SortConfig
  /** View mode */
  viewMode: ViewMode
  /** Is loading */
  isLoading: boolean
  /** Compact mode */
  compact: boolean
  /** Row height */
  rowHeight: number
  /** Grid columns (for grid mode) */
  gridColumns: number

  // Actions
  onSelect: (id: string, multi?: boolean) => void
  onHover: (id: string | null) => void
  onFocus: (index: number) => void
  onSort: (field: SortField) => void
  onViewModeChange: (mode: ViewMode) => void
  onResultClick: (result: SearchResultItem) => void
  onResultDoubleClick: (result: SearchResultItem) => void
}

const VirtualizedResultsContext = createContext<VirtualizedResultsContextValue | null>(null)

export const useVirtualizedResults = () => {
  const ctx = useContext(VirtualizedResultsContext)
  if (!ctx) throw new Error('useVirtualizedResults must be used within VirtualizedResultsList.Root')
  return ctx
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
      return result.itemId
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

function getSourceColor(source: IntelSource): string {
  return SOURCE_COLORS[source]?.primary ?? '#6b7280'
}

function sortResults(
  results: readonly SearchResultItem[],
  sort: SortConfig
): readonly SearchResultItem[] {
  const sorted = [...results].sort((a, b) => {
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
      case 'distance':
        // Would need position context for this
        comparison = 0
        break
    }

    return sort.direction === 'asc' ? comparison : -comparison
  })

  return sorted
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

export interface VirtualizedResultsListRootProps {
  /** Search results */
  results: readonly SearchResultItem[]
  /** Selected IDs */
  selectedIds?: ReadonlySet<string>
  /** Initial sort */
  initialSort?: SortConfig
  /** Initial view mode */
  initialViewMode?: ViewMode
  /** Is loading */
  isLoading?: boolean
  /** Compact mode */
  compact?: boolean
  /** Row height override */
  rowHeight?: number
  /** Grid columns (for grid mode) */
  gridColumns?: number
  /** Height of container */
  height?: number | string
  /** On selection change */
  onSelectionChange?: (ids: ReadonlySet<string>) => void
  /** On view mode change */
  onViewModeChange?: (mode: ViewMode) => void
  /** On result click */
  onResultClick?: (result: SearchResultItem) => void
  /** On result double click (e.g., fly to) */
  onResultDoubleClick?: (result: SearchResultItem) => void
  /** On hover change */
  onHoverChange?: (id: string | null) => void
  /** Additional class */
  className?: string
  /** Children */
  children?: ReactNode
}

const Root: FC<VirtualizedResultsListRootProps> = memo(function Root({
  results,
  selectedIds: controlledSelectedIds,
  initialSort = { field: 'score', direction: 'desc' },
  initialViewMode = 'list',
  isLoading = false,
  compact = false,
  rowHeight: customRowHeight,
  gridColumns: customGridColumns = 3,
  height = 400,
  onSelectionChange,
  onViewModeChange: onViewModeChangeCallback,
  onResultClick,
  onResultDoubleClick,
  onHoverChange,
  className,
  children,
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [internalSelectedIds, setInternalSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [sort, setSort] = useState<SortConfig>(() => initialSort as SortConfig)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [lastAnimatedCount, setLastAnimatedCount] = useState(0)

  // Use controlled or internal selection
  const selectedIds = controlledSelectedIds ?? internalSelectedIds

  // Compute row height
  const rowHeight = customRowHeight ?? (compact ? 40 : 56)

  // Sort results
  const displayResults = useMemo(() => sortResults(results, sort), [results, sort])

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: displayResults.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  // Animate new results
  useEffect(() => {
    if (displayResults.length > lastAnimatedCount && containerRef.current) {
      const newItems = containerRef.current.querySelectorAll('[data-new="true"]')
      if (newItems.length > 0) {
        animate(newItems, {
          opacity: [0, 1],
          translateX: [-20, 0],
          duration: TIMING.normal,
          ease: EASING.anime.out,
          delay: stagger(30, { start: 0 }),
        })
      }
      setLastAnimatedCount(displayResults.length)
    }
  }, [displayResults.length, lastAnimatedCount])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (displayResults.length === 0) return

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, displayResults.length - 1))
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
          break
      }
    },
    [displayResults, focusedIndex, onResultClick]
  )

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0) {
      virtualizer.scrollToIndex(focusedIndex, { align: 'auto' })
    }
  }, [focusedIndex, virtualizer])

  // Actions
  const onSelect = useCallback(
    (id: string, multi = false) => {
      const newSet = new Set(selectedIds)
      if (multi) {
        if (newSet.has(id)) {
          newSet.delete(id)
        } else {
          newSet.add(id)
        }
      } else {
        newSet.clear()
        newSet.add(id)
      }
      setInternalSelectedIds(newSet)
      onSelectionChange?.(newSet)
    },
    [selectedIds, onSelectionChange]
  )

  const onHover = useCallback(
    (id: string | null) => {
      setHoveredId(id)
      onHoverChange?.(id)
    },
    [onHoverChange]
  )

  const onFocus = useCallback((index: number) => {
    setFocusedIndex(index)
  }, [])

  const onSortChange = useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }))
  }, [])

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode)
      onViewModeChangeCallback?.(mode)
    },
    [onViewModeChangeCallback]
  )

  const handleResultClick = useCallback(
    (result: SearchResultItem) => {
      onResultClick?.(result)
    },
    [onResultClick]
  )

  const handleResultDoubleClick = useCallback(
    (result: SearchResultItem) => {
      onResultDoubleClick?.(result)
    },
    [onResultDoubleClick]
  )

  const value: VirtualizedResultsContextValue = {
    results,
    displayResults,
    selectedIds,
    hoveredId,
    focusedIndex,
    sort,
    viewMode,
    isLoading,
    compact,
    rowHeight,
    gridColumns: customGridColumns,
    onSelect,
    onHover,
    onFocus,
    onSort: onSortChange,
    onViewModeChange: handleViewModeChange,
    onResultClick: handleResultClick,
    onResultDoubleClick: handleResultDoubleClick,
  }

  return (
    <VirtualizedResultsContext.Provider value={value}>
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
      >
        {children ?? (
          <>
            <Header />
            <VirtualList virtualizer={virtualizer} />
            {displayResults.length === 0 && !isLoading && <EmptyState />}
            {isLoading && displayResults.length === 0 && <LoadingState />}
          </>
        )}
      </div>
    </VirtualizedResultsContext.Provider>
  )
})

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({ className }) {
  const { sort, onSort, viewMode, compact, displayResults } = useVirtualizedResults()

  const columns: Array<{ field: SortField; label: string; flex: string }> = [
    { field: 'name', label: 'Name', flex: 'flex-1' },
    { field: 'source', label: 'Source', flex: 'w-20' },
    { field: 'score', label: 'Score', flex: 'w-16' },
    { field: 'timestamp', label: 'Time', flex: 'w-24' },
  ]

  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-2 bg-surface-2 border-b border-border-subtle',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
        className
      )}
    >
      {/* Result count */}
      <div className="text-text-tertiary font-mono">
        {displayResults.length}
      </div>

      {/* View mode toggle */}
      <ViewModeToggle className="mr-2" />

      {/* Column headers - only show in list/table mode */}
      {viewMode !== 'grid' && (
        <>
          {/* Selection checkbox column */}
          <div className="w-6" />

          {columns.map((col) => (
            <button
              key={col.field}
              onClick={() => onSort(col.field)}
              className={cn(
                'flex items-center gap-1 text-text-tertiary hover:text-text-secondary transition-colors',
                col.flex
              )}
            >
              <span className="font-medium uppercase tracking-wider">{col.label}</span>
              {sort.field === col.field && (
                <ChevronRight
                  className={cn(
                    'w-3 h-3 transition-transform',
                    sort.direction === 'asc' ? '-rotate-90' : 'rotate-90'
                  )}
                />
              )}
            </button>
          ))}
        </>
      )}

      {/* Spacer for grid mode */}
      {viewMode === 'grid' && <div className="flex-1" />}
    </div>
  )
})

// =============================================================================
// VIEW MODE TOGGLE COMPONENT
// =============================================================================

export interface ViewModeToggleProps {
  /** Additional class */
  className?: string
}

const ViewModeToggle: FC<ViewModeToggleProps> = memo(function ViewModeToggle({ className }) {
  const { viewMode, onViewModeChange, compact } = useVirtualizedResults()
  const toggleRef = useRef<HTMLDivElement>(null)

  const modes: Array<{ mode: ViewMode; icon: typeof List; label: string }> = [
    { mode: 'list', icon: List, label: 'List view' },
    { mode: 'grid', icon: Grid3X3, label: 'Grid view' },
    { mode: 'table', icon: Table2, label: 'Table view' },
  ]

  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      onViewModeChange(mode)
      // Animate the toggle indicator
      if (toggleRef.current) {
        const activeIndex = modes.findIndex((m) => m.mode === mode)
        const indicator = toggleRef.current.querySelector('.mode-indicator')
        if (indicator) {
          animate(indicator, {
            translateX: activeIndex * (compact ? 24 : 28),
            duration: TIMING.fast,
            ease: EASING.anime.out,
          })
        }
      }
    },
    [onViewModeChange, compact, modes]
  )

  const activeIndex = modes.findIndex((m) => m.mode === viewMode)

  return (
    <div
      ref={toggleRef}
      className={cn(
        'relative inline-flex items-center bg-surface-2 rounded-md p-0.5',
        className
      )}
    >
      {/* Sliding indicator */}
      <div
        className="mode-indicator absolute bg-accent-primary/20 rounded transition-transform"
        style={{
          width: compact ? 24 : 28,
          height: compact ? 24 : 28,
          transform: `translateX(${activeIndex * (compact ? 24 : 28)}px)`,
        }}
      />

      {modes.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => handleModeChange(mode)}
          className={cn(
            'relative z-10 flex items-center justify-center rounded transition-colors',
            compact ? 'w-6 h-6' : 'w-7 h-7',
            viewMode === mode
              ? 'text-accent-primary'
              : 'text-text-tertiary hover:text-text-secondary'
          )}
          title={label}
          aria-label={label}
          aria-pressed={viewMode === mode}
        >
          <Icon className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        </button>
      ))}
    </div>
  )
})

// =============================================================================
// GRID CARD COMPONENT
// =============================================================================

export interface GridCardProps {
  /** Result data */
  result: SearchResultItem
  /** Card index */
  index: number
  /** Additional class */
  className?: string
}

const GridCard: FC<GridCardProps> = memo(function GridCard({ result, index, className }) {
  const {
    selectedIds,
    hoveredId,
    focusedIndex,
    onSelect,
    onHover,
    onFocus,
    onResultClick,
    onResultDoubleClick,
  } = useVirtualizedResults()

  const cardRef = useRef<HTMLDivElement>(null)
  const id = getResultId(result)
  const isSelected = selectedIds.has(id)
  const isHovered = hoveredId === id
  const isFocused = focusedIndex === index

  const Icon = getResultIcon(result)
  const sourceColor = getSourceColor(result.source)
  const name = getResultName(result)
  const type = getResultType(result)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onSelect(id, e.shiftKey || e.metaKey || e.ctrlKey)
      onFocus(index)
      onResultClick(result)
    },
    [id, index, result, onSelect, onFocus, onResultClick]
  )

  const handleDoubleClick = useCallback(() => {
    onResultDoubleClick(result)
  }, [result, onResultDoubleClick])

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all',
        'bg-surface-1 border-border-subtle',
        isSelected && 'ring-2 ring-accent-primary bg-accent-primary/5',
        isHovered && !isSelected && 'bg-surface-2 border-border-default',
        isFocused && 'ring-2 ring-accent-primary/50',
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      aria-selected={isSelected}
      data-new="true"
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-accent-primary" />
        </div>
      )}

      {/* Icon with source color */}
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg mb-2"
        style={{ backgroundColor: `${sourceColor}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: sourceColor }} />
      </div>

      {/* Name */}
      <div className="font-medium text-sm text-text-primary truncate mb-1">
        {name}
      </div>

      {/* Type */}
      <div className="text-xs text-text-tertiary truncate mb-2">{type}</div>

      {/* Footer: source + score */}
      <div className="flex items-center justify-between mt-auto">
        <div
          className="px-1.5 py-0.5 rounded text-xs font-mono uppercase"
          style={{
            backgroundColor: `${sourceColor}20`,
            color: sourceColor,
          }}
        >
          {result.source.slice(0, 3)}
        </div>
        <div
          className={cn(
            'text-xs font-mono',
            result.score > 0.8
              ? 'text-green-500'
              : result.score > 0.5
                ? 'text-yellow-500'
                : 'text-text-tertiary'
          )}
        >
          {(result.score * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  )
})

// =============================================================================
// VIRTUAL LIST COMPONENT
// =============================================================================

interface VirtualListProps {
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>
}

const VirtualList: FC<VirtualListProps> = memo(function VirtualList({ virtualizer }) {
  const { displayResults, viewMode, gridColumns, compact } = useVirtualizedResults()
  const listRef = useRef<HTMLDivElement>(null)

  const items = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  // Calculate header offset
  const headerHeight = compact ? 28 : 36

  // Animate view mode transition
  useEffect(() => {
    if (listRef.current) {
      const cards = listRef.current.querySelectorAll('[data-new="true"]')
      if (cards.length > 0) {
        animate(cards, {
          opacity: [0, 1],
          scale: [0.95, 1],
          duration: TIMING.fast,
          ease: EASING.anime.out,
          delay: stagger(20, { start: 0 }),
        })
      }
    }
  }, [viewMode])

  // Grid view rendering
  if (viewMode === 'grid') {
    // For grid view, we need to render items in a CSS Grid layout
    return (
      <div
        ref={listRef}
        className="p-3"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gap: '12px',
          paddingTop: headerHeight + 12,
        }}
      >
        {displayResults.map((result, index) => (
          <GridCard key={getResultId(result)} result={result} index={index} />
        ))}
      </div>
    )
  }

  // List and table view rendering (virtualized)
  return (
    <div
      ref={listRef}
      style={{
        height: totalHeight + headerHeight,
        width: '100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: headerHeight,
          left: 0,
          width: '100%',
        }}
      >
        {items.map((virtualItem) => {
          const result = displayResults[virtualItem.index]
          if (!result) return null

          return (
            <Row
              key={virtualItem.key}
              result={result}
              index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
})

// =============================================================================
// ROW COMPONENT
// =============================================================================

export interface RowProps {
  /** Result data */
  result: SearchResultItem
  /** Row index */
  index: number
  /** Style from virtualizer */
  style?: React.CSSProperties
  /** Additional class */
  className?: string
}

const Row: FC<RowProps> = memo(function Row({ result, index, style, className }) {
  const {
    selectedIds,
    hoveredId,
    focusedIndex,
    compact,
    onSelect,
    onHover,
    onFocus,
    onResultClick,
    onResultDoubleClick,
  } = useVirtualizedResults()

  const rowRef = useRef<HTMLDivElement>(null)
  const id = getResultId(result)
  const isSelected = selectedIds.has(id)
  const isHovered = hoveredId === id
  const isFocused = focusedIndex === index

  const Icon = getResultIcon(result)
  const sourceColor = getSourceColor(result.source)
  const name = getResultName(result)
  const type = getResultType(result)

  // Format timestamp
  const timeAgo = useMemo(() => {
    const diff = Date.now() - result.retrievedAt.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }, [result.retrievedAt])

  // Click handlers
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onSelect(id, e.shiftKey || e.metaKey || e.ctrlKey)
      onFocus(index)
      onResultClick(result)
    },
    [id, index, result, onSelect, onFocus, onResultClick]
  )

  const handleDoubleClick = useCallback(() => {
    onResultDoubleClick(result)
  }, [result, onResultDoubleClick])

  return (
    <div
      ref={rowRef}
      style={style}
      className={cn(
        'flex items-center gap-2 border-b border-border-subtle cursor-pointer transition-colors',
        compact ? 'px-2' : 'px-3',
        isSelected && 'bg-accent-primary/10',
        isHovered && !isSelected && 'bg-surface-2',
        isFocused && 'ring-2 ring-inset ring-accent-primary/50',
        className
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      role="option"
      aria-selected={isSelected}
      data-new={index >= 0 ? 'true' : undefined}
    >
      {/* Selection indicator */}
      <div className="w-6 flex items-center justify-center">
        {isSelected ? (
          <Check className="w-4 h-4 text-accent-primary" />
        ) : (
          <Circle
            className={cn(
              'w-3 h-3 transition-colors',
              isHovered ? 'text-text-tertiary' : 'text-transparent'
            )}
          />
        )}
      </div>

      {/* Icon with source color */}
      <div
        className="flex items-center justify-center rounded"
        style={{
          backgroundColor: `${sourceColor}20`,
          padding: compact ? '4px' : '6px',
        }}
      >
        <Icon
          className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
          style={{ color: sourceColor }}
        />
      </div>

      {/* Name and type */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium text-text-primary truncate',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {name}
        </div>
        {!compact && (
          <div className="text-xs text-text-tertiary truncate">{type}</div>
        )}
      </div>

      {/* Source badge */}
      <div
        className={cn(
          'px-1.5 py-0.5 rounded text-xs font-mono uppercase',
          compact ? 'text-xs' : 'text-xs'
        )}
        style={{
          backgroundColor: `${sourceColor}20`,
          color: sourceColor,
        }}
      >
        {result.source.slice(0, 3)}
      </div>

      {/* Score */}
      <div
        className={cn(
          'w-16 text-right font-mono',
          compact ? 'text-xs' : 'text-sm',
          result.score > 0.8
            ? 'text-green-500'
            : result.score > 0.5
              ? 'text-yellow-500'
              : 'text-text-tertiary'
        )}
      >
        {(result.score * 100).toFixed(0)}%
      </div>

      {/* Time */}
      <div
        className={cn(
          'w-24 text-right text-text-tertiary font-mono',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {timeAgo}
      </div>
    </div>
  )
})

// =============================================================================
// EMPTY STATE
// =============================================================================

export interface EmptyStateProps {
  /** Custom message */
  message?: string
  /** Additional class */
  className?: string
}

const EmptyState: FC<EmptyStateProps> = memo(function EmptyState({
  message = 'No results found',
  className,
}) {
  const emptyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (emptyRef.current) {
      animate(emptyRef.current, {
        opacity: [0, 1],
        scale: [0.95, 1],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [])

  return (
    <div
      ref={emptyRef}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center text-text-tertiary',
        className
      )}
    >
      <Search className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  )
})

// =============================================================================
// LOADING STATE
// =============================================================================

export interface LoadingStateProps {
  /** Number of skeleton rows */
  rows?: number
  /** Additional class */
  className?: string
}

const LoadingState: FC<LoadingStateProps> = memo(function LoadingState({
  rows = 5,
  className,
}) {
  const loadingRef = useRef<HTMLDivElement>(null)
  const { compact, rowHeight } = useVirtualizedResults()

  useEffect(() => {
    if (loadingRef.current) {
      const skeletons = loadingRef.current.querySelectorAll('.skeleton')
      animate(skeletons, {
        opacity: [0.3, 0.7, 0.3],
        duration: 1500,
        ease: 'linear',
        loop: true,
        delay: stagger(100),
      })
    }
  }, [])

  return (
    <div ref={loadingRef} className={cn('absolute inset-0', className)}>
      {/* Skip header space */}
      <div style={{ height: compact ? 28 : 36 }} />

      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton flex items-center gap-2 border-b border-border-subtle"
          style={{
            height: rowHeight,
            padding: compact ? '0 8px' : '0 12px',
          }}
        >
          <div className="w-6" />
          <div
            className="rounded bg-surface-3"
            style={{
              width: compact ? 24 : 32,
              height: compact ? 24 : 32,
            }}
          />
          <div className="flex-1 space-y-1">
            <div
              className="bg-surface-3 rounded"
              style={{ width: '60%', height: compact ? 12 : 14 }}
            />
            {!compact && (
              <div
                className="bg-surface-3 rounded"
                style={{ width: '30%', height: 10 }}
              />
            )}
          </div>
          <div className="w-12 h-4 bg-surface-3 rounded" />
          <div className="w-12 h-4 bg-surface-3 rounded" />
          <div className="w-16 h-4 bg-surface-3 rounded" />
        </div>
      ))}

      {/* Centered loader */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
      </div>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const VirtualizedResultsList = Object.assign(Root, {
  Root,
  Header,
  ViewModeToggle,
  GridCard,
  Row,
  EmptyState,
  LoadingState,
})

// Named exports
export {
  Root as VirtualizedResultsListRoot,
  Header as VirtualizedResultsListHeader,
  ViewModeToggle as VirtualizedResultsListViewModeToggle,
  GridCard as VirtualizedResultsListGridCard,
  Row as VirtualizedResultsListRow,
  EmptyState as VirtualizedResultsListEmptyState,
  LoadingState as VirtualizedResultsListLoadingState,
}

export default VirtualizedResultsList
