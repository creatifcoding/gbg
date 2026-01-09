/**
 * FilterBar - Advanced Filtering Compound Component
 *
 * Provides composable filter controls:
 * - Source toggles (chips)
 * - Classification filters
 * - Confidence threshold slider
 * - Spatial bounds indicator
 * - Active filter summary
 *
 * Integrates with search atoms for reactive filtering.
 *
 * @module geoint/components/FilterBar
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { Atom } from '@effect-atom/atom'
import { animate } from 'animejs'
import {
  Filter,
  X,
  ChevronDown,
  MapPin,
  Plane,
  Building,
  Layers,
  Radio,
  Satellite,
  CloudSun,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SOURCE_COLORS,
  CLASSIFICATION_COLORS,
  TIMING,
  EASING,
} from '../tokens'
import type { IntelSource, Classification, BBox } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export interface FilterBarState {
  /** Active intel sources */
  sources: readonly IntelSource[]
  /** Active classifications */
  classifications: readonly Classification[]
  /** Minimum confidence threshold (0-1) */
  minConfidence: number
  /** Spatial bounds (null = global) */
  bounds: BBox | null
  /** Free text query */
  query: string
}

export interface FilterBarContextValue {
  filters: FilterBarState
  /** Toggle a source on/off */
  toggleSource: (source: IntelSource) => void
  /** Toggle a classification on/off */
  toggleClassification: (classification: Classification) => void
  /** Set confidence threshold */
  setMinConfidence: (value: number) => void
  /** Set spatial bounds */
  setBounds: (bounds: BBox | null) => void
  /** Set query */
  setQuery: (query: string) => void
  /** Reset all filters to defaults */
  resetFilters: () => void
  /** Count of active filters */
  activeFilterCount: number
}

export interface FilterBarRootProps {
  /** Controlled filter state */
  filters?: FilterBarState
  /** Filter change callback */
  onFiltersChange?: (filters: FilterBarState) => void
  /** Available sources */
  availableSources?: readonly IntelSource[]
  /** Available classifications */
  availableClassifications?: readonly Classification[]
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const ALL_SOURCES: readonly IntelSource[] = [
  'track',
  'osm',
  'opensky',
  'feature',
  'adsb_lol',
  'planet',
  'sentinel',
  'weather',
  'custom',
]

const ALL_CLASSIFICATIONS: readonly Classification[] = [
  'friendly',
  'hostile',
  'neutral',
  'unknown',
]

const DEFAULT_FILTERS: FilterBarState = {
  sources: ALL_SOURCES,
  classifications: ALL_CLASSIFICATIONS,
  minConfidence: 0,
  bounds: null,
  query: '',
}

// =============================================================================
// ATOMS
// =============================================================================

/** Filter state atom */
export const filterStateAtom = Atom.make<FilterBarState>(DEFAULT_FILTERS)

// =============================================================================
// CONTEXT
// =============================================================================

const FilterBarContext = createContext<FilterBarContextValue | null>(null)

export const useFilterBar = () => {
  const ctx = useContext(FilterBarContext)
  if (!ctx) throw new Error('useFilterBar must be used within FilterBar.Root')
  return ctx
}

// =============================================================================
// SOURCE ICONS
// =============================================================================

const SOURCE_ICONS: Record<IntelSource, typeof MapPin> = {
  track: Radio,
  osm: Building,
  opensky: Plane,
  feature: Layers,
  adsb_lol: Plane,
  planet: Satellite,
  sentinel: Satellite,
  weather: CloudSun,
  custom: MapPin,
}

const SOURCE_LABELS: Record<IntelSource, string> = {
  track: 'Tracks',
  osm: 'POI',
  opensky: 'OpenSky',
  feature: 'Features',
  adsb_lol: 'ADS-B',
  planet: 'Planet',
  sentinel: 'Sentinel',
  weather: 'Weather',
  custom: 'Custom',
}

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  friendly: 'Friendly',
  hostile: 'Hostile',
  neutral: 'Neutral',
  unknown: 'Unknown',
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<FilterBarRootProps> = ({
  filters: controlledFilters,
  onFiltersChange,
  availableSources = ALL_SOURCES,
  availableClassifications = ALL_CLASSIFICATIONS,
  children,
  className,
}) => {
  const [internalFilters, setInternalFilters] = useState<FilterBarState>(DEFAULT_FILTERS)
  const filters = controlledFilters ?? internalFilters

  const updateFilters = useCallback((update: Partial<FilterBarState>) => {
    const newFilters = { ...filters, ...update }
    if (controlledFilters) {
      onFiltersChange?.(newFilters)
    } else {
      setInternalFilters(newFilters)
      onFiltersChange?.(newFilters)
    }
  }, [filters, controlledFilters, onFiltersChange])

  const toggleSource = useCallback((source: IntelSource) => {
    const sources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source]
    updateFilters({ sources })
  }, [filters.sources, updateFilters])

