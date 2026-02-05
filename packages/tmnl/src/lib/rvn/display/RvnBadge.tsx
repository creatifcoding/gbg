/**
 * RVN Badge
 *
 * Inline label badge for status, categories, and metadata.
 * Brutalist style with thick borders and uppercase text.
 *
 * @source react-app(31).js lines 107-121 (ParameterTag)
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnBadgeVariant = 'default' | 'filled' | 'muted'

interface RvnBadgeProps {
  /** Badge content */
  children: React.ReactNode
  /** Visual variant */
  variant?: RvnBadgeVariant
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const baseStyles: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 8px',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
  fontFamily: 'var(--rvn-font-sans, sans-serif)',
  lineHeight: 1,
  whiteSpace: 'nowrap',
}

const variantStyles: Record<RvnBadgeVariant, React.CSSProperties> = {
  default: {
    border: '1px solid #000000',
    background: 'transparent',
    color: '#000000',
  },
  filled: {
    border: '1px solid #000000',
    background: '#000000',
    color: '#ffffff',
  },
  muted: {
    border: '1px solid #999999',
    background: 'transparent',
    color: '#666666',
  },
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Badge for labels and status indicators
 *
 * @example Default variant
 * ```tsx
 * <RvnBadge>ACTIVE</RvnBadge>
 * ```
 *
 * @example Filled variant
 * ```tsx
 * <RvnBadge variant="filled">PRIORITY</RvnBadge>
 * ```
 *
 * @example Group of badges
 * ```tsx
 * <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
 *   <RvnBadge>SECTOR_04</RvnBadge>
 *   <RvnBadge>HIGH_PRIORITY</RvnBadge>
 *   <RvnBadge variant="muted">ARCHIVED</RvnBadge>
 * </div>
 * ```
 */
export function RvnBadge({
  children,
  variant = 'default',
  className,
  style,
}: RvnBadgeProps) {
  return (
    <span
      className={className}
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...style,
      }}
      data-rvn-badge=""
      data-variant={variant}
    >
      {children}
    </span>
  )
}

RvnBadge.displayName = 'RvnBadge'
