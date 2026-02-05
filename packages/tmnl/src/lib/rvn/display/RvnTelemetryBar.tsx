/**
 * RVN Telemetry Bar
 *
 * Horizontal progress bar for telemetry values.
 * Uses diagonal stripe pattern when critical (<30%).
 *
 * Features:
 * - Anime.js powered smooth animation
 * - Spring physics and elastic easings
 * - Gradient color transitions based on value
 * - Critical state with diagonal stripes
 * - Configurable thresholds and dimensions
 *
 * @source react-app(32).js lines 617-632
 * Exact pattern: repeating-linear-gradient(45deg, #000, #000 3px, #fff 3px, #fff 6px)
 */

import * as React from 'react'
import {
  useAnimatedValue,
  BAR_ANIMATION_PRESETS,
  type BarAnimationConfig,
  type BarAnimationPreset,
} from '../animation/useAnimatedValue'
import {
  resolveGradient,
  GRADIENT_PRESETS,
  type GradientStop,
  type GradientConfig,
  type GradientPreset,
} from '../animation/colorGradient'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnTelemetryBarProps {
  /** Percentage value (0-100) */
  percentage: number
  /** Threshold below which critical pattern shows (default 30) */
  criticalThreshold?: number
  /** Width of the bar (default 100px) */
  width?: number | string
  /** Height of the bar (default 8px) */
  height?: number
  /** Show percentage label */
  showLabel?: boolean
  /** Animation configuration or preset name */
  animation?: BarAnimationConfig | BarAnimationPreset
  /**
   * Gradient color transition.
   * Can be a preset name, array of stops, or full config.
   *
   * @example Preset
   * ```tsx
   * <RvnTelemetryBar gradient="traffic" /> // green → yellow → red
   * ```
   *
   * @example Custom stops
   * ```tsx
   * <RvnTelemetryBar gradient={[
   *   { stop: 0, color: '#3b82f6' },
   *   { stop: 100, color: '#ef4444' },
   * ]} />
   * ```
   */
  gradient?: GradientPreset | GradientStop[] | GradientConfig
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Patterns
// -----------------------------------------------------------------------------

/**
 * Exact diagonal stripe pattern from source
 * @source react-app(32).js line 631
 */
const CRITICAL_STRIPE_PATTERN =
  'repeating-linear-gradient(45deg, #000, #000 3px, #fff 3px, #fff 6px)'

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const trackStyles = (width: number | string, height: number): React.CSSProperties => ({
  width: typeof width === 'number' ? `${width}px` : width,
  height: `${height}px`,
  background: '#eeeeee',
  border: '1px solid #000000',
  position: 'relative',
  overflow: 'hidden',
})

const fillStyles = (
  percentage: number,
  isCritical: boolean,
  fillColor?: string
): React.CSSProperties => ({
  width: `${Math.min(100, Math.max(0, percentage))}%`,
  height: '100%',
  background: isCritical
    ? CRITICAL_STRIPE_PATTERN
    : fillColor ?? '#000000',
  // No CSS transition - animation handled by anime.js
})

const labelStyles: React.CSSProperties = {
  fontSize: '12px',
  fontFamily: 'var(--rvn-font-mono, monospace)',
  fontWeight: 600,
  minWidth: '32px',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Telemetry progress bar with gradient transitions and animation support.
 *
 * @example Basic usage
 * ```tsx
 * <RvnTelemetryBar percentage={75} />
 * ```
 *
 * @example With gradient (traffic light colors)
 * ```tsx
 * <RvnTelemetryBar percentage={value} gradient="traffic" />
 * ```
 *
 * @example With heat gradient
 * ```tsx
 * <RvnTelemetryBar percentage={value} gradient="heat" />
 * ```
 *
 * @example Custom gradient stops
 * ```tsx
 * <RvnTelemetryBar
 *   percentage={value}
 *   gradient={[
 *     { stop: 0, color: '#3b82f6' },   // blue
 *     { stop: 50, color: '#8b5cf6' },  // purple
 *     { stop: 100, color: '#ec4899' }, // pink
 *   ]}
 * />
 * ```
 *
 * @example Spring animation with gradient
 * ```tsx
 * <RvnTelemetryBar
 *   percentage={value}
 *   animation="spring"
 *   gradient="system"
 * />
 * ```
 *
 * @example Critical state (shows stripes, overrides gradient)
 * ```tsx
 * <RvnTelemetryBar percentage={24} gradient="traffic" />
 * ```
 */
export function RvnTelemetryBar({
  percentage,
  criticalThreshold = 30,
  width = 100,
  height = 8,
  showLabel = false,
  animation,
  gradient,
  className,
  style,
}: RvnTelemetryBarProps) {
  // Resolve animation config
  const animationConfig: BarAnimationConfig =
    typeof animation === 'string'
      ? BAR_ANIMATION_PRESETS[animation]
      : animation ?? BAR_ANIMATION_PRESETS.smooth

  // Clamp input value
  const clampedTarget = Math.min(100, Math.max(0, percentage))

  // Animate the value
  const animatedPercentage = useAnimatedValue(clampedTarget, animationConfig)

  // Round for display
  const displayPercentage = Math.round(animatedPercentage)
  const isCritical = animatedPercentage < criticalThreshold

  // Calculate gradient color if provided
  const fillColor = React.useMemo(() => {
    if (!gradient) return undefined
    const g = resolveGradient(gradient)
    return g.at(animatedPercentage)
  }, [gradient, animatedPercentage])

  return (
    <div
      className={className}
      style={{
        ...containerStyles,
        ...style,
      }}
      role="meter"
      aria-valuenow={displayPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Telemetry: ${displayPercentage}%${isCritical ? ' (critical)' : ''}`}
      data-rvn-telemetry-bar=""
      data-critical={isCritical ? '' : undefined}
    >
      <div style={trackStyles(width, height) as React.CSSProperties}>
        <div style={fillStyles(animatedPercentage, isCritical, fillColor)} />
      </div>
      {showLabel && <span style={labelStyles}>{displayPercentage}%</span>}
    </div>
  )
}

RvnTelemetryBar.displayName = 'RvnTelemetryBar'

/**
 * Available gradient presets for quick reference
 */
RvnTelemetryBar.gradients = GRADIENT_PRESETS
