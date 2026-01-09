/**
 * MeasurementTools - Distance, Area, and Bearing Measurement
 *
 * Provides map measurement capabilities:
 * - Distance measurement (line/path)
 * - Area measurement (polygon)
 * - Bearing/heading calculation
 * - Multiple unit support (metric, imperial, nautical)
 *
 * Compound component architecture:
 * - MeasurementTools.Root - Container with measurement state
 * - MeasurementTools.ModeSelector - Measurement type toggle
 * - MeasurementTools.UnitSelector - Unit system toggle
 * - MeasurementTools.Results - Measurement results display
 * - MeasurementTools.History - Previous measurements list
 * - MeasurementTools.ClearButton - Clear current measurement
 *
 * @module geoint/components/MeasurementTools
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
  Ruler,
  Move,
  Compass,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  X,
  Plus,
  History,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIMING, EASING } from '../tokens'

// =============================================================================
// TYPES
// =============================================================================

export type MeasurementMode = 'distance' | 'area' | 'bearing'
export type UnitSystem = 'metric' | 'imperial' | 'nautical'

export interface MeasurementPoint {
  /** Longitude */
  longitude: number
  /** Latitude */
  latitude: number
}

export interface MeasurementResult {
  /** Unique ID */
  id: string
  /** Measurement mode */
  mode: MeasurementMode
  /** Points used */
  points: readonly MeasurementPoint[]
  /** Primary value (distance in meters, area in sq meters, bearing in degrees) */
  value: number
  /** Secondary value (total for multi-segment, reverse bearing, etc.) */
  secondaryValue?: number
  /** Timestamp */
  timestamp: Date
  /** Label */
  label?: string
}

export interface MeasurementContextValue {
  /** Current measurement mode */
  mode: MeasurementMode
  /** Set measurement mode */
  setMode: (mode: MeasurementMode) => void
  /** Current unit system */
  units: UnitSystem
  /** Set unit system */
  setUnits: (units: UnitSystem) => void
  /** Current points being measured */
  points: readonly MeasurementPoint[]
  /** Add a point */
  addPoint: (point: MeasurementPoint) => void
  /** Remove last point */
  removeLastPoint: () => void
  /** Clear all points */
  clearPoints: () => void
  /** Complete current measurement */
  completeMeasurement: () => void
  /** Current result (live calculation) */
  currentResult: MeasurementResult | null
  /** Measurement history */
  history: readonly MeasurementResult[]
  /** Clear history */
  clearHistory: () => void
  /** Delete from history */
  deleteFromHistory: (id: string) => void
  /** Is measuring */
  isMeasuring: boolean
  /** Compact mode */
  compact: boolean
}

export interface MeasurementToolsRootProps {
  /** Initial mode */
  initialMode?: MeasurementMode
  /** Initial units */
  initialUnits?: UnitSystem
  /** Point added callback (for map integration) */
  onPointAdded?: (point: MeasurementPoint) => void
  /** Measurement completed callback */
  onMeasurementComplete?: (result: MeasurementResult) => void
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

const MeasurementContext = createContext<MeasurementContextValue | null>(null)

export const useMeasurement = () => {
  const ctx = useContext(MeasurementContext)
  if (!ctx) throw new Error('useMeasurement must be used within MeasurementTools.Root')
  return ctx
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MODE_CONFIG: { mode: MeasurementMode; label: string; icon: typeof Ruler; description: string }[] = [
  { mode: 'distance', label: 'Distance', icon: Ruler, description: 'Measure path length' },
  { mode: 'area', label: 'Area', icon: Move, description: 'Measure polygon area' },
  { mode: 'bearing', label: 'Bearing', icon: Compass, description: 'Measure heading' },
]

const UNIT_CONFIG: Record<UnitSystem, { label: string; distanceUnit: string; areaUnit: string }> = {
  metric: { label: 'Metric', distanceUnit: 'km', areaUnit: 'km²' },
  imperial: { label: 'Imperial', distanceUnit: 'mi', areaUnit: 'mi²' },
  nautical: { label: 'Nautical', distanceUnit: 'nm', areaUnit: 'nm²' },
}

// =============================================================================
// CALCULATION UTILITIES
// =============================================================================

const EARTH_RADIUS_M = 6371000 // meters
const DEG_TO_RAD = Math.PI / 180

/**
 * Calculate distance between two points using Haversine formula
 */
const haversineDistance = (p1: MeasurementPoint, p2: MeasurementPoint): number => {
  const lat1 = p1.latitude * DEG_TO_RAD
  const lat2 = p2.latitude * DEG_TO_RAD
  const deltaLat = (p2.latitude - p1.latitude) * DEG_TO_RAD
  const deltaLon = (p2.longitude - p1.longitude) * DEG_TO_RAD

  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_M * c
}

/**
 * Calculate total path distance
 */
const calculatePathDistance = (points: readonly MeasurementPoint[]): number => {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i])
  }
  return total
}

