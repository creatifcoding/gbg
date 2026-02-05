/**
 * RvnProgressBar - Brutalist Progress Bar
 *
 * Horizontal progress indicator with thick borders and optional label.
 * Critical state displays diagonal stripe pattern.
 *
 * Features:
 * - 24px height with 3px black border
 * - Solid black fill for progress
 * - Critical state with diagonal stripes
 * - Optional percentage label
 * - Determinate and indeterminate modes
 * - Smooth or stepped animation
 *
 * @example
 * ```tsx
 * <RvnProgressBar value={75} showLabel />
 * ```
 */

import * as React from 'react'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_PATTERNS,
} from '../tokens'
import {
  useAnimatedValue,
  BAR_ANIMATION_PRESETS,
  type BarAnimationConfig,
  type BarAnimationPreset,
} from '../animation/useAnimatedValue'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnProgressBarVariant = 'default' | 'critical'

export interface RvnProgressBarProps {
  /** Progress value (0-100) */
  value?: number
  /** Maximum value (default: 100) */
  max?: number
  /** Visual variant */
  variant?: RvnProgressBarVariant
  /** Show percentage label */
  showLabel?: boolean
  /** Custom label (overrides percentage) */
  label?: string
  /** Height of the bar */
  height?: string
  /** Indeterminate mode (animated loading) */
  indeterminate?: boolean
  /** Animation configuration or preset name */
  animation?: BarAnimationConfig | BarAnimationPreset
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  barWrapper: {
    flex: 1,
    height: '24px',
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  fill: {
    height: '100%',
    background: RVN_COLORS.black,
    // No CSS transition - animation handled by hook
  },
  fillCritical: {
    height: '100%',
    background: RVN_PATTERNS.criticalStripe,
    // No CSS transition - animation handled by hook
  },
  label: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    color: RVN_COLORS.textMain,
    textTransform: 'uppercase' as const,
    minWidth: '48px',
    textAlign: 'right' as const,
  },
  indeterminateFill: {
    height: '100%',
    width: '30%',
    background: RVN_COLORS.black,
    position: 'absolute' as const,
    animation: 'rvn-progress-indeterminate 1.5s infinite linear',
  },
} as const

// Keyframes for indeterminate animation (injected once)
const KEYFRAMES_ID = 'rvn-progress-keyframes'

function injectKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYFRAMES_ID)) return

  const style = document.createElement('style')
  style.id = KEYFRAMES_ID
  style.textContent = `
    @keyframes rvn-progress-indeterminate {
      0% {
        left: -30%;
      }
      100% {
        left: 100%;
      }
    }
  `
  document.head.appendChild(style)
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RvnProgressBar - Brutalist horizontal progress bar with animation support
 *
 * @example Basic usage
 * ```tsx
 * <RvnProgressBar value={50} />
 * ```
 *
 * @example Smooth animation
 * ```tsx
 * <RvnProgressBar value={value} animation="smooth" />
 * ```
 *
 * @example Stepped animation (10% increments)
 * ```tsx
 * <RvnProgressBar value={value} animation="steppedMedium" />
 * ```
 *
 * @example With label
 * ```tsx
 * <RvnProgressBar value={87} showLabel />
 * // Displays: [==========] 87%
 * ```
 *
 * @example Custom label
 * ```tsx
 * <RvnProgressBar value={3} max={10} label="3/10 UNITS" showLabel />
 * ```
 *
 * @example Critical state
 * ```tsx
 * <RvnProgressBar value={95} variant="critical" showLabel />
 * // Shows diagonal stripe pattern
 * ```
 *
 * @example Indeterminate (loading)
 * ```tsx
 * <RvnProgressBar indeterminate />
 * ```
 */
export function RvnProgressBar({
  value = 0,
  max = 100,
  variant = 'default',
  showLabel = false,
  label,
  height = '24px',
  indeterminate = false,
  animation,
  style,
}: RvnProgressBarProps) {
  // Inject keyframes on mount (for indeterminate mode)
  React.useEffect(() => {
    if (indeterminate) {
      injectKeyframes()
    }
  }, [indeterminate])

  // Resolve animation config
  const animationConfig: BarAnimationConfig =
    typeof animation === 'string'
      ? BAR_ANIMATION_PRESETS[animation]
      : animation ?? BAR_ANIMATION_PRESETS.smooth

  // Calculate target percentage
  const targetPercentage = Math.min(100, Math.max(0, (value / max) * 100))

  // Animate the value (disabled for indeterminate)
  const animatedPercentage = useAnimatedValue(targetPercentage, {
    ...animationConfig,
    enabled: !indeterminate && animationConfig.enabled,
  })

  // Round for display
  const displayPercentage = Math.round(animatedPercentage)
  const displayLabel = label ?? `${displayPercentage}%`

  const barWrapperStyle: React.CSSProperties = {
    ...styles.barWrapper,
    height,
  }

  const fillStyle: React.CSSProperties =
    variant === 'critical'
      ? { ...styles.fillCritical, width: `${animatedPercentage}%` }
      : { ...styles.fill, width: `${animatedPercentage}%` }

  return (
    <div style={{ ...styles.container, ...style }} data-rvn-progress-bar="">
      <div
        style={barWrapperStyle}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={indeterminate ? 'Loading' : displayLabel}
        data-variant={variant}
        data-indeterminate={indeterminate || undefined}
      >
        {indeterminate ? (
          <div style={styles.indeterminateFill} />
        ) : (
          <div style={fillStyle} />
        )}
      </div>
      {showLabel && !indeterminate && (
        <span style={styles.label as React.CSSProperties}>{displayLabel}</span>
      )}
    </div>
  )
}

RvnProgressBar.displayName = 'RvnProgressBar'
