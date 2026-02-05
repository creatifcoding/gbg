/**
 * RVN Indicator
 *
 * Flexible indicator component for various display scenarios.
 * Combines status dot with label for inline status displays.
 *
 * @source Derived from react-app(32).js StatusDot usage patterns
 */

import * as React from 'react'
import { RvnStatusDot, type RvnStatusDotStatus } from './RvnStatusDot'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnIndicatorProps {
  /** Status to display */
  status: RvnStatusDotStatus
  /** Label text */
  label: string
  /** Show status text after label */
  showStatusText?: boolean
  /** Dot size in pixels (default 8) */
  dotSize?: number
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const containerStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontFamily: 'var(--rvn-font-mono, monospace)',
  fontSize: '11px',
}

const labelStyles: React.CSSProperties = {
  fontWeight: 600,
}

const statusTextStyles: React.CSSProperties = {
  opacity: 0.7,
  textTransform: 'uppercase',
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Status indicator with label
 *
 * @example Basic usage
 * ```tsx
 * <RvnIndicator status="active" label="SYSTEM_ONLINE" />
 * ```
 *
 * @example With status text
 * ```tsx
 * <RvnIndicator status="alert" label="TX-99" showStatusText />
 * ```
 *
 * @example Offline
 * ```tsx
 * <RvnIndicator status="offline" label="COMMS_ARRAY" />
 * ```
 */
export function RvnIndicator({
  status,
  label,
  showStatusText = false,
  dotSize = 8,
  className,
  style,
}: RvnIndicatorProps) {
  return (
    <span
      className={className}
      style={{
        ...containerStyles,
        ...style,
      }}
      data-rvn-indicator=""
      data-status={status}
    >
      <RvnStatusDot status={status} size={dotSize} />
      <span style={labelStyles}>{label}</span>
      {showStatusText && (
        <span style={statusTextStyles}>[{status.toUpperCase()}]</span>
      )}
    </span>
  )
}

RvnIndicator.displayName = 'RvnIndicator'
