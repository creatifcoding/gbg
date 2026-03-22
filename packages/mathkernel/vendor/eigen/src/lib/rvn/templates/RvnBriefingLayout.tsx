/**
 * RVN Briefing Layout
 *
 * Two-column layout for briefing/detail interfaces:
 * - Header with navigation, breadcrumbs, title, and actions
 * - Sidebar (400px) - Objectives, stats, parameters
 * - Main (flex) - Primary content area (maps, charts, etc.)
 * - Footer - Status bar
 *
 * Extracted from: react-app(31).js (mission briefing interface)
 * Pattern: Header + 2-column (400px sidebar | flex main)
 *
 * @example
 * ```tsx
 * <RvnBriefingLayout>
 *   <RvnBriefingLayout.Header>
 *     <NavBar />
 *   </RvnBriefingLayout.Header>
 *   <RvnBriefingLayout.Title
 *     breadcrumb="Intel / Briefings / Sector 09"
 *     title="Op Sledgehammer"
 *   />
 *   <RvnBriefingLayout.Sidebar>
 *     <ObjectivesPanel />
 *     <ThreatPanel />
 *   </RvnBriefingLayout.Sidebar>
 *   <RvnBriefingLayout.Main>
 *     <TacticalMap />
 *   </RvnBriefingLayout.Main>
 *   <RvnBriefingLayout.Footer>
 *     <MissionInfo />
 *   </RvnBriefingLayout.Footer>
 * </RvnBriefingLayout>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface BriefingLayoutProps {
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
  /** Sidebar width - defaults to 400px */
  sidebarWidth?: string
  /** Max width of the container - defaults to 1400px */
  maxWidth?: string
}

interface SlotProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

interface TitleSlotProps extends SlotProps {
  /** Breadcrumb text */
  breadcrumb?: string
  /** Main title */
  title: string
  /** Highlighted portion of title */
  highlight?: string
  /** Actions to display on the right */
  actions?: React.ReactNode
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface BriefingLayoutContext {
  sidebarWidth: string
}

const LayoutContext = React.createContext<BriefingLayoutContext | null>(null)

// -----------------------------------------------------------------------------
// Slot Components
// -----------------------------------------------------------------------------

/**
 * Header slot - navigation bar area
 */
function Header({ children, className, style }: SlotProps) {
  return (
    <header
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--rvn-space-l, 30px)',
        borderBottom: '1px solid var(--rvn-border-muted, #ccc)',
        paddingBottom: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="header"
    >
      {children}
    </header>
  )
}
Header.displayName = 'RvnBriefingLayout.Header'

/**
 * Title slot - breadcrumb + large title + actions
 */
function Title({
  breadcrumb,
  title,
  highlight,
  actions,
  className,
  style,
}: TitleSlotProps) {
  // Split title by highlight if provided
  const renderTitle = () => {
    if (!highlight) return title
    const parts = title.split(highlight)
    if (parts.length === 1) return title
    return (
      <>
        {parts[0]}
        <span style={{ color: 'var(--rvn-accent, #000)' }}>{highlight}</span>
        {parts[1]}
      </>
    )
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--rvn-space-l, 30px)',
        ...style,
      }}
      data-rvn-slot="title"
    >
      <div>
        {breadcrumb && (
          <div
            style={{
              color: 'var(--rvn-text-main, #000)',
              fontWeight: 700,
              fontSize: 'var(--rvn-text-sm, 12px)',
              marginBottom: 'var(--rvn-space-s, 10px)',
              opacity: 0.5,
              fontFamily: 'var(--rvn-font-mono)',
              textTransform: 'uppercase',
            }}
          >
            {breadcrumb}
          </div>
        )}
        <h1
          style={{
            fontSize: '80px',
            fontWeight: 900,
            letterSpacing: '-0.06em',
            lineHeight: 0.85,
            textTransform: 'uppercase',
            margin: 'var(--rvn-space-s, 10px) 0 0',
          }}
        >
          {renderTitle()}
        </h1>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--rvn-space-m, 20px)' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
Title.displayName = 'RvnBriefingLayout.Title'

