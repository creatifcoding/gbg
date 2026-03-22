/**
 * RvnFooter
 *
 * Page footer with monospace styling and top border.
 * Typically shows system info on left and session info on right.
 *
 * Patterns extracted from:
 * - react-app(24).js: "HAVOC SYSTEMS INC. // FLEET_MANAGEMENT_V4"
 * - react-app(34).js: "ENCRYPTION: AES-512-V2 // UNIT_ID: TX-99-BETA"
 *
 * @example
 * ```tsx
 * <RvnFooter>
 *   <RvnFooter.Left>HAVOC SYSTEMS INC.</RvnFooter.Left>
 *   <RvnFooter.Right>SESSION: ADMIN_01</RvnFooter.Right>
 * </RvnFooter>
 *
 * // Or simple mode
 * <RvnFooter left="HAVOC SYSTEMS INC." right="SESSION: ADMIN_01" />
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnFooterProps {
  children?: React.ReactNode
  /** Simple left content */
  left?: React.ReactNode
  /** Simple right content */
  right?: React.ReactNode
  /** Border width (default: 3px) */
  borderWidth?: number | string
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnFooterSectionProps {
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const footerStyles: React.CSSProperties = {
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--rvn-text-main, #000000)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 'auto',
  borderTop: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)',
  paddingTop: 'var(--rvn-space-l, 30px)',
}

const sectionStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rvn-space-s, 10px)',
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const RvnFooterLeft = React.forwardRef<HTMLDivElement, RvnFooterSectionProps>(
  ({ children, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...sectionStyles, ...style }}>
        {children}
      </div>
    )
  }
)
RvnFooterLeft.displayName = 'RvnFooter.Left'

const RvnFooterRight = React.forwardRef<HTMLDivElement, RvnFooterSectionProps>(
  ({ children, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...sectionStyles, ...style }}>
        {children}
      </div>
    )
  }
)
RvnFooterRight.displayName = 'RvnFooter.Right'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const RvnFooterRoot = React.forwardRef<HTMLElement, RvnFooterProps>(
  ({ children, left, right, borderWidth, className, style }, ref) => {
    const combinedStyles: React.CSSProperties = {
      ...footerStyles,
      ...(borderWidth
        ? { borderTop: `${typeof borderWidth === 'number' ? `${borderWidth}px` : borderWidth} solid var(--rvn-border, #000000)` }
        : {}),
      ...style,
    }

    // Simple mode with left/right props
    if ((left || right) && !children) {
      return (
        <footer ref={ref} className={className} style={combinedStyles}>
          <span>{left}</span>
          <span>{right}</span>
        </footer>
      )
    }

    return (
      <footer ref={ref} className={className} style={combinedStyles}>
        {children}
      </footer>
    )
  }
)
RvnFooterRoot.displayName = 'RvnFooter'

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnFooter = Object.assign(RvnFooterRoot, {
  Left: RvnFooterLeft,
  Right: RvnFooterRight,
})

export type { RvnFooterProps, RvnFooterSectionProps }
