/**
 * RvnHeader
 *
 * Main header component for the RVN design system.
 * Contains brand, navigation, and status indicator slots.
 *
 * Patterns extracted from:
 * - react-app(24).js: Fleet Overview header
 * - react-app(31).js: Mission Briefing header
 *
 * @example
 * ```tsx
 * <RvnHeader>
 *   <RvnHeader.Brand icon={<Logo />}>HAVOC // OS</RvnHeader.Brand>
 *   <RvnHeader.Nav>
 *     <RvnNavItem active>Briefing</RvnNavItem>
 *     <RvnNavItem>Deployments</RvnNavItem>
 *   </RvnHeader.Nav>
 *   <RvnHeader.Status>SYNC.ACTIVE</RvnHeader.Status>
 * </RvnHeader>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnHeaderProps {
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
  /** Show bottom border */
  bordered?: boolean
}

interface RvnHeaderBrandProps {
  children: React.ReactNode
  /** Brand icon element */
  icon?: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnHeaderNavProps {
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnHeaderStatusProps {
  children: React.ReactNode
  /** Show active indicator dot */
  active?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const headerStyles: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: 'var(--rvn-space-m, 20px)',
  borderBottom: '1px solid var(--rvn-border-muted, #ccc)',
  marginBottom: 'var(--rvn-space-l, 30px)',
}

const brandStyles: React.CSSProperties = {
  fontFamily: 'var(--rvn-font-sans)',
  fontWeight: 900,
  fontSize: '24px',
  letterSpacing: '-0.04em',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rvn-space-s, 10px)',
  color: 'var(--rvn-text-main, #000000)',
}

const brandIconStyles: React.CSSProperties = {
  width: '24px',
  height: '24px',
  background: 'var(--rvn-text-main, #000000)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const navStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--rvn-space-l, 30px)',
  fontFamily: 'var(--rvn-font-mono)',
  fontWeight: 600,
  textTransform: 'uppercase',
}

const statusStyles: React.CSSProperties = {
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  color: 'var(--rvn-text-muted, #666666)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rvn-space-xs, 4px)',
}

const statusDotStyles: React.CSSProperties = {
  color: 'var(--rvn-text-main, #000000)',
  fontSize: '12px',
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const RvnHeaderBrand = React.forwardRef<HTMLDivElement, RvnHeaderBrandProps>(
  ({ children, icon, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...brandStyles, ...style }}>
        {icon ? (
          <div style={brandIconStyles}>{icon}</div>
        ) : (
          <div style={brandIconStyles} />
        )}
        {children}
      </div>
    )
  }
)
RvnHeaderBrand.displayName = 'RvnHeader.Brand'

const RvnHeaderNav = React.forwardRef<HTMLElement, RvnHeaderNavProps>(
  ({ children, className, style }, ref) => {
    return (
      <nav ref={ref} className={className} style={{ ...navStyles, ...style }}>
        {children}
      </nav>
    )
  }
)
RvnHeaderNav.displayName = 'RvnHeader.Nav'

const RvnHeaderStatus = React.forwardRef<HTMLDivElement, RvnHeaderStatusProps>(
  ({ children, active = true, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...statusStyles, ...style }}>
        {children}
        {active && <span style={statusDotStyles}>&#9679;</span>}
      </div>
    )
  }
)
RvnHeaderStatus.displayName = 'RvnHeader.Status'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const RvnHeaderRoot = React.forwardRef<HTMLElement, RvnHeaderProps>(
  ({ children, className, style, bordered = true }, ref) => {
    const combinedStyles: React.CSSProperties = {
      ...headerStyles,
      ...(bordered ? {} : { borderBottom: 'none' }),
      ...style,
    }

    return (
      <header ref={ref} className={className} style={combinedStyles}>
        {children}
      </header>
    )
  }
)
RvnHeaderRoot.displayName = 'RvnHeader'

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnHeader = Object.assign(RvnHeaderRoot, {
  Brand: RvnHeaderBrand,
  Nav: RvnHeaderNav,
  Status: RvnHeaderStatus,
})

export type {
  RvnHeaderProps,
  RvnHeaderBrandProps,
  RvnHeaderNavProps,
  RvnHeaderStatusProps,
}
