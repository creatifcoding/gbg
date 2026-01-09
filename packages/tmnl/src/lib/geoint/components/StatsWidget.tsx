/**
 * StatsWidget - Compound Component for Dashboard Statistics
 *
 * Modular statistics widgets for the Dashboard Grid layout:
 * - Counter: Large number with label and trend
 * - Breakdown: Source/classification distribution
 * - Sparkline: Mini temporal chart
 * - StatusGrid: Multi-metric grid
 *
 * Uses anime.js v4 for count-up and enter animations.
 *
 * @module geoint/components/StatsWidget
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  memo,
  type FC,
  type ReactNode,
} from 'react'
import { animate } from 'animejs'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SOURCE_COLORS, CLASSIFICATION_COLORS, TIMING, EASING } from '../tokens'
import type { IntelSource, Classification } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

export interface StatsWidgetRootProps {
  /** Widget title */
  title: string
  /** Optional subtitle */
  subtitle?: string
  /** Icon component */
  icon?: ReactNode
  /** Accent color */
  accentColor?: string
  /** Loading state */
  isLoading?: boolean
  /** Children */
  children: ReactNode
  /** Additional class */
  className?: string
}

export interface CounterProps {
  /** Value to display */
  value: number
  /** Previous value (for trend) */
  previousValue?: number
  /** Value suffix (e.g., 'km', '%') */
  suffix?: string
  /** Format as compact (K, M, B) */
  compact?: boolean
  /** Animate on mount */
  animateOnMount?: boolean
  /** Additional class */
  className?: string
}

export interface BreakdownItem {
  id: string
  label: string
  value: number
  color?: string
}

export interface BreakdownProps {
  /** Items to display */
  items: readonly BreakdownItem[]
  /** Show as percentage */
  showPercentage?: boolean
  /** Max items to show (rest grouped as 'Other') */
  maxItems?: number
  /** Additional class */
  className?: string
}

export interface SparklineProps {
  /** Data points */
  data: readonly number[]
  /** Color */
  color?: string
  /** Show area fill */
  showFill?: boolean
  /** Height */
  height?: number
  /** Additional class */
  className?: string
}

export interface StatusGridItem {
  id: string
  label: string
  value: string | number
  status?: 'success' | 'warning' | 'error' | 'neutral'
}

export interface StatusGridProps {
  /** Items to display */
  items: readonly StatusGridItem[]
  /** Columns */
  columns?: 2 | 3 | 4
  /** Additional class */
  className?: string
}

// =============================================================================
// CONTEXT
// =============================================================================

interface StatsWidgetContextValue {
  accentColor: string
  isLoading: boolean
}

const StatsWidgetContext = createContext<StatsWidgetContextValue>({
  accentColor: '#22c55e',
  isLoading: false,
})

const useStatsWidget = () => useContext(StatsWidgetContext)

// =============================================================================
// ROOT COMPONENT
// =============================================================================