/**
 * Calculate polygon area using spherical excess formula
 */
const calculatePolygonArea = (points: readonly MeasurementPoint[]): number => {
  if (points.length < 3) return 0

  // Simplified planar approximation for small areas
  // For production, use proper spherical geometry
  let area = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].longitude * points[j].latitude
    area -= points[j].longitude * points[i].latitude
  }

  area = Math.abs(area) / 2

  // Convert to square meters (rough approximation)
  const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / n
  const latScale = 111320 // meters per degree latitude
  const lonScale = 111320 * Math.cos(avgLat * DEG_TO_RAD) // meters per degree longitude

  return area * latScale * lonScale
}

/**
 * Calculate bearing from point 1 to point 2
 */
const calculateBearing = (p1: MeasurementPoint, p2: MeasurementPoint): number => {
  const lat1 = p1.latitude * DEG_TO_RAD
  const lat2 = p2.latitude * DEG_TO_RAD
  const deltaLon = (p2.longitude - p1.longitude) * DEG_TO_RAD

  const x = Math.sin(deltaLon) * Math.cos(lat2)
  const y = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)

  let bearing = Math.atan2(x, y) / DEG_TO_RAD
  bearing = (bearing + 360) % 360

  return bearing
}

/**
 * Convert meters to display units
 */
const convertDistance = (meters: number, units: UnitSystem): number => {
  switch (units) {
    case 'metric':
      return meters / 1000 // km
    case 'imperial':
      return meters / 1609.344 // miles
    case 'nautical':
      return meters / 1852 // nautical miles
  }
}

/**
 * Convert square meters to display units
 */
const convertArea = (sqMeters: number, units: UnitSystem): number => {
  switch (units) {
    case 'metric':
      return sqMeters / 1000000 // km²
    case 'imperial':
      return sqMeters / 2589988.11 // mi²
    case 'nautical':
      return sqMeters / 3429904 // nm²
  }
}

/**
 * Format a number for display
 */
const formatValue = (value: number, decimals = 2): string => {
  if (value < 0.01) return value.toExponential(decimals)
  if (value < 1) return value.toFixed(decimals + 1)
  if (value < 100) return value.toFixed(decimals)
  return value.toFixed(1)
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<MeasurementToolsRootProps> = ({
  initialMode = 'distance',
  initialUnits = 'metric',
  onPointAdded,
  onMeasurementComplete,
  onClose,
  compact = false,
  children,
  className,
}) => {
  const [mode, setMode] = useState<MeasurementMode>(initialMode)
  const [units, setUnits] = useState<UnitSystem>(initialUnits)
  const [points, setPoints] = useState<MeasurementPoint[]>([])
  const [history, setHistory] = useState<MeasurementResult[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [-10, 0],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [])

  // Calculate current result
  const currentResult: MeasurementResult | null = points.length >= (mode === 'bearing' ? 2 : 1)
    ? {
        id: 'current',
        mode,
        points,
        value: mode === 'distance'
          ? calculatePathDistance(points)
          : mode === 'area'
            ? calculatePolygonArea(points)
            : points.length >= 2
              ? calculateBearing(points[0], points[1])
              : 0,
        secondaryValue: mode === 'bearing' && points.length >= 2
          ? (calculateBearing(points[0], points[1]) + 180) % 360
          : undefined,
        timestamp: new Date(),
      }
    : null

  const addPoint = useCallback((point: MeasurementPoint) => {
    setPoints(prev => [...prev, point])
    onPointAdded?.(point)
  }, [onPointAdded])

  const removeLastPoint = useCallback(() => {
    setPoints(prev => prev.slice(0, -1))
  }, [])

  const clearPoints = useCallback(() => {
    setPoints([])
  }, [])

  const completeMeasurement = useCallback(() => {
    if (currentResult && currentResult.value > 0) {
      const result: MeasurementResult = {
        ...currentResult,
        id: `measurement-${Date.now()}`,
        timestamp: new Date(),
      }
      setHistory(prev => [result, ...prev])
      onMeasurementComplete?.(result)
      setPoints([])
    }
  }, [currentResult, onMeasurementComplete])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(m => m.id !== id))
  }, [])

  const isMeasuring = points.length > 0

  const contextValue: MeasurementContextValue = {
    mode,
    setMode,
    units,
    setUnits,
    points,
    addPoint,
    removeLastPoint,
    clearPoints,
    completeMeasurement,
    currentResult,
    history,
    clearHistory,
    deleteFromHistory,
    isMeasuring,
    compact,
  }

  return (
    <MeasurementContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={cn(
          'flex flex-col bg-surface-1 border border-border-subtle rounded-lg overflow-hidden',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-accent-primary" />
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-sm' : 'text-base'
            )}>
              Measure
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

        {children}
      </div>
    </MeasurementContext.Provider>
  )
}

