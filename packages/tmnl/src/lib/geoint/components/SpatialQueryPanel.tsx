/**
 * SpatialQueryPanel - Visual Polygon/Radius Search Interface
 *
 * Provides a spatial query interface for drawing search areas on the map:
 * - Polygon draw mode - freeform area selection
 * - Circle/radius mode - point + radius selection
 * - Rectangle mode - bounding box selection
 * - Buffer mode - expand selection by distance
 *
 * Compound component architecture:
 * - SpatialQueryPanel.Root - Main container with mode management
 * - SpatialQueryPanel.ModeSelector - Draw mode toggle buttons
 * - SpatialQueryPanel.DrawControls - Drawing action buttons
 * - SpatialQueryPanel.RadiusInput - Radius configuration for circle mode
 * - SpatialQueryPanel.BufferInput - Buffer distance configuration
 * - SpatialQueryPanel.SourceFilter - Filter sources to search
 * - SpatialQueryPanel.Preview - Results preview panel
 * - SpatialQueryPanel.ExecuteButton - Run the search
 *
 * @module geoint/components/SpatialQueryPanel
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  Pentagon,
  Circle,
  Square,
  Maximize,
  Trash2,
  Undo,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  Ruler,
  Layers,
  Search,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING, SOURCE_COLORS } from '../tokens'
import type { IntelSource } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export type DrawMode = 'polygon' | 'circle' | 'rectangle' | 'buffer'
export type DrawStatus = 'idle' | 'drawing' | 'complete' | 'error'

export interface SpatialGeometry {
  /** Geometry type */
  type: 'polygon' | 'circle' | 'rectangle'
  /** Coordinates - polygon ring, circle center, or rectangle corners */
  coordinates: readonly [number, number][]
  /** Radius in meters (for circle mode) */
  radius?: number
  /** Buffer distance in meters */
  buffer?: number
}

export interface SpatialQueryContextValue {
  /** Current draw mode */
  mode: DrawMode
  /** Set draw mode */
  setMode: (mode: DrawMode) => void
  /** Current draw status */
  status: DrawStatus
  /** Current geometry being drawn */
  geometry: SpatialGeometry | null
  /** Radius for circle mode (meters) */
  radius: number
  /** Set radius */
  setRadius: (radius: number) => void
  /** Buffer distance (meters) */
  buffer: number
  /** Set buffer */
  setBuffer: (buffer: number) => void
  /** Selected sources to search */
  selectedSources: readonly IntelSource[]
  /** Toggle source selection */
  toggleSource: (source: IntelSource) => void
  /** Clear the current geometry */
  clearGeometry: () => void
  /** Undo last point (polygon mode) */
  undoPoint: () => void
  /** Execute the search */
  executeSearch: () => void
  /** Preview result count */
  previewCount: number | null
  /** Is searching */
  isSearching: boolean
  /** Compact mode */
  compact: boolean
  /** Close handler */
  onClose?: () => void
}

