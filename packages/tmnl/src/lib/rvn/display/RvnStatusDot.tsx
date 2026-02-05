/**
 * RVN Status Dot
 *
 * Visual indicator for status states.
 * Uses binary visual encoding:
 * - active: solid black
 * - alert: hollow with thick border
 * - offline: gray
 *
 * @source react-app(32).js lines 634-644
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnStatusDotStatus = 'active' | 'alert' | 'offline' | 'nominal'

interface RvnStatusDotProps {
  /** Status to display */
  status: RvnStatusDotStatus
  /** Size in pixels (default 8) */
  size?: number
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const getStatusStyles = (
  status: RvnStatusDotStatus,
  size: number
): React.CSSProperties => {
  const base: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    display: 'inline-block',
    border: '1px solid #000000',
    flexShrink: 0,
  }

  switch (status) {
    case 'active':
    case 'nominal':
      return {
        ...base,
        background: '#000000',
      }
    case 'alert':
      return {
        ...base,
        background: '#ffffff',
        border: '2px solid #000000',
        boxShadow: 'inset 0 0 0 1px #000000',
      }
    case 'offline':
      return {
        ...base,
        background: '#cccccc',
      }
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Status indicator dot
 *
 * @example
 * ```tsx
 * <RvnStatusDot status="active" />
 * <RvnStatusDot status="alert" />
 * <RvnStatusDot status="offline" />
 * ```
 *
 * @example Inline with text
 * ```tsx
 * <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 *   <RvnStatusDot status="nominal" />
 *   SYSTEM_NOMINAL
 * </span>
 * ```
 */
export function RvnStatusDot({
  status,
  size = 8,
  className,
  style,
}: RvnStatusDotProps) {
  return (
    <span
      className={className}
      style={{
        ...getStatusStyles(status, size),
        ...style,
      }}
      role="status"
      aria-label={`Status: ${status}`}
      data-rvn-status-dot=""
      data-status={status}
    />
  )
}

RvnStatusDot.displayName = 'RvnStatusDot'
