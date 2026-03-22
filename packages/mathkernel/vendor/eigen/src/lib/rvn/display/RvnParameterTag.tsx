/**
 * RVN Parameter Tag
 *
 * Tag component for mission parameters and configuration values.
 * Slightly larger than badges, designed for wrapping content.
 *
 * @source react-app(31).js lines 107-121
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnParameterTagProps {
  /** Tag content */
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const tagStyles: React.CSSProperties = {
  display: 'inline-block',
  border: '1px solid #000000',
  padding: '4px 8px',
  margin: '0 4px 4px 0',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  fontFamily: 'var(--rvn-font-sans, sans-serif)',
  lineHeight: 1.2,
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Parameter tag for configuration displays
 *
 * @example Single tag
 * ```tsx
 * <RvnParameterTag>Rules of Engagement: Level 4</RvnParameterTag>
 * ```
 *
 * @example Multiple tags (inline flow)
 * ```tsx
 * <div>
 *   <RvnParameterTag>Stealth: Optional</RvnParameterTag>
 *   <RvnParameterTag>Recall: Manual Only</RvnParameterTag>
 *   <RvnParameterTag>Sync: High Bandwidth</RvnParameterTag>
 * </div>
 * ```
 */
export function RvnParameterTag({
  children,
  className,
  style,
}: RvnParameterTagProps) {
  return (
    <div
      className={className}
      style={{
        ...tagStyles,
        ...style,
      }}
      data-rvn-parameter-tag=""
    >
      {children}
    </div>
  )
}

RvnParameterTag.displayName = 'RvnParameterTag'
