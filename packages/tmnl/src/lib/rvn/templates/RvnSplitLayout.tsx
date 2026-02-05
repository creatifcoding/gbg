/**
 * RVN Split Layout
 *
 * Two-section layout with status row:
 * - Header with navigation
 * - Status bar row (telemetry, metrics, etc.)
 * - Large primary area (map, visualization)
 * - Bottom grid section (multiple panels)
 * - Footer
 *
 * Extracted from: react-app(34).js (unit deployment view)
 * Pattern: Header + Stats Row + Hero Area + Panel Grid + Footer
 *
 * @example
 * ```tsx
 * <RvnSplitLayout>
 *   <RvnSplitLayout.Header>
 *     <NavBar />
 *   </RvnSplitLayout.Header>
 *   <RvnSplitLayout.Title
 *     breadcrumb="Deployments / Sector 04"
 *     title="Unit TX-99"
 *     subtitle="TITAN-CLASS"
 *   />
 *   <RvnSplitLayout.StatusRow columns={4}>
 *     <StatCard label="Power Core" value="24%" />
 *     <StatCard label="Structural" value="88%" />
 *   </RvnSplitLayout.StatusRow>
 *   <RvnSplitLayout.Hero>
 *     <TacticalMap />
 *   </RvnSplitLayout.Hero>
 *   <RvnSplitLayout.PanelGrid columns={3}>
 *     <Panel title="Hardware" />
 *     <Panel title="Comms Log" />
 *     <Panel title="Mission History" />
 *   </RvnSplitLayout.PanelGrid>
 *   <RvnSplitLayout.Footer>
 *     <StatusInfo />
 *   </RvnSplitLayout.Footer>
 * </RvnSplitLayout>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SplitLayoutProps {
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
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
  /** Subtitle/classification in brackets */
  subtitle?: string
  /** Actions to display on the right */
  actions?: React.ReactNode
}

interface StatusRowProps extends SlotProps {
  /** Number of columns - defaults to 4 */
  columns?: number
}

interface PanelGridProps extends SlotProps {
  /** Number of columns - defaults to 3 */
  columns?: number
}

// -----------------------------------------------------------------------------
// Slot Components
// -----------------------------------------------------------------------------

/**
 * Header slot - top navigation area
 */
function Header({ children, className, style }: SlotProps) {
  return (
    <header
      className={className}
      style={{
        borderBottom: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        paddingBottom: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="header"
    >
      {children}
    </header>
  )
}
Header.displayName = 'RvnSplitLayout.Header'

/**
 * NavBar component - brand + navigation + status
 */
function NavBar({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="nav-bar"
    >
      {children}
    </div>
  )
}
NavBar.displayName = 'RvnSplitLayout.NavBar'

/**
 * Title slot - page header with breadcrumb and actions
 */
function Title({
  breadcrumb,
  title,
  subtitle,
  actions,
  className,
  style,
}: TitleSlotProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        ...style,
      }}
      data-rvn-slot="title"
    >
      <div>
        {breadcrumb && (
          <div
            style={{
              fontFamily: 'var(--rvn-font-mono)',
              textTransform: 'uppercase',
              fontSize: 'var(--rvn-text-sm, 12px)',
              opacity: 0.6,
            }}
          >
            {breadcrumb}
          </div>
        )}
        <h1
          style={{
            fontSize: '48px',
            fontWeight: 900,
            textTransform: 'uppercase',
            lineHeight: 1,
            margin: 'var(--rvn-space-s, 10px) 0',
          }}
        >
          {title}
          {subtitle && (
            <span
              style={{
                fontWeight: 300,
                fontSize: '0.5em',
                marginLeft: '0.5em',
              }}
            >
              [{subtitle}]
            </span>
          )}
        </h1>
      </div>
      {actions && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--rvn-space-s, 10px)',
            marginBottom: 'var(--rvn-space-s, 10px)',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
Title.displayName = 'RvnSplitLayout.Title'

/**
 * Status row - horizontal grid of stat cards/meters
 */
function StatusRow({ children, columns = 4, className, style }: StatusRowProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--rvn-space-m, 20px)',
        padding: 'var(--rvn-space-m, 20px)',
        background: 'var(--rvn-surface-highlight, #f0f0f0)',
        border: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        marginBottom: 'var(--rvn-space-s, 10px)',
        ...style,
      }}
      data-rvn-slot="status-row"
    >
      {children}
    </div>
  )
}
StatusRow.displayName = 'RvnSplitLayout.StatusRow'

/**
 * Hero slot - large primary content area (map, visualization, etc.)
 */