const Root: FC<StatsWidgetRootProps> = ({
  title,
  subtitle,
  icon,
  accentColor = '#22c55e',
  isLoading = false,
  children,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  // Enter animation
  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        opacity: [0, 1],
        translateY: [10, 0],
        duration: TIMING.normal,
        ease: EASING.anime.out,
      })
    }
  }, [])

  return (
    <StatsWidgetContext.Provider value={{ accentColor, isLoading }}>
      <div
        ref={containerRef}
        className={cn(
          'bg-surface-1 rounded-lg border border-border-subtle p-4',
          'flex flex-col gap-3',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div
                className="p-1.5 rounded-md"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                <div style={{ color: accentColor }}>{icon}</div>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium text-text-primary">{title}</h4>
              {subtitle && (
                <p className="text-xs text-text-tertiary">{subtitle}</p>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="w-4 h-4 border-2 border-border-subtle border-t-accent-primary rounded-full animate-spin" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">{children}</div>
      </div>
    </StatsWidgetContext.Provider>
  )
}

// =============================================================================
// COUNTER COMPONENT
// =============================================================================

const Counter: FC<CounterProps> = memo(function Counter({
  value,
  previousValue,
  suffix = '',
  compact = false,
  animateOnMount = true,
  className,
}) {
  const { accentColor } = useStatsWidget()
  const valueRef = useRef<HTMLSpanElement>(null)
  const [displayValue, setDisplayValue] = useState(animateOnMount ? 0 : value)

  // Count-up animation
  useEffect(() => {
    if (!animateOnMount || !valueRef.current) {
      setDisplayValue(value)
      return
    }

    const animation = { val: displayValue }
    animate(animation, {
      val: value,
      duration: TIMING.slow * 2,
      ease: EASING.anime.out,
      update: () => {
        setDisplayValue(Math.round(animation.val))
      },
    })
  }, [value, animateOnMount])

  // Format value
  const formatValue = (num: number): string => {
    if (!compact) return num.toLocaleString()
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toString()
  }

  // Calculate trend
  const trend = previousValue !== undefined
    ? ((value - previousValue) / previousValue) * 100
    : undefined

  const TrendIcon = trend !== undefined
    ? trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
    : null

  const trendColor = trend !== undefined
    ? trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
    : ''

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span
        ref={valueRef}
        className="text-3xl font-bold tabular-nums"
        style={{ color: accentColor }}
      >
        {formatValue(displayValue)}
      </span>
      {suffix && (
        <span className="text-lg text-text-tertiary">{suffix}</span>
      )}
      {trend !== undefined && TrendIcon && (
        <div className={cn('flex items-center gap-0.5 text-sm', trendColor)}>
          <TrendIcon className="w-4 h-4" />
          <span>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
})

// =============================================================================
// BREAKDOWN COMPONENT
// =============================================================================

const Breakdown: FC<BreakdownProps> = memo(function Breakdown({
  items,
  showPercentage = true,
  maxItems = 5,
  className,
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort and limit items
  const sortedItems = [...items].sort((a, b) => b.value - a.value)
  const displayItems = sortedItems.slice(0, maxItems)
  const otherValue = sortedItems.slice(maxItems).reduce((sum, item) => sum + item.value, 0)

  if (otherValue > 0) {
    displayItems.push({
      id: 'other',
      label: 'Other',
      value: otherValue,
      color: '#6b7280',
    })
  }

  // Stagger animation
  useEffect(() => {
    if (containerRef.current) {
      const children = Array.from(containerRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          translateX: [-10, 0],
          delay: i * TIMING.stagger,
          duration: TIMING.normal,
          ease: EASING.anime.out,
        })
      })
    }
  }, [items])

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {displayItems.map((item) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0
        return (
          <div key={item.id} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color ?? '#6b7280' }}
            />
            <span className="text-xs text-text-secondary flex-1 truncate">
              {item.label}
            </span>
            <span className="text-xs text-text-primary tabular-nums">
              {item.value.toLocaleString()}
            </span>
            {showPercentage && (
              <div className="w-16">
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: item.color ?? '#6b7280',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})

// =============================================================================
// SOURCE BREAKDOWN (Pre-configured for intel sources)
// =============================================================================

export interface SourceBreakdownProps {
  /** Counts per source */
  counts: Partial<Record<IntelSource, number>>
  /** Additional class */
  className?: string
}

const SourceBreakdown: FC<SourceBreakdownProps> = memo(function SourceBreakdown({
  counts,
  className,
}) {
  const items: BreakdownItem[] = Object.entries(counts)
    .filter(([, count]) => count !== undefined && count > 0)
    .map(([source, count]) => ({
      id: source,
      label: source.toUpperCase(),
      value: count!,
      color: SOURCE_COLORS[source as IntelSource]?.primary ?? '#6b7280',
    }))

  return <Breakdown items={items} className={className} />
})

// =============================================================================
// CLASSIFICATION BREAKDOWN (Pre-configured for classifications)
// =============================================================================

export interface ClassificationBreakdownProps {
  /** Counts per classification */
  counts: Partial<Record<Classification, number>>
  /** Additional class */
  className?: string
}

const ClassificationBreakdown: FC<ClassificationBreakdownProps> = memo(
  function ClassificationBreakdown({ counts, className }) {
    const items: BreakdownItem[] = Object.entries(counts)
      .filter(([, count]) => count !== undefined && count > 0)
      .map(([classification, count]) => ({
        id: classification,
        label: classification.charAt(0).toUpperCase() + classification.slice(1),
        value: count!,
        color: CLASSIFICATION_COLORS[classification as Classification]?.primary ?? '#6b7280',
      }))

    return <Breakdown items={items} className={className} />
  }
)

// =============================================================================
// SPARKLINE COMPONENT
// =============================================================================

const Sparkline: FC<SparklineProps> = memo(function Sparkline({
  data,
  color = '#22c55e',
  showFill = true,
  height = 40,
  className,
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)

  // Generate SVG path
  const generatePath = (): string => {
    if (data.length < 2) return ''

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, i) => ({
      x: (i / (data.length - 1)) * 100,
      y: 100 - ((value - min) / range) * 100,
    }))

    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }

  const path = generatePath()
  const areaPath = path + ` L 100 100 L 0 100 Z`

  // Animate path drawing
  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength()
      pathRef.current.style.strokeDasharray = `${length}`
      pathRef.current.style.strokeDashoffset = `${length}`

      animate(pathRef.current, {
        strokeDashoffset: [length, 0],
        duration: TIMING.slow * 2,
        ease: EASING.anime.out,
      })
    }
  }, [data])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
    >
      {/* Fill area */}
      {showFill && (
        <path
          d={areaPath}
          fill={`${color}20`}
          className="transition-all duration-300"
        />
      )}

      {/* Line */}
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})

// =============================================================================
// STATUS GRID COMPONENT
// =============================================================================

const StatusGrid: FC<StatusGridProps> = memo(function StatusGrid({
  items,
  columns = 2,
  className,
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const statusIcons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertTriangle,
    neutral: Clock,
  }

  const statusColors = {
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    neutral: 'text-gray-500',
  }

  // Stagger animation
  useEffect(() => {
    if (containerRef.current) {
      const children = Array.from(containerRef.current.children)
      children.forEach((child, i) => {
        animate(child, {
          opacity: [0, 1],
          scale: [0.95, 1],
          delay: i * TIMING.stagger,
          duration: TIMING.normal,
          ease: EASING.anime.out,
        })
      })
    }
  }, [items])

  return (
    <div
      ref={containerRef}
      className={cn(
        'grid gap-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-4',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.status ? statusIcons[item.status] : null
        const colorClass = item.status ? statusColors[item.status] : ''

        return (
          <div
            key={item.id}
            className="bg-surface-2 rounded-md p-2 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary truncate">
                {item.label}
              </span>
              {Icon && <Icon className={cn('w-3 h-3', colorClass)} />}
            </div>
            <span className="text-sm font-medium text-text-primary tabular-nums">
              {typeof item.value === 'number'
                ? item.value.toLocaleString()
                : item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
})

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const StatsWidget = Object.assign(Root, {
  Root,
  Counter,
  Breakdown,
  SourceBreakdown,
  ClassificationBreakdown,
  Sparkline,
  StatusGrid,
})

// Named exports for direct imports
export {
  Root as StatsWidgetRoot,
  Counter as StatsWidgetCounter,
  Breakdown as StatsWidgetBreakdown,
  SourceBreakdown as StatsWidgetSourceBreakdown,
  ClassificationBreakdown as StatsWidgetClassificationBreakdown,
  Sparkline as StatsWidgetSparkline,
  StatusGrid as StatsWidgetStatusGrid,
}

export default StatsWidget
