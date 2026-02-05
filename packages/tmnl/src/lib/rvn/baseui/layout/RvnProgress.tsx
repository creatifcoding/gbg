/**
 * RvnProgress - Brutalist Progress Component
 *
 * Wraps Base UI Progress with RVN styling:
 * - 2px border track
 * - Black fill
 * - Monospace percentage
 * - Critical: diagonal stripes below 30%
 *
 * @example
 * ```tsx
 * <RvnProgress.Root value={75}>
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
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_PATTERNS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnProgressRootProps extends Omit<React.ComponentProps<typeof Progress.Root>, 'value'> {
  /** Progress value (0-100), null for indeterminate */
  value?: number | null
  /** Maximum value */
  max?: number
  /** Show critical stripe pattern when below threshold */
  criticalThreshold?: number
}

export interface RvnProgressTrackProps extends React.ComponentProps<typeof Progress.Track> {
  /** Height of the track */
  height?: string
}

export interface RvnProgressIndicatorProps extends React.ComponentProps<typeof Progress.Indicator> {}

export interface RvnProgressLabelProps {
  /** Custom label text (overrides percentage) */
  label?: string
  /** Additional styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface RvnProgressContextValue {
  value: number
  max: number
  percentage: number
  isCritical: boolean
}

const RvnProgressContext = React.createContext<RvnProgressContextValue>({
  value: 0,
  max: 100,
  percentage: 0,
  isCritical: false,
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.s,
  } as React.CSSProperties,
  track: {
    flex: 1,
    height: '12px',
    background: RVN_COLORS.surface,
    border: `2px solid ${RVN_COLORS.border}`,
    borderRadius: RVN_BORDERS.radius,
    overflow: 'hidden',
    position: 'relative' as const,
  } as React.CSSProperties,
  indicator: {
    height: '100%',
    background: RVN_COLORS.black,
    transition: 'width 0.3s ease-out',
  } as React.CSSProperties,
  indicatorCritical: {
    background: RVN_PATTERNS.criticalStripe,
  } as React.CSSProperties,
  label: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    color: RVN_COLORS.textMain,
    textTransform: 'uppercase' as const,
    minWidth: '48px',
    textAlign: 'right' as const,
  } as React.CSSProperties,
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

const Root = React.forwardRef<HTMLDivElement, RvnProgressRootProps>(
  (
    {
      value = null,
      max = 100,
      criticalThreshold = 30,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const normalizedValue = value ?? 0
    const percentage = Math.min(100, Math.max(0, (normalizedValue / max) * 100))
    const isCritical = value !== null && percentage < criticalThreshold

    return (
      <RvnProgressContext.Provider value={{ value, max, percentage, isCritical }}>
        <Progress.Root
          ref={ref}
          value={value}
          max={max}
          style={{ ...styles.root, ...style }}
          {...props}
        >
          {children}
        </Progress.Root>
      </RvnProgressContext.Provider>
    )
  }
)
Root.displayName = 'RvnProgress.Root'

const Track = React.forwardRef<HTMLDivElement, RvnProgressTrackProps>(
  ({ height = '12px', style, ...props }, ref) => (
    <Progress.Track
      ref={ref}
      style={{ ...styles.track, height, ...style }}
      {...props}
    />
  )
)
Track.displayName = 'RvnProgress.Track'

const Indicator = React.forwardRef<HTMLDivElement, RvnProgressIndicatorProps>(
  ({ style, ...props }, ref) => {
    const { percentage, isCritical } = React.useContext(RvnProgressContext)

    return (
      <Progress.Indicator
        ref={ref}
        style={{
          ...styles.indicator,
          ...(isCritical ? styles.indicatorCritical : {}),
          width: `${percentage}%`,
          ...style,
        }}
        {...props}
      />
    )
  }
)
Indicator.displayName = 'RvnProgress.Indicator'

function Label({ label, style }: RvnProgressLabelProps) {
  const { percentage } = React.useContext(RvnProgressContext)
  const displayLabel = label ?? `${Math.round(percentage)}%`

  return <span style={{ ...styles.label, ...style }}>{displayLabel}</span>
}
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

export {
  Root as RvnProgressRoot,
  Track as RvnProgressTrack,
  Indicator as RvnProgressIndicator,
  Label as RvnProgressLabel,
}