export interface SpatialQueryPanelRootProps {
  /** Initial draw mode */
  initialMode?: DrawMode
  /** Default radius in meters */
  defaultRadius?: number
  /** Default buffer in meters */
  defaultBuffer?: number
  /** Available sources */
  availableSources?: readonly IntelSource[]
  /** Geometry change handler */
  onGeometryChange?: (geometry: SpatialGeometry | null) => void
  /** Search handler */
  onSearch?: (geometry: SpatialGeometry, sources: readonly IntelSource[]) => Promise<number>
  /** Close handler */
  onClose?: () => void
  /** Compact mode */
  compact?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

const SpatialQueryContext = createContext<SpatialQueryContextValue | null>(null)

export const useSpatialQuery = () => {
  const ctx = useContext(SpatialQueryContext)
  if (!ctx) throw new Error('useSpatialQuery must be used within SpatialQueryPanel.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MODE_CONFIG: { mode: DrawMode; label: string; icon: typeof Pentagon; description: string }[] = [
  { mode: 'polygon', label: 'Polygon', icon: Pentagon, description: 'Draw a freeform area' },
  { mode: 'circle', label: 'Circle', icon: Circle, description: 'Click center, set radius' },
  { mode: 'rectangle', label: 'Rectangle', icon: Square, description: 'Draw a bounding box' },
  { mode: 'buffer', label: 'Buffer', icon: Maximize, description: 'Expand selection area' },
]

const DEFAULT_SOURCES: IntelSource[] = ['track', 'osm', 'opensky', 'adsb_lol', 'feature']

const RADIUS_PRESETS = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
  { label: '100 km', value: 100000 },
]

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<SpatialQueryPanelRootProps> = ({
  initialMode = 'polygon',
  defaultRadius = 5000,
  defaultBuffer = 0,
  availableSources = DEFAULT_SOURCES,
  onGeometryChange,
  onSearch,
  onClose,
  compact = false,
  children,
  className,
}) => {
  const [mode, setMode] = useState<DrawMode>(initialMode)
  const [status, setStatus] = useState<DrawStatus>('idle')
  const [geometry, setGeometry] = useState<SpatialGeometry | null>(null)
  const [radius, setRadius] = useState(defaultRadius)
  const [buffer, setBuffer] = useState(defaultBuffer)
  const [selectedSources, setSelectedSources] = useState<IntelSource[]>([...availableSources])
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: TIMING.normal,
        easing: EASING.anime.out,
      })
    }
  }, [])

  // Notify geometry changes
  useEffect(() => {
    onGeometryChange?.(geometry)
  }, [geometry, onGeometryChange])

  const toggleSource = useCallback((source: IntelSource) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }, [])

  const clearGeometry = useCallback(() => {
    setGeometry(null)
    setStatus('idle')
    setPreviewCount(null)
  }, [])

  const undoPoint = useCallback(() => {
    // For polygon mode, remove last point
    if (geometry?.type === 'polygon' && geometry.coordinates.length > 0) {
      const newCoords = geometry.coordinates.slice(0, -1)
      if (newCoords.length === 0) {
        clearGeometry()
      } else {
        setGeometry({ ...geometry, coordinates: newCoords })
      }
    }
  }, [geometry, clearGeometry])

  const executeSearch = useCallback(async () => {
    if (!geometry || !onSearch) return

    setIsSearching(true)
    try {
      const count = await onSearch(geometry, selectedSources)
      setPreviewCount(count)
      setStatus('complete')
    } catch {
      setStatus('error')
    } finally {
      setIsSearching(false)
    }
  }, [geometry, selectedSources, onSearch])

  const contextValue: SpatialQueryContextValue = {
    mode,
    setMode,
    status,
    geometry,
    radius,
    setRadius,
    buffer,
    setBuffer,
    selectedSources,
    toggleSource,
    clearGeometry,
    undoPoint,
    executeSearch,
    previewCount,
    isSearching,
    compact,
    onClose,
  }

  return (
    <SpatialQueryContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {children}
      </div>
    </SpatialQueryContext.Provider>
  )
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

export interface HeaderProps {
  /** Additional class */
  className?: string
}

const Header: FC<HeaderProps> = memo(function Header({ className }) {
  const { onClose, compact } = useSpatialQuery()
  const headerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={headerRef}
      className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border-subtle',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-accent-primary" />
        <span className={cn(
          'font-medium text-text-primary',
          compact ? 'text-sm' : 'text-base'
        )}>
          Spatial Query
        </span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary hover:text-text-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})

// =============================================================================
// MODE SELECTOR COMPONENT
// =============================================================================

export interface ModeSelectorProps {
  /** Additional class */
  className?: string
}

