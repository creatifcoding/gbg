/**
 * RvnMeter - Brutalist Meter/Progress (Base UI)
 *
 * Wraps Base UI Meter with RVN styling.
 *
 * Features:
 * - 2px border
 * - Black fill
 * - Critical: diagonal stripes
 * - Smooth or stepped animation
 */

import * as React from 'react'
import { Meter as BaseMeter } from '@base-ui-components/react/meter'
import { clsx } from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import {
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_COLORS,
  RVN_SPACING,
  RVN_PATTERNS,
} from '../../tokens'
import {
  useAnimatedValue,
  BAR_ANIMATION_PRESETS,
  type BarAnimationConfig,
  type BarAnimationPreset,
} from '../../animation/useAnimatedValue'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnMeterProps {
  /** Current value */
  value: number
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Low threshold (below = warning) */
  low?: number
  /** High threshold (above = critical) */
  high?: number
  /** Optimum value */
  optimum?: number
  /** Optional label */
  label?: ReactNode
  /** Show value display */
  showValue?: boolean
  /** Value formatter */
  formatValue?: (value: number) => string
  /** Full width */
  fullWidth?: boolean
  /** Animation configuration or preset name */
  animation?: BarAnimationConfig | BarAnimationPreset
  /** Additional class name */
  className?: string
  /** Additional style overrides */
  style?: CSSProperties
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TRACK_HEIGHT = 16

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: RVN_SPACING.xs,
  minWidth: '200px',
}

const headerStyles: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const labelStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: RVN_COLORS.textMain,
}

const valueStyles: CSSProperties = {
  fontFamily: RVN_FONTS.mono,
  fontSize: RVN_FONT_SIZES.label,
  fontWeight: RVN_FONT_WEIGHTS.bold,
  color: RVN_COLORS.textMain,
}

const trackStyles: CSSProperties = {
  height: `${TRACK_HEIGHT}px`,
  border: RVN_BORDERS.card,
  borderRadius: RVN_BORDERS.radius,
  background: RVN_COLORS.surface,
  overflow: 'hidden',
}

const indicatorStyles = (isCritical: boolean, isWarning: boolean): CSSProperties => ({
  height: '100%',
  background: isCritical
    ? RVN_PATTERNS.criticalStripe
    : isWarning
      ? RVN_PATTERNS.warningStripe
      : RVN_COLORS.black,
  // No CSS transition - animation handled by hook
})

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * RvnMeter - Brutalist meter with animation support
 *
 * @example Basic usage
 * ```tsx
 * <RvnMeter value={75} />
 * ```
 *
 * @example Smooth animation
 * ```tsx
 * <RvnMeter value={value} animation="smooth" />
 * ```
 *
 * @example Stepped animation
 * ```tsx
 * <RvnMeter value={value} animation="steppedMedium" />
 * ```
 *
 * @example With label and thresholds
 * ```tsx
 * <RvnMeter
 *   value={value}
 *   label="CPU Usage"
 *   high={80}
 *   low={20}
 *   animation="smooth"
 * />
 * ```
 */
export function RvnMeter({
  value,
  min = 0,
  max = 100,
  low,
  high,
  optimum,
  label,
  showValue = true,
  formatValue,
  fullWidth = false,
  animation,
  className,
  style,
}: RvnMeterProps) {
  // Resolve animation config
  const animationConfig: BarAnimationConfig =
    typeof animation === 'string'
      ? BAR_ANIMATION_PRESETS[animation]
      : animation ?? BAR_ANIMATION_PRESETS.smooth

  // Calculate target percentage
  const targetPercentage = ((value - min) / (max - min)) * 100

  // Animate the value
  const animatedPercentage = useAnimatedValue(targetPercentage, animationConfig)

  // Calculate animated value for display
  const animatedValue = min + (animatedPercentage / 100) * (max - min)

  // Determine state based on animated value
  const isCritical = high !== undefined && animatedValue >= high
  const isWarning = low !== undefined && animatedValue <= low

  const displayValue = React.useMemo(() => {
    if (formatValue) {
      return formatValue(animatedValue)
    }
    return `${Math.round(animatedPercentage)}%`
  }, [animatedValue, formatValue, animatedPercentage])

  const containerStyle: CSSProperties = {
    ...containerStyles,
    width: fullWidth ? '100%' : 'auto',
    ...style,
  }

  return (
    <div className={clsx('rvn-meter', className)} style={containerStyle}>
      {(label || showValue) && (
        <div style={headerStyles}>
          {label && <span style={labelStyles}>{label}</span>}
          {showValue && <span style={valueStyles}>{displayValue}</span>}
        </div>
      )}
      <BaseMeter.Root value={animatedValue} min={min} max={max}>
        <BaseMeter.Track style={trackStyles}>
          <BaseMeter.Indicator
            style={{
              ...indicatorStyles(isCritical, isWarning),
              width: `${animatedPercentage}%`,
            }}
          />
        </BaseMeter.Track>
      </BaseMeter.Root>
    </div>
  )
}