/**
 * Sidebar slot - left column for panels
 */
function Sidebar({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="sidebar"
    >
      {children}
    </div>
  )
}
Sidebar.displayName = 'RvnBriefingLayout.Sidebar'

/**
 * Main content slot - flexible right column
 */
function Main({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...style,
      }}
      data-rvn-slot="main"
    >
      {children}
    </div>
  )
}
Main.displayName = 'RvnBriefingLayout.Main'

/**
 * Content grid slot - the two-column area below title
 */
function ContentGrid({
  children,
  className,
  style,
  sidebarWidth = '400px',
}: SlotProps & { sidebarWidth?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        gap: 'var(--rvn-space-m, 20px)',
        flex: 1,
        ...style,
      }}
      data-rvn-slot="content-grid"
    >
      {children}
    </div>
  )
}
ContentGrid.displayName = 'RvnBriefingLayout.ContentGrid'

/**
 * Footer slot - status bar at bottom
 */
function Footer({ children, className, style }: SlotProps) {
  return (
    <footer
      className={className}
      style={{
        borderTop: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        paddingTop: 'var(--rvn-space-m, 20px)',
        marginTop: 'var(--rvn-space-m, 20px)',
        fontSize: 'var(--rvn-text-sm, 12px)',
        fontWeight: 700,
        color: 'var(--rvn-text-main, #000)',
        fontFamily: 'var(--rvn-font-mono)',
        display: 'flex',
        justifyContent: 'space-between',
        ...style,
      }}
      data-rvn-slot="footer"
    >
      {children}
    </footer>
  )
}
Footer.displayName = 'RvnBriefingLayout.Footer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Briefing Layout - Two-column layout with prominent header
 *
 * Structure:
 * ```
 * +------------------------------------------+
 * |   Brand    |    Nav    |    Status       |
 * +------------------------------------------+
 * | Breadcrumb                               |
 * | LARGE TITLE                    [Actions] |
 * +------------+-----------------------------+
 * | Sidebar    |         Main                |
 * | (400px)    |        (flex)               |
 * |            |                             |
 * +------------+-----------------------------+
 * |              Footer Status               |
 * +------------------------------------------+
 * ```
 */
function RvnBriefingLayout({
  children,
  className,
  style,
  sidebarWidth = '400px',
  maxWidth = '1400px',
}: BriefingLayoutProps) {
  const contextValue = React.useMemo(() => ({ sidebarWidth }), [sidebarWidth])

  return (
    <LayoutContext value={contextValue}>
      <div
        className={className}
        style={{
          background: 'var(--rvn-surface, #fff)',
          maxWidth,
          width: '100%',
          padding: 'var(--rvn-space-xl, 60px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rvn-space-l, 30px)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          border: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
          minHeight: '100vh',
          ...style,
        }}
        data-rvn-layout="briefing"
      >
        {children}
      </div>
    </LayoutContext>
  )
}
RvnBriefingLayout.displayName = 'RvnBriefingLayout'

// -----------------------------------------------------------------------------
// Compound Component Type
// -----------------------------------------------------------------------------

interface RvnBriefingLayoutComponent {
  (props: BriefingLayoutProps): React.ReactElement
  displayName: string
  Header: typeof Header
  Title: typeof Title
  Sidebar: typeof Sidebar
  Main: typeof Main
  ContentGrid: typeof ContentGrid
  Footer: typeof Footer
}

// -----------------------------------------------------------------------------
// Compound Component Assembly
// -----------------------------------------------------------------------------

const BriefingLayoutWithSlots = RvnBriefingLayout as RvnBriefingLayoutComponent
BriefingLayoutWithSlots.Header = Header
BriefingLayoutWithSlots.Title = Title
BriefingLayoutWithSlots.Sidebar = Sidebar
BriefingLayoutWithSlots.Main = Main
BriefingLayoutWithSlots.ContentGrid = ContentGrid
BriefingLayoutWithSlots.Footer = Footer

export { BriefingLayoutWithSlots as RvnBriefingLayout }
export type { BriefingLayoutProps, SlotProps as BriefingSlotProps, TitleSlotProps }
