/**
 * RvnProgress - Brutalist Progress Bar (Base UI Wrapper)
 *
 * Wraps Base UI Progress with RVN brutalist styling:
 * - 3px border track
 * - Black fill indicator
 * - Critical variant with diagonal stripes
 * - 24px height (configurable)
 * - Smooth or stepped animation
 *
 * @example
 * ```tsx
 * // Compound pattern (full control)
 * <RvnProgress.Root value={75}>
 *   <RvnProgress.Track>
 *     <RvnProgress.Indicator />
 *   </RvnProgress.Track>
 * </RvnProgress.Root>
 *
 * // With label and animation
 * <RvnProgress.Root value={75} animation="steppedMedium">
 *   <RvnProgress.Track>
 *     <RvnProgress.Indicator />
 *   </RvnProgress.Track>
 *   <RvnProgress.Label />
 * </RvnProgress.Root>
 * ```
 */

import * as React from 'react'
import { Progress } from '@base-ui-components/react/progress'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
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

export type RvnProgressVariant = 'default' | 'critical'

export interface RvnProgressRootProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Progress.Root>, 'value'> {
  /** Current value */
  value?: number
  /** Visual variant */
  variant?: RvnProgressVariant
  /** Height of the progress bar */
  height?: string
  /** Animation configuration or preset name */
  animation?: BarAnimationConfig | BarAnimationPreset
}

export interface RvnProgressTrackProps
  extends React.ComponentPropsWithoutRef<typeof Progress.Track> {}

export interface RvnProgressIndicatorProps
  extends React.ComponentPropsWithoutRef<typeof Progress.Indicator> {
  /** Visual variant (inherited from context if not specified) */
  variant?: RvnProgressVariant
}

export interface RvnProgressLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Custom format function for the label */
  format?: (value: number, max: number) => string
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface ProgressContextValue {
  variant: RvnProgressVariant
  height: string
  value: number
  animatedValue: number
  animatedPercentage: number
  max: number
}

const ProgressContext = React.createContext<ProgressContextValue>({
  variant: 'default',
  height: '24px',
  value: 0,
  animatedValue: 0,
  animatedPercentage: 0,
  max: 100,
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  },
  track: {
    flex: 1,
    height: '24px',
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  indicator: {
    height: '100%',
    background: RVN_COLORS.black,
    // No CSS transition - animation handled by hook
  },
  indicatorCritical: {
    background: RVN_PATTERNS.criticalStripe,
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
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Root({
  style,
  variant = 'default',
  height = '24px',
  value = 0,
  max = 100,
  animation,
  children,
  ...props
}: RvnProgressRootProps) {
  // Resolve animation config
  const animationConfig: BarAnimationConfig =
    typeof animation === 'string'
      ? BAR_ANIMATION_PRESETS[animation]
      : animation ?? BAR_ANIMATION_PRESETS.smooth

  // Calculate target percentage
  const targetPercentage = Math.min(100, Math.max(0, ((value ?? 0) / (max ?? 100)) * 100))

  // Animate the value
  const animatedPercentage = useAnimatedValue(targetPercentage, animationConfig)

  // Calculate animated value for display
  const animatedValue = ((animatedPercentage / 100) * (max ?? 100))

  const contextValue: ProgressContextValue = {
    variant,
    height,
    value: value ?? 0,
    animatedValue,
    animatedPercentage,
    max: max ?? 100,
  }

  return (
    <ProgressContext.Provider value={contextValue}>
      <Progress.Root
        value={animatedValue}
        max={max}
        style={{ ...styles.root, ...style }}
        data-rvn-progress=""
        data-variant={variant}
        {...props}
      >
        {children}
      </Progress.Root>
    </ProgressContext.Provider>
  )
}

function Track({ style, children, ...props }: RvnProgressTrackProps) {
  const { height } = React.useContext(ProgressContext)

  return (
    <Progress.Track
      style={{ ...styles.track, height, ...style }}
      data-rvn-progress-track=""
      {...props}
    >
      {children}
    </Progress.Track>
  )
}

function Indicator({ style, variant: variantProp, ...props }: RvnProgressIndicatorProps) {
  const { variant: contextVariant, animatedPercentage } = React.useContext(ProgressContext)
  const variant = variantProp ?? contextVariant

  const indicatorStyle: React.CSSProperties = {
    ...styles.indicator,
    ...(variant === 'critical' ? styles.indicatorCritical : {}),
    width: `${animatedPercentage}%`,
    ...style,
  }

  return (
    <Progress.Indicator
      style={indicatorStyle}
      data-rvn-progress-indicator=""
      data-variant={variant}
      {...props}
    />
  )
}

function Label({
  style,
  format,
  children,
  ...props
}: RvnProgressLabelProps) {
  const { animatedValue, animatedPercentage, max } = React.useContext(ProgressContext)

  const displayText = children ?? (format ? format(animatedValue, max) : `${Math.round(animatedPercentage)}%`)

  return (
    <span
      style={{ ...styles.label, ...style } as React.CSSProperties}
      data-rvn-progress-label=""
      {...props}
    >
      {displayText}
    </span>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Root.displayName = 'RvnProgress.Root'
Track.displayName = 'RvnProgress.Track'
Indicator.displayName = 'RvnProgress.Indicator'
Label.displayName = 'RvnProgress.Label'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnProgress = {
  Root,
  Track,
  Indicator,
  Label,
}

export type {
  RvnProgressRootProps as RootProps,
  RvnProgressTrackProps as TrackProps,
  RvnProgressIndicatorProps as IndicatorProps,
  RvnProgressLabelProps as LabelProps,
}
