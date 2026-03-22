/**
 * RvnSidebar
 *
 * Fixed-width sidebar container.
 * Standard widths: 260px or 380px (from design tokens).
 *
 * Patterns extracted from:
 * - react-app(26).js: Sidebar with fixed width
 * - spacing.ts: sidebarWidth (260px), sidebarWidthLg (380px)
 *
 * @example
 * ```tsx
 * <RvnSidebar>
 *   <RvnSidebar.Header>Navigation</RvnSidebar.Header>
 *   <RvnSidebar.Content>
 *     <RvnNavItem>Item 1</RvnNavItem>
 *     <RvnNavItem>Item 2</RvnNavItem>
 *   </RvnSidebar.Content>
 *   <RvnSidebar.Footer>v1.0.0</RvnSidebar.Footer>
 * </RvnSidebar>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SidebarSize = 'default' | 'large'

interface RvnSidebarProps {
  children: React.ReactNode
  /** Sidebar size variant */
  size?: SidebarSize
  /** Custom width (overrides size) */
  width?: number | string
  /** Position on screen */
  position?: 'left' | 'right'
  /** Show border on the opposite side */
  bordered?: boolean
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

interface RvnSidebarSectionProps {
  children: React.ReactNode
  /** Additional class name */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Size map
// -----------------------------------------------------------------------------

const SIDEBAR_WIDTHS: Record<SidebarSize, string> = {
  default: 'var(--rvn-sidebar-width, 260px)',
  large: 'var(--rvn-sidebar-width-lg, 380px)',
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const sidebarStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--rvn-surface, #ffffff)',
  height: '100%',
  minHeight: 0, // Allow flex shrinking
  overflow: 'hidden',
}

const headerStyles: React.CSSProperties = {
  padding: 'var(--rvn-space-m, 20px)',
  borderBottom: '1px solid var(--rvn-border-muted, #dddddd)',
  fontFamily: 'var(--rvn-font-sans)',
  fontWeight: 700,
  fontSize: '14px',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const contentStyles: React.CSSProperties = {
  padding: 'var(--rvn-space-m, 20px)',
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--rvn-space-s, 10px)',
}

const footerStyles: React.CSSProperties = {
  padding: 'var(--rvn-space-m, 20px)',
  borderTop: '1px solid var(--rvn-border-muted, #dddddd)',
  fontFamily: 'var(--rvn-font-mono)',
  fontSize: '12px',
  color: 'var(--rvn-text-muted, #666666)',
  flexShrink: 0,
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const RvnSidebarHeader = React.forwardRef<HTMLDivElement, RvnSidebarSectionProps>(
  ({ children, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...headerStyles, ...style }}>
        {children}
      </div>
    )
  }
)
RvnSidebarHeader.displayName = 'RvnSidebar.Header'

const RvnSidebarContent = React.forwardRef<HTMLDivElement, RvnSidebarSectionProps>(
  ({ children, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...contentStyles, ...style }}>
        {children}
      </div>
    )
  }
)
RvnSidebarContent.displayName = 'RvnSidebar.Content'

const RvnSidebarFooter = React.forwardRef<HTMLDivElement, RvnSidebarSectionProps>(
  ({ children, className, style }, ref) => {
    return (
      <div ref={ref} className={className} style={{ ...footerStyles, ...style }}>
        {children}
      </div>
    )
  }
)
RvnSidebarFooter.displayName = 'RvnSidebar.Footer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

const RvnSidebarRoot = React.forwardRef<HTMLElement, RvnSidebarProps>(
  (
    {
      children,
      size = 'default',
      width,
      position = 'left',
      bordered = true,
      className,
      style,
    },
    ref
  ) => {
    const resolvedWidth = width
      ? typeof width === 'number'
        ? `${width}px`
        : width
      : SIDEBAR_WIDTHS[size]

    const borderStyle =
      bordered && position === 'left'
        ? { borderRight: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)' }
        : bordered && position === 'right'
          ? { borderLeft: 'var(--rvn-border-width, 3px) solid var(--rvn-border, #000000)' }
          : {}

    const combinedStyles: React.CSSProperties = {
      ...sidebarStyles,
      width: resolvedWidth,
      minWidth: resolvedWidth,
      maxWidth: resolvedWidth,
      ...borderStyle,
      ...style,
    }

    return (
      <aside ref={ref} className={className} style={combinedStyles}>
        {children}
      </aside>
    )
  }
)
RvnSidebarRoot.displayName = 'RvnSidebar'

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

export const RvnSidebar = Object.assign(RvnSidebarRoot, {
  Header: RvnSidebarHeader,
  Content: RvnSidebarContent,
  Footer: RvnSidebarFooter,
})

export type { RvnSidebarProps, RvnSidebarSectionProps, SidebarSize }
