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
  useMemo,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { Atom } from '@effect-atom/atom'
import { useMachine } from '@xstate/react'
import { animate, createTimeline } from 'animejs'
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
  Zap,
  Target,
  Shield,
  RefreshCw,
} from 'lucide-react'
import {
  filterBarMachine,
  FILTER_PRESETS,
  type FilterPreset,
  type FilterGroup,
  type FilterBarMachineInput,
} from '../machines/filterBarMachine'
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
          easing: EASING.anime.out,
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
        easing: EASING.anime.bounce,
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
          easing: EASING.anime.out,
        })
      } else {
        animate(contentRef.current, {
          height: [contentRef.current.scrollHeight, 0],
          opacity: [1, 0],
          duration: TIMING.fast,
          easing: EASING.anime.in,
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
// XSTATE-ENHANCED CONTEXT
// =============================================================================

export interface XStateFilterBarContextValue extends FilterBarContextValue {
  /** XState machine snapshot */
  machineState: ReturnType<typeof filterBarMachine.getInitialSnapshot>
  /** XState send function */
  machineSend: (event: Parameters<ReturnType<typeof useMachine<typeof filterBarMachine>>[1]>[0]) => void
  /** Active filter preset */
  activePreset: FilterPreset
  /** Expanded filter groups */
  expandedGroups: FilterGroup[]
  /** Whether preset dropdown is open */
  showPresetDropdown: boolean
  /** Hovered preset index */
  hoveredPresetIndex: number
  /** Apply a preset */
  applyPreset: (preset: FilterPreset) => void
  /** Toggle a filter group */
  toggleGroup: (group: FilterGroup) => void
}

const XStateFilterBarContext = createContext<XStateFilterBarContextValue | null>(null)

export const useXStateFilterBar = () => {
  const ctx = useContext(XStateFilterBarContext)
  if (!ctx) throw new Error('useXStateFilterBar must be used within FilterBarWithMachine.Root')
  return ctx
}

// =============================================================================
// XSTATE ROOT
// =============================================================================

export interface FilterBarWithMachineProps {
  /** Controlled filter state */
  filters?: FilterBarState
  /** Filter change callback */
  onFiltersChange?: (filters: FilterBarState) => void
  /** Initial preset */
  initialPreset?: FilterPreset
  /** Initial expanded groups */
  initialExpandedGroups?: FilterGroup[]
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

const XStateRoot: FC<FilterBarWithMachineProps> = ({
  filters: controlledFilters,
  onFiltersChange,
  initialPreset = 'all',
  initialExpandedGroups = ['sources', 'classifications'],
  children,
  className,
}) => {
  const [internalFilters, setInternalFilters] = useState<FilterBarState>(DEFAULT_FILTERS)
  const filters = controlledFilters ?? internalFilters

  const machineInput: FilterBarMachineInput = useMemo(() => ({
    initialPreset,
    initialExpandedGroups,
    keyboardEnabled: true,
  }), [initialPreset, initialExpandedGroups])

  const [state, send, actor] = useMachine(filterBarMachine, {
    input: machineInput,
  })

  // Handle emitted events from machine
  useEffect(() => {
    const subscription = actor.on('*', (event) => {
      if (event.type === 'onPresetApply') {
        const { config } = event as { config: typeof FILTER_PRESETS[0] }
        const newFilters: FilterBarState = {
          sources: [...config.sources],
          classifications: [...config.classifications],
          minConfidence: config.minConfidence,
          bounds: config.bounds,
          query: filters.query,
        }
        if (controlledFilters) {
          onFiltersChange?.(newFilters)
        } else {
          setInternalFilters(newFilters)
          onFiltersChange?.(newFilters)
        }
      } else if (event.type === 'onBatchSourceChange') {
        const { sources } = event as { sources: readonly IntelSource[] }
        const newFilters = { ...filters, sources: [...sources] }
        if (controlledFilters) {
          onFiltersChange?.(newFilters)
        } else {
          setInternalFilters(newFilters)
          onFiltersChange?.(newFilters)
        }
      } else if (event.type === 'onBatchClassificationChange') {
        const { classifications } = event as { classifications: readonly Classification[] }
        const newFilters = { ...filters, classifications: [...classifications] }
        if (controlledFilters) {
          onFiltersChange?.(newFilters)
        } else {
          setInternalFilters(newFilters)
          onFiltersChange?.(newFilters)
        }
      } else if (event.type === 'onResetFilters') {
        if (controlledFilters) {
          onFiltersChange?.(DEFAULT_FILTERS)
        } else {
          setInternalFilters(DEFAULT_FILTERS)
          onFiltersChange?.(DEFAULT_FILTERS)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [actor, filters, controlledFilters, onFiltersChange])

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      send({
        type: 'KEYBOARD_SHORTCUT',
        key: e.key,
        modifiers: {
          ctrl: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
        },
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [send])

  const updateFilters = useCallback((update: Partial<FilterBarState>) => {
    const newFilters = { ...filters, ...update }
    if (controlledFilters) {
      onFiltersChange?.(newFilters)
    } else {
      setInternalFilters(newFilters)
      onFiltersChange?.(newFilters)
    }
    // Mark as custom preset when filters change manually
    send({ type: 'FILTERS_CHANGED' })
  }, [filters, controlledFilters, onFiltersChange, send])

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
    send({ type: 'RESET_FILTERS' })
  }, [send])

  const applyPreset = useCallback((preset: FilterPreset) => {
    send({ type: 'APPLY_PRESET', preset })
  }, [send])

  const toggleGroup = useCallback((group: FilterGroup) => {
    send({ type: 'TOGGLE_GROUP', group })
  }, [send])

  const activeFilterCount =
    (filters.sources.length < ALL_SOURCES.length ? 1 : 0) +
    (filters.classifications.length < ALL_CLASSIFICATIONS.length ? 1 : 0) +
    (filters.minConfidence > 0 ? 1 : 0) +
    (filters.bounds !== null ? 1 : 0) +
    (filters.query.length > 0 ? 1 : 0)

  const contextValue: XStateFilterBarContextValue = {
    filters,
    toggleSource,
    toggleClassification,
    setMinConfidence,
    setBounds,
    setQuery,
    resetFilters,
    activeFilterCount,
    machineState: state,
    machineSend: send,
    activePreset: state.context.activePreset,
    expandedGroups: state.context.expandedGroups,
    showPresetDropdown: state.context.showPresetDropdown,
    hoveredPresetIndex: state.context.hoveredPresetIndex,
    applyPreset,
    toggleGroup,
  }

  return (
    <XStateFilterBarContext.Provider value={contextValue}>
      <div className={cn('flex flex-col gap-2', className)}>
        {children}
      </div>
    </XStateFilterBarContext.Provider>
  )
}

// =============================================================================
// PRESET SELECTOR (XState-enhanced)
// =============================================================================

const PRESET_ICONS: Record<FilterPreset, typeof Filter> = {
  all: Layers,
  tracks_only: Radio,
  high_confidence: Target,
  hostile_only: Shield,
  live_feeds: Zap,
  custom: Filter,
}

export interface PresetSelectorProps {
  /** Compact mode */
  compact?: boolean
  /** Additional class */
  className?: string
}

const PresetSelector: FC<PresetSelectorProps> = memo(function PresetSelector({
  compact = false,
  className,
}) {
  const {
    activePreset,
    showPresetDropdown,
    hoveredPresetIndex,
    applyPreset,
    machineSend,
  } = useXStateFilterBar()

  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Animate dropdown
  useEffect(() => {
    if (dropdownRef.current) {
      if (showPresetDropdown) {
        animate(dropdownRef.current, {
          opacity: [0, 1],
          translateY: [-8, 0],
          duration: TIMING.fast,
          easing: EASING.anime.out,
        })
      }
    }
  }, [showPresetDropdown])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showPresetDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        machineSend({ type: 'PRESET_KEYBOARD', direction: 'down' })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        machineSend({ type: 'PRESET_KEYBOARD', direction: 'up' })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        machineSend({ type: 'PRESET_KEYBOARD', direction: 'select' })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        machineSend({ type: 'CLOSE_PRESET_DROPDOWN' })
      }
    }
  }, [showPresetDropdown, machineSend])

  const activeConfig = FILTER_PRESETS.find((p) => p.id === activePreset)
  const ActiveIcon = PRESET_ICONS[activePreset]

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-1',
          'hover:bg-surface-2 transition-colors',
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        )}
        onClick={() => machineSend({ type: 'TOGGLE_PRESET_DROPDOWN' })}
        onKeyDown={handleKeyDown}
      >
        <ActiveIcon className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="text-text-secondary">
          {activeConfig?.label ?? 'Custom'}
        </span>
        {activeConfig?.shortcut && (
          <kbd className="text-xs text-text-tertiary bg-surface-2 px-1 rounded">
            {activeConfig.shortcut}
          </kbd>
        )}
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform',
            showPresetDropdown && 'rotate-180'
          )}
        />
      </button>

      {showPresetDropdown && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute z-50 top-full left-0 mt-1 w-56',
            'bg-surface-1 border border-border-subtle rounded-lg shadow-lg',
            'py-1 overflow-hidden'
          )}
        >
          {FILTER_PRESETS.map((preset, index) => {
            const Icon = PRESET_ICONS[preset.id]
            const isActive = activePreset === preset.id
            const isHovered = hoveredPresetIndex === index

            return (
              <button
                key={preset.id}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm',
                  'transition-colors',
                  isHovered && 'bg-surface-2',
                  isActive && 'text-accent-primary'
                )}
                onClick={() => applyPreset(preset.id)}
                onMouseEnter={() => machineSend({ type: 'HOVER_PRESET', index })}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{preset.label}</span>
                {preset.shortcut && (
                  <kbd className="text-xs text-text-tertiary bg-surface-2 px-1.5 rounded">
                    {preset.shortcut}
                  </kbd>
                )}
                {isActive && <Check className="w-4 h-4 text-accent-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// XSTATE COLLAPSIBLE GROUP
// =============================================================================

export interface XStateGroupProps {
  /** Filter group identifier */
  group: FilterGroup
  /** Section title */
  title: string
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

const XStateGroup: FC<XStateGroupProps> = ({
  group,
  title,
  children,
  className,
}) => {
  const { expandedGroups, toggleGroup, machineState } = useXStateFilterBar()
  const isOpen = expandedGroups.includes(group)
  const contentRef = useRef<HTMLDivElement>(null)
  const isAnimating = machineState.context.animatingGroup === group

  // Animate expand/collapse
  useEffect(() => {
    if (contentRef.current && isAnimating) {
      if (isOpen) {
        animate(contentRef.current, {
          height: [0, contentRef.current.scrollHeight],
          opacity: [0, 1],
          duration: TIMING.normal,
          easing: EASING.anime.out,
        })
      } else {
        animate(contentRef.current, {
          height: [contentRef.current.scrollHeight, 0],
          opacity: [1, 0],
          duration: TIMING.fast,
          easing: EASING.anime.in,
        })
      }
    }
  }, [isOpen, isAnimating])

  return (
    <div className={cn('border-b border-border-subtle', className)}>
      <button
        className="w-full flex items-center justify-between py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        onClick={() => toggleGroup(group)}
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
        style={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
      >
        <div className="pb-3">{children}</div>
      </div>
    </div>
  )
}

// =============================================================================
// XSTATE ACTIVE SUMMARY
// =============================================================================

export interface XStateActiveSummaryProps {
  /** Show reset button */
  showReset?: boolean
  /** Show preset selector */
  showPreset?: boolean
  /** Additional class */
  className?: string
}

const XStateActiveSummary: FC<XStateActiveSummaryProps> = memo(function XStateActiveSummary({
  showReset = true,
  showPreset = true,
  className,
}) {
  const { activeFilterCount, resetFilters, activePreset } = useXStateFilterBar()
  const badgeRef = useRef<HTMLSpanElement>(null)

  // Animate badge on change
  useEffect(() => {
    if (badgeRef.current && activeFilterCount > 0) {
      animate(badgeRef.current, {
        scale: [1.2, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
      })
    }
  }, [activeFilterCount])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm text-text-secondary">Filters</span>
        {activeFilterCount > 0 && (
          <span
            ref={badgeRef}
            className="px-1.5 py-0.5 text-xs rounded-full bg-accent-primary/20 text-accent-primary"
          >
            {activeFilterCount}
          </span>
        )}
      </div>

      {activePreset !== 'custom' && (
        <span className="text-xs text-text-tertiary">
          Preset: {FILTER_PRESETS.find((p) => p.id === activePreset)?.label}
        </span>
      )}

      {showPreset && <PresetSelector compact />}

      {showReset && activeFilterCount > 0 && (
        <button
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          onClick={resetFilters}
        >
          <RefreshCw className="w-3 h-3" />
          Reset
        </button>
      )}
    </div>
  )
})

// =============================================================================
// XSTATE SOURCE CHIPS (with batch operations)
// =============================================================================

export interface XStateSourceChipsProps {
  /** Show counts per source */
  counts?: Partial<Record<IntelSource, number>>
  /** Compact mode */
  compact?: boolean
  /** Show batch buttons */
  showBatchButtons?: boolean
  /** Additional class */
  className?: string
}

const XStateSourceChips: FC<XStateSourceChipsProps> = memo(function XStateSourceChips({
  counts,
  compact = false,
  showBatchButtons = false,
  className,
}) {
  const { filters, toggleSource, machineSend } = useXStateFilterBar()
  const containerRef = useRef<HTMLDivElement>(null)

  // Stagger animation on mount
  useEffect(() => {
    if (containerRef.current) {
      const timeline = createTimeline({ defaults: { easing: EASING.anime.out } })
      const children = Array.from(containerRef.current.querySelectorAll('.source-chip'))
      children.forEach((child, i) => {
        timeline.add(child, {
          opacity: [0, 1],
          scale: [0.9, 1],
          delay: i * 30,
          duration: TIMING.normal,
        }, i * 20)
      })
    }
  }, [])

  const allSelected = filters.sources.length === ALL_SOURCES.length
  const noneSelected = filters.sources.length === 0

  return (
    <div className={cn('space-y-2', className)}>
      {showBatchButtons && (
        <div className="flex gap-2">
          <button
            className={cn(
              'text-xs px-2 py-0.5 rounded border transition-colors',
              allSelected
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-subtle text-text-tertiary hover:text-text-secondary'
            )}
            onClick={() => machineSend({ type: 'ENABLE_ALL_SOURCES' })}
          >
            All
          </button>
          <button
            className={cn(
              'text-xs px-2 py-0.5 rounded border transition-colors',
              noneSelected
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-subtle text-text-tertiary hover:text-text-secondary'
            )}
            onClick={() => machineSend({ type: 'DISABLE_ALL_SOURCES' })}
          >
            None
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex flex-wrap gap-1.5">
        {ALL_SOURCES.map((source) => {
          const isActive = filters.sources.includes(source)
          const colors = SOURCE_COLORS[source]
          const Icon = SOURCE_ICONS[source]
          const count = counts?.[source]

          return (
            <button
              key={source}
              className={cn(
                'source-chip flex items-center gap-1.5 rounded-full border transition-all',
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
    </div>
  )
})

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

/** XState-enhanced FilterBar with preset support */
export const FilterBarWithMachine = Object.assign(XStateRoot, {
  Root: XStateRoot,
  SourceChips: XStateSourceChips,
  ClassificationChips,
  ConfidenceSlider,
  BoundsIndicator,
  ActiveFilterSummary: XStateActiveSummary,
  Group: XStateGroup,
  PresetSelector,
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
  // XState-enhanced
  XStateRoot as FilterBarXStateRoot,
  XStateSourceChips as FilterBarXStateSourceChips,
  XStateGroup as FilterBarXStateGroup,
  XStateActiveSummary as FilterBarXStateActiveSummary,
  PresetSelector as FilterBarPresetSelector,
  // Note: useXStateFilterBar is exported where it's defined (line 660)
}

export default FilterBar