  const toggleClassification = useCallback((classification: Classification) => {
    const classifications = filters.classifications.includes(classification)
      ? filters.classifications.filter((c) => c !== classification)
      : [...filters.classifications, classification]
    updateFilters({ classifications })
  }, [filters.classifications, updateFilters])

  const setMinConfidence = useCallback((minConfidence: number) => {
    updateFilters({ minConfidence })
  }, [updateFilters])

  const setBounds = useCallback((bounds: BBox | null) => {
    updateFilters({ bounds })
  }, [updateFilters])

  const setQuery = useCallback((query: string) => {
    updateFilters({ query })
  }, [updateFilters])

  const resetFilters = useCallback(() => {
    updateFilters(DEFAULT_FILTERS)
  }, [updateFilters])

  // Count active filters
  const activeFilterCount =
    (filters.sources.length < availableSources.length ? 1 : 0) +
    (filters.classifications.length < availableClassifications.length ? 1 : 0) +
    (filters.minConfidence > 0 ? 1 : 0) +
    (filters.bounds !== null ? 1 : 0) +
    (filters.query.length > 0 ? 1 : 0)

  const contextValue: FilterBarContextValue = {
    filters,
    toggleSource,
    toggleClassification,
    setMinConfidence,
    setBounds,
    setQuery,
    resetFilters,
    activeFilterCount,
  }

  return (
    <FilterBarContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </FilterBarContext.Provider>
  )
}

// =============================================================================
// SOURCE CHIPS
// =============================================================================

export interface SourceChipsProps {
  /** Show counts per source */
  counts?: Partial<Record<IntelSource, number>>
  /** Compact mode (smaller chips) */
  compact?: boolean
  /** Additional class */
  className?: string
}