// =============================================================================
// MODE SELECTOR COMPONENT
// =============================================================================

export interface ModeSelectorProps {
  /** Additional class */
  className?: string
}

const ModeSelector: FC<ModeSelectorProps> = memo(function ModeSelector({ className }) {
  const { mode, setMode, clearPoints, compact } = useMeasurement()

  const handleModeChange = (newMode: MeasurementMode) => {
    if (newMode !== mode) {
      clearPoints()
      setMode(newMode)
    }
  }

  return (
    <div className={cn('p-3 space-y-2', className)}>
      <span className="text-xs text-text-tertiary uppercase font-mono">Mode</span>
      <div className={cn(
        'grid gap-1',
        compact ? 'grid-cols-3' : 'grid-cols-3'
      )}>
        {MODE_CONFIG.map(config => {
          const Icon = config.icon
          const isActive = mode === config.mode

          return (
            <button
              key={config.mode}
              onClick={() => handleModeChange(config.mode)}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                isActive
                  ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                  : 'bg-surface-2 border-transparent text-text-secondary hover:bg-surface-3'
              )}
              title={config.description}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})

// =============================================================================
// UNIT SELECTOR COMPONENT
// =============================================================================

export interface UnitSelectorProps {
  /** Additional class */
  className?: string
}

const UnitSelector: FC<UnitSelectorProps> = memo(function UnitSelector({ className }) {
  const { units, setUnits } = useMeasurement()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('px-3 pb-3', className)}>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-sm"
        >
          <span className="text-text-secondary">{UNIT_CONFIG[units].label}</span>
          <ChevronDown className={cn(
            'w-4 h-4 text-text-tertiary transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-1 border border-border-subtle rounded-lg shadow-lg overflow-hidden z-10">
            {(Object.keys(UNIT_CONFIG) as UnitSystem[]).map(unitSystem => (
              <button
                key={unitSystem}
                onClick={() => {
                  setUnits(unitSystem)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm transition-colors',
                  units === unitSystem
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-text-secondary hover:bg-surface-2'
                )}
              >
                {UNIT_CONFIG[unitSystem].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// =============================================================================
// RESULTS COMPONENT
// =============================================================================

export interface ResultsProps {
  /** Additional class */
  className?: string
}

const Results: FC<ResultsProps> = memo(function Results({ className }) {
  const { mode, units, points, currentResult, completeMeasurement, clearPoints, compact } = useMeasurement()
  const [copied, setCopied] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Animate on result change
  useEffect(() => {
    if (resultsRef.current && currentResult) {
      animate(resultsRef.current, {
        scale: [0.98, 1],
        duration: TIMING.fast,
        ease: EASING.anime.out,
      })
    }
  }, [currentResult?.value])

  const handleCopy = () => {
    if (!currentResult) return
    const text = formatResultText(currentResult, units)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatResultText = (result: MeasurementResult, unitSystem: UnitSystem): string => {
    const unitConfig = UNIT_CONFIG[unitSystem]
    if (result.mode === 'distance') {
      return `${formatValue(convertDistance(result.value, unitSystem))} ${unitConfig.distanceUnit}`
    } else if (result.mode === 'area') {
      return `${formatValue(convertArea(result.value, unitSystem))} ${unitConfig.areaUnit}`
    } else {
      return `${formatValue(result.value, 1)}°`
    }
  }

  if (!currentResult && points.length === 0) {
    return (
      <div className={cn('px-3 pb-3', className)}>
        <div className="flex flex-col items-center justify-center py-6 text-center bg-surface-2/50 rounded-lg border border-dashed border-border-subtle">
          <MapPin className="w-6 h-6 text-text-tertiary/50 mb-2" />
          <p className="text-xs text-text-tertiary">
            Click on the map to add points
          </p>
          <p className="text-xs text-text-tertiary/70 mt-1">
            {mode === 'distance' && 'Add 2+ points to measure distance'}
            {mode === 'area' && 'Add 3+ points to measure area'}
            {mode === 'bearing' && 'Add 2 points to calculate bearing'}
          </p>
        </div>
      </div>
    )
  }

  const unitConfig = UNIT_CONFIG[units]

  return (
    <div ref={resultsRef} className={cn('px-3 pb-3 space-y-3', className)}>
      {/* Current measurement */}
      <div className="p-3 bg-surface-2 rounded-lg border border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-tertiary uppercase font-mono">
            {MODE_CONFIG.find(m => m.mode === mode)?.label}
          </span>
          <span className="text-xs text-text-tertiary font-mono">
            {points.length} point{points.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Primary value */}
        {currentResult && (
          <div className="flex items-baseline gap-2">
            <span className={cn(
              'font-mono font-bold text-text-primary tabular-nums',
              compact ? 'text-xl' : 'text-2xl'
            )}>
              {mode === 'distance' && formatValue(convertDistance(currentResult.value, units))}
              {mode === 'area' && formatValue(convertArea(currentResult.value, units))}
              {mode === 'bearing' && formatValue(currentResult.value, 1)}
            </span>
            <span className="text-sm text-text-secondary">
              {mode === 'distance' && unitConfig.distanceUnit}
              {mode === 'area' && unitConfig.areaUnit}
              {mode === 'bearing' && '°'}
            </span>
          </div>
        )}

        {/* Secondary value (reverse bearing) */}
        {currentResult?.secondaryValue != null && mode === 'bearing' && (
          <div className="flex items-center gap-2 mt-1 text-text-tertiary">
            <span className="text-xs">Reverse:</span>
            <span className="font-mono text-sm">{formatValue(currentResult.secondaryValue, 1)}°</span>
          </div>
        )}

        {/* Segment info for distance */}
        {mode === 'distance' && points.length > 2 && (
          <div className="mt-2 pt-2 border-t border-border-subtle">
            <span className="text-xs text-text-tertiary">
              {points.length - 1} segments
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={completeMeasurement}
          disabled={!currentResult || currentResult.value === 0}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            currentResult && currentResult.value > 0
              ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
              : 'bg-surface-2 text-text-tertiary cursor-not-allowed'
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Save
        </button>

        <button
          onClick={handleCopy}
          disabled={!currentResult}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-2 text-text-secondary rounded-lg text-xs font-medium hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={clearPoints}
          disabled={points.length === 0}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-2 text-text-secondary rounded-lg text-xs font-medium hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
})

// =============================================================================
// HISTORY COMPONENT
// =============================================================================

export interface HistoryProps {
  /** Max items to show */
  maxItems?: number
  /** Additional class */
  className?: string
}

const MeasurementHistory: FC<HistoryProps> = memo(function MeasurementHistory({
  maxItems = 5,
  className,
}) {
  const { history, deleteFromHistory, clearHistory, units } = useMeasurement()
  const [isExpanded, setIsExpanded] = useState(true)

  if (history.length === 0) return null

  const unitConfig = UNIT_CONFIG[units]

  const formatHistoryValue = (result: MeasurementResult): string => {
    if (result.mode === 'distance') {
      return `${formatValue(convertDistance(result.value, units))} ${unitConfig.distanceUnit}`
    } else if (result.mode === 'area') {
      return `${formatValue(convertArea(result.value, units))} ${unitConfig.areaUnit}`
    } else {
      return `${formatValue(result.value, 1)}°`
    }
  }

  return (
    <div className={cn('px-3 pb-3 space-y-2', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-text-tertiary uppercase font-mono"
      >
        <span className="flex items-center gap-1">
          <History className="w-3 h-3" />
          History ({history.length})
        </span>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform',
          !isExpanded && '-rotate-90'
        )} />
      </button>

      {isExpanded && (
        <div className="space-y-1">
          {history.slice(0, maxItems).map(result => (
            <div
              key={result.id}
              className="flex items-center justify-between p-2 bg-surface-2 rounded text-xs"
            >
              <div className="flex items-center gap-2">
                {result.mode === 'distance' && <Ruler className="w-3 h-3 text-text-tertiary" />}
                {result.mode === 'area' && <Move className="w-3 h-3 text-text-tertiary" />}
                {result.mode === 'bearing' && <Compass className="w-3 h-3 text-text-tertiary" />}
                <span className="font-mono text-text-primary">{formatHistoryValue(result)}</span>
              </div>
              <button
                onClick={() => deleteFromHistory(result.id)}
                className="p-0.5 hover:bg-surface-3 rounded text-text-tertiary hover:text-text-secondary"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {history.length > maxItems && (
            <p className="text-xs text-text-tertiary text-center">
              +{history.length - maxItems} more
            </p>
          )}

          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="w-full text-xs text-text-tertiary hover:text-red-400 transition-colors"
            >
              Clear history
            </button>
          )}
        </div>
      )}
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const MeasurementTools = Object.assign(Root, {
  Root,
  ModeSelector,
  UnitSelector,
  Results,
  History: MeasurementHistory,
})

// Named exports
export {
  Root as MeasurementToolsRoot,
  ModeSelector as MeasurementToolsModeSelector,
  UnitSelector as MeasurementToolsUnitSelector,
  Results as MeasurementToolsResults,
  MeasurementHistory as MeasurementToolsHistory,
}

// Utility exports
export {
  haversineDistance,
  calculatePathDistance,
  calculatePolygonArea,
  calculateBearing,
  convertDistance,
  convertArea,
}

export default MeasurementTools
