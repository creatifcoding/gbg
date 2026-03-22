/**
 * RVN Dashboard Layout
 *
 * Three-column layout for dashboard interfaces:
 * - Sidebar (260px) - Navigation, lists, filters
 * - Main (flex) - Primary content area
 * - ActionRail (80px) - Quick actions, status indicators
 *
 * Extracted from: react-app(29).js (font manager dashboard)
 * Pattern: Sidebar (280px) | Main (flex) | Meta Panel (300px)
 *
 * @example
 * ```tsx
 * <RvnDashboardLayout>
 *   <RvnDashboardLayout.Header>
 *     <NavStrip />
 *   </RvnDashboardLayout.Header>
 *   <RvnDashboardLayout.Sidebar>
 *     <FontList />
 *   </RvnDashboardLayout.Sidebar>
 *   <RvnDashboardLayout.Main>
 *     <PreviewArea />
 *   </RvnDashboardLayout.Main>
 *   <RvnDashboardLayout.ActionRail>
 *     <MetaPanel />
 *   </RvnDashboardLayout.ActionRail>
 *   <RvnDashboardLayout.Footer>
 *     <StatusBar />
 *   </RvnDashboardLayout.Footer>
 * </RvnDashboardLayout>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DashboardLayoutProps {
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
  /** Sidebar width - defaults to var(--rvn-sidebar-width) */
  sidebarWidth?: string
  /** Action rail width - defaults to var(--rvn-action-rail-width) */
  actionRailWidth?: string
}

interface SlotProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface DashboardLayoutContext {
  sidebarWidth: string
  actionRailWidth: string
}

const LayoutContext = React.createContext<DashboardLayoutContext | null>(null)

function _useLayoutContext(): DashboardLayoutContext {
  const ctx = React.use(LayoutContext)
  if (!ctx) {
    throw new Error('Dashboard slot must be used within RvnDashboardLayout')
  }
  return ctx
}

// -----------------------------------------------------------------------------
// Slot Components
// -----------------------------------------------------------------------------

/**
 * Header slot - spans full width above the three columns
 */
function Header({ children, className, style }: SlotProps) {
  return (
    <header
      className={className}
      style={{
        gridColumn: '1 / -1',
        borderBottom: 'var(--rvn-border-w, 2px) solid var(--rvn-border, #000)',
        padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--rvn-surface-elevated, #e0e0e0)',
        ...style,
      }}
      data-rvn-slot="header"
    >
      {children}
    </header>
  )
}
Header.displayName = 'RvnDashboardLayout.Header'

/**
 * Sidebar slot - left column with dark background
 * Width controlled by sidebarWidth prop on parent
 */
function Sidebar({ children, className, style }: SlotProps) {
  return (
    <aside
      className={className}
      style={{
        background: 'var(--rvn-bg-dark, #050505)',
        color: 'var(--rvn-text-inv, #fff)',
        borderRight: 'var(--rvn-border-w, 2px) solid var(--rvn-border, #000)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
      data-rvn-slot="sidebar"
    >
      {children}
    </aside>
  )
}
Sidebar.displayName = 'RvnDashboardLayout.Sidebar'

/**
 * Main content slot - flexible center column
 * Takes remaining space between sidebar and action rail
 */
function Main({ children, className, style }: SlotProps) {
  return (
    <main
      className={className}
      style={{
        background: 'var(--rvn-surface, #dcdcdc)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        ...style,
      }}
      data-rvn-slot="main"
    >
      {children}
    </main>
  )
}
Main.displayName = 'RvnDashboardLayout.Main'

/**
 * Action rail slot - right column for actions/metadata
 */
function ActionRail({ children, className, style }: SlotProps) {
  return (
    <aside
      className={className}
      style={{
        background: 'var(--rvn-surface-muted, #999)',
        borderLeft: 'var(--rvn-border-w, 2px) solid var(--rvn-border, #000)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        ...style,
      }}
      data-rvn-slot="action-rail"
    >
      {children}
    </aside>
  )
}
ActionRail.displayName = 'RvnDashboardLayout.ActionRail'

/**
 * Footer slot - spans full width below the three columns
 */
function Footer({ children, className, style }: SlotProps) {
  return (
    <footer
      className={className}
      style={{
        gridColumn: '1 / -1',
        borderTop: 'var(--rvn-border-w, 2px) solid var(--rvn-border, #000)',
        background: 'var(--rvn-surface, #fff)',
        padding: 'var(--rvn-space-xs, 4px) var(--rvn-space-s, 10px)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 'var(--rvn-text-xs, 9px)',
        fontFamily: 'var(--rvn-font-mono)',
        textTransform: 'uppercase',
        ...style,
      }}
      data-rvn-slot="footer"
    >
      {children}
    </footer>
  )
}
Footer.displayName = 'RvnDashboardLayout.Footer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Dashboard Layout - Three-column grid with header and footer
 *
 * Grid structure:
 * ```
 * +------------------------------------------+
 * |                 Header                   |
 * +----------+------------------+------------+
 * | Sidebar  |      Main        | ActionRail |
 * | (260px)  |     (flex)       |   (80px)   |
 * +----------+------------------+------------+
 * |                 Footer                   |
 * +------------------------------------------+
 * ```
 */
function RvnDashboardLayout({
  children,
  className,
  style,
  sidebarWidth = 'var(--rvn-sidebar-width, 260px)',
  actionRailWidth = 'var(--rvn-action-rail-width, 80px)',
}: DashboardLayoutProps) {
  const contextValue = React.useMemo(
    () => ({ sidebarWidth, actionRailWidth }),
    [sidebarWidth, actionRailWidth]
  )

  return (
    <LayoutContext value={contextValue}>
      <div
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: `${sidebarWidth} 1fr ${actionRailWidth}`,
          gridTemplateRows: 'auto 1fr auto',
          height: '100%',
          minHeight: '100vh',
          border: 'var(--rvn-border-w, 2px) solid var(--rvn-border, #000)',
          background: 'var(--rvn-surface-elevated, #e0e0e0)',
          ...style,
        }}
        data-rvn-layout="dashboard"
      >
        {children}
      </div>
    </LayoutContext>
  )
}
RvnDashboardLayout.displayName = 'RvnDashboardLayout'

// -----------------------------------------------------------------------------
// Compound Component Type
// -----------------------------------------------------------------------------

interface RvnDashboardLayoutComponent {
  (props: DashboardLayoutProps): React.ReactElement
  displayName: string
  Header: typeof Header
  Sidebar: typeof Sidebar
  Main: typeof Main
  ActionRail: typeof ActionRail
  Footer: typeof Footer
}

// -----------------------------------------------------------------------------
// Compound Component Assembly
// -----------------------------------------------------------------------------

const DashboardLayoutWithSlots = RvnDashboardLayout as RvnDashboardLayoutComponent
DashboardLayoutWithSlots.Header = Header
DashboardLayoutWithSlots.Sidebar = Sidebar
DashboardLayoutWithSlots.Main = Main
DashboardLayoutWithSlots.ActionRail = ActionRail
DashboardLayoutWithSlots.Footer = Footer

export { DashboardLayoutWithSlots as RvnDashboardLayout }
export type { DashboardLayoutProps, SlotProps as DashboardSlotProps }
