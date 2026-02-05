/**
 * RVN Threat Meter
 *
 * Visual threat level indicator with segments.
 * Uses binary encoding: filled segments = threat level.
 *
 * Features:
 * - Segmented display (default 4 segments)
 * - Critical state with diagonal stripes
 * - Smooth or stepped animation between levels
 * - Configurable segment count and size
 *
 * @source Derived from react-app(31).js ThreatMarker pattern
 */

import * as React from 'react'
import {
  useAnimatedValue,
  BAR_ANIMATION_PRESETS,
  type BarAnimationConfig,
  type BarAnimationPreset,
} from '../animation/useAnimatedValue'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnThreatLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface RvnThreatMeterProps {
  /** Threat level to display */
  level: RvnThreatLevel
  /** Number of segments (default 4) */
  segments?: number
  /** Segment size in pixels (default 8) */
  segmentSize?: number
  /** Gap between segments (default 2) */
  gap?: number
  /** Show text label */
  showLabel?: boolean
  /** Animation configuration or preset name */
  animation?: BarAnimationConfig | BarAnimationPreset
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const LEVEL_TO_SEGMENTS: Record<RvnThreatLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
}

const CRITICAL_STRIPE_PATTERN =
  'repeating-linear-gradient(45deg, #000, #000 2px, #fff 2px, #fff 4px)'

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const meterStyles = (gap: number): React.CSSProperties => ({
  display: 'flex',
  gap: `${gap}px`,
})

const segmentStyles = (
  size: number,
  isFilled: boolean,
  isCritical: boolean
): React.CSSProperties => ({
  width: `${size}px`,
  height: `${size}px`,
  border: '1px solid #000000',
  background: isFilled
    ? isCritical
      ? CRITICAL_STRIPE_PATTERN
      : '#000000'
    : '#eeeeee',
})

const labelStyles: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  fontFamily: 'var(--rvn-font-mono, monospace)',
  textTransform: 'uppercase',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Threat level meter with segmented display and animation support.
 *
 * @example Basic usage
 * ```tsx
 * <RvnThreatMeter level="moderate" />
 * ```
 *
 * @example Smooth animation
 * ```tsx
 * <RvnThreatMeter level={threatLevel} animation="smooth" />
 * ```
 *
 * @example Stepped animation (fills one segment at a time)
 * ```tsx
 * <RvnThreatMeter level={threatLevel} animation="steppedCoarse" />
 * ```
 *
 * @example Custom stepped animation
 * ```tsx
 * <RvnThreatMeter
 *   level={threatLevel}
 *   animation={{
 *     stepped: true,
 *     steps: 4,      // Match segment count
 *     stepDelay: 150, // 150ms per segment
 *   }}
 * />
 * ```
 *
 * @example With label
 * ```tsx
 * <RvnThreatMeter level="high" showLabel />
 * ```
 *
 * @example Critical (shows stripes)
 * ```tsx
 * <RvnThreatMeter level="critical" />
 * ```
 *
 * @example Custom segments
 * ```tsx
 * <RvnThreatMeter level="high" segments={5} segmentSize={6} />
 * ```
 */
export function RvnThreatMeter({
  level,
  segments = 4,
  segmentSize = 8,
  gap = 2,
  showLabel = false,
  animation,
  className,
  style,
}: RvnThreatMeterProps) {
  const targetFilledCount = LEVEL_TO_SEGMENTS[level]
  const isCritical = level === 'critical'

  // Resolve animation config
  const animationConfig: BarAnimationConfig =
    typeof animation === 'string'
      ? BAR_ANIMATION_PRESETS[animation]
      : animation ?? BAR_ANIMATION_PRESETS.smooth

  // Convert segment count to percentage (0-100) for animation
  // Then convert back to segment count
  const targetPercentage = (targetFilledCount / segments) * 100

  // Use stepped animation matching segment count by default
  const effectiveConfig: BarAnimationConfig = {
    ...animationConfig,
    // If stepped animation, default steps to segment count for natural fill
    steps: animationConfig.stepped ? (animationConfig.steps ?? segments) : animationConfig.steps,
  }

  const animatedPercentage = useAnimatedValue(targetPercentage, effectiveConfig)

  // Convert animated percentage back to fill count
  const animatedFilledCount = Math.round((animatedPercentage / 100) * segments)

  return (
    <div
      className={className}
      style={{
        ...containerStyles,
        ...style,
      }}
      role="meter"
      aria-valuenow={animatedFilledCount}
      aria-valuemin={0}
      aria-valuemax={segments}
      aria-label={`Threat level: ${level}`}
      data-rvn-threat-meter=""
      data-level={level}
    >
      <div style={meterStyles(gap)}>
        {Array.from({ length: segments }, (_, i) => (
          <div
            key={i}
            style={segmentStyles(
              segmentSize,
              i < animatedFilledCount,
              isCritical && i < animatedFilledCount
            )}
          />
        ))}
      </div>
      {showLabel && <span style={labelStyles}>{level}</span>}
    </div>
  )
}

RvnThreatMeter.displayName = 'RvnThreatMeter'