function Hero({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        height: '400px',
        width: '100%',
        position: 'relative',
        border: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        backgroundColor: 'var(--rvn-surface, #fff)',
        backgroundImage:
          'linear-gradient(var(--rvn-border-muted, #eee) 1px, transparent 1px), linear-gradient(90deg, var(--rvn-border-muted, #eee) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        overflow: 'hidden',
        ...style,
      }}
      data-rvn-slot="hero"
    >
      {children}
    </div>
  )
}
Hero.displayName = 'RvnSplitLayout.Hero'

/**
 * Hero overlay - positioned header overlay on hero area
 */
function HeroOverlay({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        width: '100%',
        zIndex: 10,
        background: 'rgba(0,0,0,0.8)',
        borderBottom: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'var(--rvn-text-inv, #fff)',
        ...style,
      }}
      data-rvn-slot="hero-overlay"
    >
      {children}
    </div>
  )
}
HeroOverlay.displayName = 'RvnSplitLayout.HeroOverlay'

/**
 * Panel grid - bottom section with multiple panels
 */
function PanelGrid({ children, columns = 3, className, style }: PanelGridProps) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="panel-grid"
    >
      {children}
    </div>
  )
}
PanelGrid.displayName = 'RvnSplitLayout.PanelGrid'

/**
 * Footer slot - bottom status bar
 */
function Footer({ children, className, style }: SlotProps) {
  return (
    <footer
      className={className}
      style={{
        fontFamily: 'var(--rvn-font-mono)',
        color: 'var(--rvn-text-muted, #666)',
        marginTop: 'var(--rvn-space-m, 20px)',
        paddingTop: 'var(--rvn-space-s, 10px)',
        borderTop: '1px solid var(--rvn-border, #000)',
        fontSize: 'var(--rvn-text-xs, 10px)',
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
Footer.displayName = 'RvnSplitLayout.Footer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Split Layout - Vertical stacking with hero and panel grid
 *
 * Structure:
 * ```
 * +------------------------------------------+
 * |   Brand    |    Nav    |    Status       |
 * +------------------------------------------+
 * | Breadcrumb                               |
 * | TITLE                           [Actions]|
 * +------------------------------------------+
 * | [Stat 1] | [Stat 2] | [Stat 3] | [Stat 4]|
 * +------------------------------------------+
 * |                                          |
 * |              Hero Area                   |
 * |              (400px)                     |
 * |                                          |
 * +------------------------------------------+
 * | [Panel 1]  | [Panel 2]  | [Panel 3]     |
 * +------------------------------------------+
 * |              Footer Status               |
 * +------------------------------------------+
 * ```
 */
function RvnSplitLayout({
  children,
  className,
  style,
  maxWidth = '1400px',
}: SplitLayoutProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--rvn-surface, #fff)',
        maxWidth,
        width: '100%',
        padding: 'var(--rvn-space-xl, 60px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rvn-space-m, 20px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
        border: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        ...style,
      }}
      data-rvn-layout="split"
    >
      {children}
    </div>
  )
}
RvnSplitLayout.displayName = 'RvnSplitLayout'

// -----------------------------------------------------------------------------
// Compound Component Type
// -----------------------------------------------------------------------------

interface RvnSplitLayoutComponent {
  (props: SplitLayoutProps): React.ReactElement
  displayName: string
  Header: typeof Header
  NavBar: typeof NavBar
  Title: typeof Title
  StatusRow: typeof StatusRow
  Hero: typeof Hero
  HeroOverlay: typeof HeroOverlay
  PanelGrid: typeof PanelGrid
  Footer: typeof Footer
}

// -----------------------------------------------------------------------------
// Compound Component Assembly
// -----------------------------------------------------------------------------

const SplitLayoutWithSlots = RvnSplitLayout as RvnSplitLayoutComponent
SplitLayoutWithSlots.Header = Header
SplitLayoutWithSlots.NavBar = NavBar
SplitLayoutWithSlots.Title = Title
SplitLayoutWithSlots.StatusRow = StatusRow
SplitLayoutWithSlots.Hero = Hero
SplitLayoutWithSlots.HeroOverlay = HeroOverlay
SplitLayoutWithSlots.PanelGrid = PanelGrid
SplitLayoutWithSlots.Footer = Footer

export { SplitLayoutWithSlots as RvnSplitLayout }
export type {
  SplitLayoutProps,
  SlotProps as SplitSlotProps,
  TitleSlotProps as SplitTitleSlotProps,
  StatusRowProps,
  PanelGridProps,
}