const SourceChips: FC<SourceChipsProps> = memo(function SourceChips({
  counts,
  compact = false,
  className,
}) {
  const { filters, toggleSource } = useFilterBar()
  const containerRef = useRef<HTMLDivElement>(null)

  // Animate on mount
  useEffect(() => {
    if (containerRef.current) {
      const children = Array.from(containerRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          scale: [0.9, 1],
          delay: i * 30,
          duration: TIMING.normal,
          ease: EASING.anime.out,
        })
      })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {ALL_SOURCES.map((source) => {
        const isActive = filters.sources.includes(source)
        const colors = SOURCE_COLORS[source]
        const Icon = SOURCE_ICONS[source]
        const count = counts?.[source]

        return (
          <button
            key={source}
            className={cn(
              'flex items-center gap-1.5 rounded-full border transition-all',
              compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
              isActive
                ? 'border-transparent'
                : 'border-border-subtle bg-surface-1 text-text-tertiary hover:bg-surface-2'
            )}
            style={isActive ? {
              backgroundColor: colors.muted,
              color: colors.primary,
              borderColor: `${colors.primary}40`,
            } : undefined}
            onClick={() => toggleSource(source)}
          >
            <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            <span>{SOURCE_LABELS[source]}</span>
            {count !== undefined && (
              <span className={cn(
                'rounded-full px-1.5 text-xs',
                isActive ? 'bg-white/20' : 'bg-surface-2'
              )}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
})

// =============================================================================
// CLASSIFICATION CHIPS
// =============================================================================

export interface ClassificationChipsProps {
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

const ClassificationChips: FC<ClassificationChipsProps> = memo(function ClassificationChips({
  compact = false,
  className,
}) {
  const { filters, toggleClassification } = useFilterBar()

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {ALL_CLASSIFICATIONS.map((classification) => {
        const isActive = filters.classifications.includes(classification)
        const colors = CLASSIFICATION_COLORS[classification]

        return (
          <button
            key={classification}
            className={cn(
              'flex items-center gap-1.5 rounded-full border transition-all',
              compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
              isActive
                ? 'border-transparent'
                : 'border-border-subtle bg-surface-1 text-text-tertiary hover:bg-surface-2'
            )}
            style={isActive ? {
              backgroundColor: colors.muted,
              color: colors.primary,
              borderColor: `${colors.primary}40`,
            } : undefined}
            onClick={() => toggleClassification(classification)}
          >
            <div
              className={cn('rounded-full', compact ? 'w-2 h-2' : 'w-2.5 h-2.5')}
              style={{ backgroundColor: colors.primary }}
            />
            <span>{CLASSIFICATION_LABELS[classification]}</span>
            {isActive && <Check className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
          </button>
        )
      })}
    </div>
  )
})

// =============================================================================
// CONFIDENCE SLIDER
// =============================================================================

export interface ConfidenceSliderProps {
  /** Additional class */
  className?: string
}

const ConfidenceSlider: FC<ConfidenceSliderProps> = memo(function ConfidenceSlider({
  className,
}) {
  const { filters, setMinConfidence } = useFilterBar()
  const sliderRef = useRef<HTMLInputElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  // Update fill width
  useEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${filters.minConfidence * 100}%`
    }
  }, [filters.minConfidence])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">Min Confidence</span>
        <span className="text-xs font-mono text-text-secondary">
          {(filters.minConfidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="relative h-2 bg-surface-2 rounded-full overflow-hidden">
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 bg-accent-primary/50 rounded-full transition-all"
        />
        <input
          ref={sliderRef}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={filters.minConfidence}
          onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
})

// =============================================================================
// BOUNDS INDICATOR
// =============================================================================

export interface BoundsIndicatorProps {
  /** Additional class */
  className?: string
}

const BoundsIndicator: FC<BoundsIndicatorProps> = memo(function BoundsIndicator({
  className,
}) {
  const { filters, setBounds } = useFilterBar()

  if (!filters.bounds) {
    return (
      <div className={cn('text-xs text-text-tertiary', className)}>
        <MapPin className="w-3 h-3 inline mr-1" />
        Global (no spatial filter)
      </div>
    )
  }

  const [minLon, minLat, maxLon, maxLat] = filters.bounds

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <MapPin className="w-3 h-3 text-accent-primary" />
      <span className="text-text-secondary font-mono">
        {minLat.toFixed(2)}°, {minLon.toFixed(2)}° → {maxLat.toFixed(2)}°, {maxLon.toFixed(2)}°
      </span>
      <button
        className="p-0.5 hover:bg-surface-2 rounded"
        onClick={() => setBounds(null)}
        title="Clear bounds"
      >
        <X className="w-3 h-3 text-text-tertiary hover:text-text-primary" />
      </button>
    </div>
  )
})

// =============================================================================
// ACTIVE FILTER SUMMARY
// =============================================================================

export interface ActiveFilterSummaryProps {
  /** Show reset button */
  showReset?: boolean
  /** Additional class */
  className?: string
}

const ActiveFilterSummary: FC<ActiveFilterSummaryProps> = memo(function ActiveFilterSummary({
  showReset = true,
  className,
}) {
  const { activeFilterCount, resetFilters } = useFilterBar()
  const badgeRef = useRef<HTMLSpanElement>(null)

  // Animate badge on change
  useEffect(() => {
    if (badgeRef.current && activeFilterCount > 0) {
      animate(badgeRef.current, {
        scale: [1.2, 1],
        duration: TIMING.fast,
        ease: EASING.anime.bounce,
      })
    }
  }, [activeFilterCount])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Filter className="w-4 h-4 text-text-tertiary" />
      <span className="text-sm text-text-secondary">Filters</span>
      {activeFilterCount > 0 && (
        <>
          <span
            ref={badgeRef}
            className="px-1.5 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary"
          >
            {activeFilterCount}
          </span>
          {showReset && (
            <button
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
              onClick={resetFilters}
            >
              Reset
            </button>
          )}
        </>
      )}
    </div>
  )
})

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================

export interface CollapsibleFilterSectionProps {
  /** Section title */
  title: string
  /** Default open state */
  defaultOpen?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

const CollapsibleSection: FC<CollapsibleFilterSectionProps> = ({
  title,
  defaultOpen = true,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)

  // Animate expand/collapse
  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        animate(contentRef.current, {
          height: [0, contentRef.current.scrollHeight],
          opacity: [0, 1],
          duration: TIMING.normal,
          ease: EASING.anime.out,
        })
      } else {
        animate(contentRef.current, {
          height: [contentRef.current.scrollHeight, 0],
          opacity: [1, 0],
          duration: TIMING.fast,
          ease: EASING.anime.in,
        })
      }
    }
  }, [isOpen])

  return (
    <div className={cn('border-b border-border-subtle', className)}>
      <button
        className="w-full flex items-center justify-between py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{ height: isOpen ? 'auto' : 0 }}
      >
        <div className="pb-3">{children}</div>
      </div>
    </div>
  )
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const FilterBar = Object.assign(Root, {
  Root,
  SourceChips,
  ClassificationChips,
  ConfidenceSlider,
  BoundsIndicator,
  ActiveFilterSummary,
  CollapsibleSection,
})

// Named exports for direct imports
export {
  Root as FilterBarRoot,
  SourceChips as FilterBarSourceChips,
  ClassificationChips as FilterBarClassificationChips,
  ConfidenceSlider as FilterBarConfidenceSlider,
  BoundsIndicator as FilterBarBoundsIndicator,
  ActiveFilterSummary as FilterBarActiveSummary,
  CollapsibleSection as FilterBarCollapsibleSection,
}

export default FilterBar