const ModeSelector: FC<ModeSelectorProps> = memo(function ModeSelector({ className }) {
  const { mode, setMode, compact } = useSpatialQuery()
  const selectorRef = useRef<HTMLDivElement>(null)

  const handleModeChange = (newMode: DrawMode) => {
    setMode(newMode)
    // Animate the clicked button
    if (selectorRef.current) {
      const button = selectorRef.current.querySelector(`[data-mode="${newMode}"]`)
      if (button) {
        animate(button, {
          scale: [0.95, 1],
          duration: TIMING.fast,
          easing: EASING.anime.bounce,
        })
      }
    }
  }

  return (
    <div ref={selectorRef} className={cn('p-3 space-y-2', className)}>
      <span className="text-xs text-text-tertiary uppercase font-mono">Draw Mode</span>
      <div className={cn(
        'grid gap-2',
        compact ? 'grid-cols-2' : 'grid-cols-4'
      )}>
        {MODE_CONFIG.map(config => {
          const Icon = config.icon
          const isActive = mode === config.mode

          return (
            <button
              key={config.mode}
              data-mode={config.mode}
              onClick={() => handleModeChange(config.mode)}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                isActive
                  ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                  : 'bg-surface-2 border-transparent text-text-secondary hover:bg-surface-3'
              )}
              title={config.description}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})

// =============================================================================
// DRAW CONTROLS COMPONENT
// =============================================================================

export interface DrawControlsProps {
  /** Additional class */
  className?: string
}

const DrawControls: FC<DrawControlsProps> = memo(function DrawControls({ className }) {
  const { geometry, clearGeometry, undoPoint, mode, compact } = useSpatialQuery()

  return (
    <div className={cn('flex items-center gap-2 px-3 pb-3', className)}>
      <button
        onClick={undoPoint}
        disabled={mode !== 'polygon' || !geometry || geometry.coordinates.length === 0}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Undo last point"
      >
        <Undo className="w-3.5 h-3.5" />
        {!compact && <span>Undo</span>}
      </button>

      <button
        onClick={clearGeometry}
        disabled={!geometry}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
          'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        title="Clear selection"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {!compact && <span>Clear</span>}
      </button>

      {geometry && (
        <div className="flex-1 text-right">
          <span className="text-xs text-text-tertiary font-mono">
            {geometry.type === 'polygon' && `${geometry.coordinates.length} points`}
            {geometry.type === 'circle' && `radius: ${(geometry.radius ?? 0) / 1000}km`}
            {geometry.type === 'rectangle' && 'bounding box'}
          </span>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// RADIUS INPUT COMPONENT
// =============================================================================

export interface RadiusInputProps {
  /** Additional class */
  className?: string
}

const RadiusInput: FC<RadiusInputProps> = memo(function RadiusInput({ className }) {
  const { mode, radius, setRadius } = useSpatialQuery()
  const [isExpanded, setIsExpanded] = useState(false)

  if (mode !== 'circle') return null

  return (
    <div className={cn('px-3 pb-3 space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary uppercase font-mono flex items-center gap-1">
          <Ruler className="w-3 h-3" />
          Radius
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-tertiary hover:text-text-secondary"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick presets */}
      <div className={cn('flex flex-wrap gap-1', !isExpanded && 'hidden')}>
        {RADIUS_PRESETS.map(preset => (
          <button
            key={preset.value}
            onClick={() => setRadius(preset.value)}
            className={cn(
              'px-2 py-1 rounded text-xs transition-colors',
              radius === preset.value
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={500}
          max={100000}
          step={500}
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
          className="flex-1 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-accent-primary"
        />
        <span className="w-16 text-right text-xs font-mono text-text-secondary tabular-nums">
          {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
        </span>
      </div>
    </div>
  )
})

// =============================================================================
// BUFFER INPUT COMPONENT
// =============================================================================

export interface BufferInputProps {
  /** Additional class */
  className?: string
}

const BufferInput: FC<BufferInputProps> = memo(function BufferInput({ className }) {
  const { mode, buffer, setBuffer } = useSpatialQuery()

  if (mode !== 'buffer') return null

  return (
    <div className={cn('px-3 pb-3 space-y-2', className)}>
      <span className="text-xs text-text-tertiary uppercase font-mono flex items-center gap-1">
        <Maximize className="w-3 h-3" />
        Buffer Distance
      </span>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={50000}
          step={100}
          value={buffer}
          onChange={e => setBuffer(Number(e.target.value))}
          className="flex-1 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer accent-accent-primary"
        />
        <span className="w-16 text-right text-xs font-mono text-text-secondary tabular-nums">
          {buffer >= 1000 ? `${(buffer / 1000).toFixed(1)}km` : `${buffer}m`}
        </span>
      </div>
    </div>
  )
})

// =============================================================================
// SOURCE FILTER COMPONENT
// =============================================================================

export interface SourceFilterProps {
  /** Available sources */
  sources?: readonly IntelSource[]
  /** Additional class */
  className?: string
}

const SourceFilter: FC<SourceFilterProps> = memo(function SourceFilter({
  sources = DEFAULT_SOURCES,
  className,
}) {
  const { selectedSources, toggleSource } = useSpatialQuery()
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className={cn('px-3 pb-3 space-y-2', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-text-tertiary uppercase font-mono"
      >
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Sources ({selectedSources.length})
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="flex flex-wrap gap-1">
          {sources.map(source => {
            const colors = SOURCE_COLORS[source]
            const isSelected = selectedSources.includes(source)

            return (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-all',
                  isSelected
                    ? `${colors.tailwind.bg} ${colors.tailwind.primary}`
                    : 'bg-surface-2 text-text-tertiary hover:bg-surface-3'
                )}
              >
                <span
                  className={cn(
                    'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                    isSelected ? 'opacity-100' : 'opacity-50'
                  )}
                  style={{ backgroundColor: colors.primary }}
                />
                {source}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// PREVIEW COMPONENT
// =============================================================================

export interface PreviewProps {
  /** Additional class */
  className?: string
}

const Preview: FC<PreviewProps> = memo(function Preview({ className }) {
  const { geometry, previewCount, status } = useSpatialQuery()
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (previewRef.current && previewCount != null) {
      animate(previewRef.current, {
        scale: [0.95, 1],
        opacity: [0, 1],
        duration: TIMING.fast,
        easing: EASING.anime.bounce,
      })
    }
  }, [previewCount])

  if (!geometry) return null

  return (
    <div
      ref={previewRef}
      className={cn(
        'mx-3 mb-3 p-3 rounded-lg border',
        status === 'error'
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-surface-2 border-border-subtle',
        className
      )}
    >
      {status === 'error' ? (
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs">Search failed. Try again.</span>
        </div>
      ) : previewCount != null ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent-primary" />
            <span className="text-sm text-text-secondary">Entities found</span>
          </div>
          <span className="font-mono font-semibold text-text-primary tabular-nums">
            {previewCount.toLocaleString()}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-text-tertiary">
          <Search className="w-4 h-4" />
          <span className="text-xs">Ready to search</span>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// EXECUTE BUTTON COMPONENT
// =============================================================================

export interface ExecuteButtonProps {
  /** Button label */
  label?: string
  /** Additional class */
  className?: string
}

const ExecuteButton: FC<ExecuteButtonProps> = memo(function ExecuteButton({
  label = 'Search Area',
  className,
}) {
  const { geometry, selectedSources, executeSearch, isSearching } = useSpatialQuery()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isDisabled = !geometry || selectedSources.length === 0 || isSearching

  const handleClick = () => {
    if (buttonRef.current && !isDisabled) {
      animate(buttonRef.current, {
        scale: [1, 0.97, 1],
        duration: TIMING.fast,
        easing: EASING.anime.out,
      })
    }
    executeSearch()
  }

  return (
    <div className={cn('p-3 border-t border-border-subtle', className)}>
      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
          'text-sm font-medium transition-all',
          isDisabled
            ? 'bg-surface-2 text-text-tertiary cursor-not-allowed'
            : 'bg-accent-primary text-white hover:bg-accent-primary/90'
        )}
      >
        {isSearching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Searching...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>{label}</span>
          </>
        )}
      </button>
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const SpatialQueryPanel = Object.assign(Root, {
  Root,
  Header,
  ModeSelector,
  DrawControls,
  RadiusInput,
  BufferInput,
  SourceFilter,
  Preview,
  ExecuteButton,
})

// Named exports
export {
  Root as SpatialQueryPanelRoot,
  Header as SpatialQueryPanelHeader,
  ModeSelector as SpatialQueryPanelModeSelector,
  DrawControls as SpatialQueryPanelDrawControls,
  RadiusInput as SpatialQueryPanelRadiusInput,
  BufferInput as SpatialQueryPanelBufferInput,
  SourceFilter as SpatialQueryPanelSourceFilter,
  Preview as SpatialQueryPanelPreview,
  ExecuteButton as SpatialQueryPanelExecuteButton,
}

export default SpatialQueryPanel
