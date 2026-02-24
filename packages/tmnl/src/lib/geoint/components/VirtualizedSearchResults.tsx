/**
 * VirtualizedSearchResults
 *
 * High-performance virtualized search results list using:
 * - CSS content-visibility for native virtualization
 * - anime.js for enter/exit animations
 * - effect-atom for reactive state
 * - Keyboard navigation (↑/↓/Enter/Esc)
 *
 * @module geoint/components/VirtualizedSearchResults
 */

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { animate } from 'animejs'
import {
  MapPin,
  Building,
  Plane,
  Layers,
  Cloud,
  Satellite,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SearchResultItem, IntelSource } from '../schemas'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export interface VirtualizedSearchResultsProps {
  /** Results to display */
  results: readonly SearchResultItem[]
  /** Currently selected result ID */
  selectedId?: string | null
  /** Focused result ID (keyboard navigation) */
  focusedId?: string | null
  /** Height of the container */
  height?: number
  /** Called when a result is selected (single click) */
  onSelect?: (result: SearchResultItem) => void
  /** Called when a result is activated (double click / Enter) */
  onActivate?: (result: SearchResultItem) => void
  /** Called when selection is cleared (Escape) */
  onClearSelection?: () => void
  /** Optional className */
  className?: string
  /** Enable enter animations */
  animateEnter?: boolean
  /** Stagger delay between items */
  staggerDelay?: number
}

// =============================================================================
// Source Icons
// =============================================================================

const SOURCE_ICONS: Record<IntelSource, typeof MapPin> = {
  track: MapPin,
  osm: Building,
  opensky: Plane,
  feature: Layers,
  openmeteo: Cloud,
  planet: Satellite,
  sentinel: Satellite,
  'adsb-lol': Plane,
  custom: Layers,
}

// =============================================================================
// Result Item Component
// =============================================================================

interface ResultItemProps {
  result: SearchResultItem
  index: number
  isSelected: boolean
  isFocused: boolean
  onSelect: (result: SearchResultItem) => void
  onActivate: (result: SearchResultItem) => void
  animateEnter: boolean
  staggerDelay: number
}

const ResultItem = memo(function ResultItem({
  result,
  index,
  isSelected,
  isFocused,
  onSelect,
  onActivate,
  animateEnter,
  staggerDelay,
}: ResultItemProps) {
  const itemRef = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  // Get source-specific styling
  const colors = SOURCE_COLORS[result.source]
  const Icon = SOURCE_ICONS[result.source]

  // Enter animation
  useEffect(() => {
    if (!animateEnter || hasAnimated.current || !itemRef.current) return
    hasAnimated.current = true

    const el = itemRef.current
    el.style.opacity = '0'
    el.style.transform = 'translateY(10px)'

    animate(el, {
      translateY: [10, 0],
      opacity: [0, 1],
      delay: index * staggerDelay,
      duration: TIMING.normal,
      easing: EASING.anime.out,
    })
  }, [animateEnter, index, staggerDelay])

  // Selection pulse animation
  useEffect(() => {
    if (isSelected && itemRef.current) {
      animate(itemRef.current, {
        scale: [1, 1.01, 1],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
  }, [isSelected])

  // Get display info based on result type
  const getDisplayInfo = () => {
    switch (result._tag) {
      case 'SearchResultTrack':
        return {
          title: result.trackId,
          subtitle: `${result.classification} · ${result.speed?.toFixed(0) ?? '?'} kts`,
        }
      case 'SearchResultPoi':
        return {
          title: result.name,
          subtitle: result.category,
        }
      case 'SearchResultFlight':
        return {
          title: result.callsign ?? result.icao24,
          subtitle: `${result.position[2]?.toFixed(0) ?? '?'} ft`,
        }
      case 'SearchResultFeature':
        return {
          title: result.featureId,
          subtitle: result.geometryType,
        }
      case 'SearchResultWeather':
        return {
          title: result.locationName ?? 'Weather',
          subtitle: 'Weather data',
        }
      case 'SearchResultImagery':
        return {
          title: result.collection,
          subtitle: result.provider,
        }
      default:
        return { title: 'Unknown', subtitle: '' }
    }
  }

  const { title, subtitle } = getDisplayInfo()

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onClick={() => onSelect(result)}
      onDoubleClick={() => onActivate(result)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onActivate(result)
        }
      }}
      className={cn(
        // Base styles
        'relative flex items-center gap-3 px-3 py-2.5 cursor-pointer',
        'border-b border-border-subtle',
        'transition-colors duration-150',

        // Virtualization
        'content-visibility-auto',
        'contain-intrinsic-size-y-64',

        // Hover state
        'hover:bg-surface-2',

        // Focus state
        isFocused && 'ring-1 ring-inset ring-accent-primary outline-none',

        // Selected state
        isSelected && [
          'bg-surface-2',
          'border-l-2',
        ],
      )}
      style={{
        borderLeftColor: isSelected ? colors.primary : 'transparent',
      }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: colors.muted }}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: colors.primary }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">
          {title}
        </div>
        <div className="text-xs text-text-tertiary truncate">
          {subtitle}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
})

