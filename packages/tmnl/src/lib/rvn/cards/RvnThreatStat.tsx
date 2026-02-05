/**
 * RvnThreatStat
 *
 * Compact label/value pair for threat assessment data.
 * Features: monospace typography, horizontal or vertical layout.
 *
 * Source pattern: react-app(29).js - FontItem metrics display
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type StatVariant = 'default' | 'large' | 'compact'
type StatOrientation = 'horizontal' | 'vertical'
type StatTrend = 'up' | 'down' | 'stable' | 'critical'

interface RvnThreatStatProps {
  /** Stat label */
  label: string
  /** Stat value (string or number) */
  value: string | number
  /** Optional unit suffix */
  unit?: string
  /** Display variant */
  variant?: StatVariant
  /** Layout orientation */
  orientation?: StatOrientation
  /** Trend indicator */
  trend?: StatTrend
  /** Whether to highlight as critical */
  critical?: boolean
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    fontFamily: RVN_FONTS.mono,
  },
  horizontal: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: RVN_SPACING.m,
  },
  vertical: {
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: RVN_SPACING.xs,
  },
  label: {
    color: RVN_COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  value: {
    color: RVN_COLORS.textMain,
    fontWeight: RVN_FONT_WEIGHTS.bold,
  },
  unit: {
    color: RVN_COLORS.textMuted,
    marginLeft: '2px',
  },
  trend: {
    marginLeft: RVN_SPACING.xs,
    fontWeight: RVN_FONT_WEIGHTS.black,
  },
} as const

// -----------------------------------------------------------------------------
// Variant Sizing
// -----------------------------------------------------------------------------

function getVariantStyles(variant: StatVariant): {
  label: React.CSSProperties
  value: React.CSSProperties
} {
  switch (variant) {
    case 'large':
      return {
        label: { fontSize: RVN_FONT_SIZES.label },
        value: { fontSize: RVN_FONT_SIZES.dataLg },
      }
    case 'compact':
      return {
        label: { fontSize: RVN_FONT_SIZES.caption },
        value: { fontSize: RVN_FONT_SIZES.label },
      }
    case 'default':
    default:
      return {
        label: { fontSize: RVN_FONT_SIZES.label },
        value: { fontSize: RVN_FONT_SIZES.dataSm },
      }
  }
}

function getTrendIndicator(trend: StatTrend): { symbol: string; color: string } {
  switch (trend) {
    case 'up':
      return { symbol: '^', color: RVN_COLORS.textMain }
    case 'down':
      return { symbol: 'v', color: RVN_COLORS.textMuted }
    case 'critical':
      return { symbol: '!', color: RVN_COLORS.textMain }
    case 'stable':
    default:
      return { symbol: '-', color: RVN_COLORS.textMuted }
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Threat Stat for label/value data display
 *
 * @example
 * ```tsx
 * <RvnThreatStat label="UPM" value={1000} />
 * <RvnThreatStat label="ASCENDER" value={800} variant="compact" />
 * <RvnThreatStat
 *   label="THREAT LEVEL"
 *   value={87}
 *   unit="%"
 *   trend="up"
 *   critical
 * />
 * ```
 */
export const RvnThreatStat = React.forwardRef<HTMLDivElement, RvnThreatStatProps>(
  function RvnThreatStat(
    {
      label,
      value,
      unit,
      variant = 'default',
      orientation = 'horizontal',
      trend,
      critical = false,
      className,
      style,
    },
    ref
  ) {
    const variantStyles = getVariantStyles(variant)
    const trendInfo = trend ? getTrendIndicator(trend) : null

    const containerStyle: React.CSSProperties = {
      ...styles.container,
      ...(orientation === 'horizontal' ? styles.horizontal : styles.vertical),
      ...style,
    }

    const valueStyle: React.CSSProperties = {
      ...styles.value,
      ...variantStyles.value,
      ...(critical ? { fontWeight: RVN_FONT_WEIGHTS.black } : {}),
    }

    return (
      <div
        ref={ref}
        className={className}
        style={containerStyle}
        data-rvn-threat-stat=""
        data-variant={variant}
        data-orientation={orientation}
        data-critical={critical || undefined}
      >
        <span style={{ ...styles.label, ...variantStyles.label }}>{label}</span>
        <span style={valueStyle}>
          {value}
          {unit && <span style={styles.unit}>{unit}</span>}
          {trendInfo && (
            <span style={{ ...styles.trend, color: trendInfo.color }}>
              {trendInfo.symbol}
            </span>
          )}
        </span>
      </div>
    )
  }
)

RvnThreatStat.displayName = 'RvnThreatStat'

// -----------------------------------------------------------------------------
// Compound: Stat Group
// -----------------------------------------------------------------------------

interface RvnThreatStatGroupProps {
  /** Orientation of the group */
  orientation?: 'horizontal' | 'vertical'
  /** Gap between stats */
  gap?: 's' | 'm' | 'l'
  /** Children (RvnThreatStat components) */
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

const gapMap = {
  s: RVN_SPACING.s,
  m: RVN_SPACING.m,
  l: RVN_SPACING.l,
}

/**
 * Group container for multiple ThreatStat components
 *
 * @example
 * ```tsx
 * <RvnThreatStatGroup orientation="vertical" gap="s">
 *   <RvnThreatStat label="UPM" value={1000} />
 *   <RvnThreatStat label="ASCENDER" value={800} />
 *   <RvnThreatStat label="DESCENDER" value={-200} />
 * </RvnThreatStatGroup>
 * ```
 */
export const RvnThreatStatGroup = React.forwardRef<HTMLDivElement, RvnThreatStatGroupProps>(
  function RvnThreatStatGroup(
    { orientation = 'vertical', gap = 'm', children, className, style },
    ref
  ) {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: orientation === 'horizontal' ? 'row' : 'column',
      gap: gapMap[gap],
      ...style,
    }

    return (
      <div
        ref={ref}
        className={className}
        style={containerStyle}
        data-rvn-threat-stat-group=""
      >
        {children}
      </div>
    )
  }
)

RvnThreatStatGroup.displayName = 'RvnThreatStatGroup'

export type { RvnThreatStatProps, RvnThreatStatGroupProps, StatVariant, StatOrientation, StatTrend }