// =============================================================================
// Main Component
// =============================================================================

export const VirtualizedSearchResults = memo(function VirtualizedSearchResults({
  results,
  selectedId,
  focusedId: externalFocusedId,
  height = 400,
  onSelect,
  onActivate,
  onClearSelection,
  className,
  animateEnter = true,
  staggerDelay = 30,
}: VirtualizedSearchResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [internalFocusedIndex, setInternalFocusedIndex] = useState(-1)

  // Determine focused ID (external takes precedence)
  const focusedId = externalFocusedId ?? (
    internalFocusedIndex >= 0 ? results[internalFocusedIndex]?.id : null
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const count = results.length
    if (count === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setInternalFocusedIndex((prev) =>
          prev < count - 1 ? prev + 1 : 0
        )
        break

      case 'ArrowUp':
        e.preventDefault()
        setInternalFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : count - 1
        )
        break

      case 'Enter':
        e.preventDefault()
        if (internalFocusedIndex >= 0) {
          const result = results[internalFocusedIndex]
          if (result) {
            onActivate?.(result)
          }
        }
        break

      case 'Escape':
        e.preventDefault()
        setInternalFocusedIndex(-1)
        onClearSelection?.()
        break

      case 'Home':
        e.preventDefault()
        setInternalFocusedIndex(0)
        break

      case 'End':
        e.preventDefault()
        setInternalFocusedIndex(count - 1)
        break
    }
  }, [results, internalFocusedIndex, onActivate, onClearSelection])

  // Scroll focused item into view
  useEffect(() => {
    if (internalFocusedIndex < 0 || !containerRef.current) return

    const container = containerRef.current
    const focusedElement = container.children[internalFocusedIndex] as HTMLElement
    if (!focusedElement) return

    const containerRect = container.getBoundingClientRect()
    const itemRect = focusedElement.getBoundingClientRect()

    if (itemRect.top < containerRect.top) {
      focusedElement.scrollIntoView({ block: 'start', behavior: 'smooth' })
    } else if (itemRect.bottom > containerRect.bottom) {
      focusedElement.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }, [internalFocusedIndex])

  // Handle selection
  const handleSelect = useCallback((result: SearchResultItem) => {
    const idx = results.findIndex((r) => r.id === result.id)
    setInternalFocusedIndex(idx)
    onSelect?.(result)
  }, [results, onSelect])

  // Handle activation
  const handleActivate = useCallback((result: SearchResultItem) => {
    onActivate?.(result)
  }, [onActivate])

  // Empty state
  if (results.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-text-tertiary text-sm',
          className
        )}
        style={{ height }}
      >
        No results found
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'overflow-y-auto overflow-x-hidden',
        'scroll-smooth overscroll-contain',
        'focus:outline-none',
        className
      )}
      style={{ height }}
    >
      {results.map((result, index) => (
        <ResultItem
          key={result.id}
          result={result}
          index={index}
          isSelected={result.id === selectedId}
          isFocused={result.id === focusedId}
          onSelect={handleSelect}
          onActivate={handleActivate}
          animateEnter={animateEnter}
          staggerDelay={staggerDelay}
        />
      ))}
    </div>
  )
})

export default VirtualizedSearchResults
