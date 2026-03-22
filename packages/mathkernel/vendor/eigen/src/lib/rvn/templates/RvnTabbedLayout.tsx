/**
 * RVN Tabbed Layout
 *
 * Layout with header navigation + tabbed content area:
 * - Header with brand, nav strip, and status
 * - Tab bar for content switching
 * - Content area that fills remaining space
 * - Optional footer
 *
 * Extracted from: react-app(25).js (fleet overview)
 * Pattern: Header + TabNav + Content + Footer
 *
 * @example
 * ```tsx
 * <RvnTabbedLayout>
 *   <RvnTabbedLayout.Header>
 *     <Brand />
 *     <NavStrip items={['Overview', 'Details', 'Settings']} />
 *   </RvnTabbedLayout.Header>
 *   <RvnTabbedLayout.Title
 *     breadcrumb="Fleet / Overview"
 *     title="Active Units"
 *   />
 *   <RvnTabbedLayout.TabBar>
 *     <RvnTabbedLayout.Tab active>All Units</RvnTabbedLayout.Tab>
 *     <RvnTabbedLayout.Tab>Critical</RvnTabbedLayout.Tab>
 *     <RvnTabbedLayout.Tab>Offline</RvnTabbedLayout.Tab>
 *   </RvnTabbedLayout.TabBar>
 *   <RvnTabbedLayout.Content>
 *     <UnitGrid />
 *   </RvnTabbedLayout.Content>
 *   <RvnTabbedLayout.Footer>
 *     <StatusInfo />
 *   </RvnTabbedLayout.Footer>
 * </RvnTabbedLayout>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TabbedLayoutProps {
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
  /** Subtitle/classification */
  subtitle?: string
  /** Actions to display on the right */
  actions?: React.ReactNode
}

interface TabProps extends SlotProps {
  /** Whether this tab is active */
  active?: boolean
  /** Click handler */
  onClick?: () => void
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
        paddingBottom: 'var(--rvn-space-l, 30px)',
        marginBottom: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="header"
    >
      {children}
    </header>
  )
}
Header.displayName = 'RvnTabbedLayout.Header'

/**
 * Nav bar - brand + navigation + status row
 */
function NavBar({ children, className, style }: SlotProps) {
  return (
    <div
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
      data-rvn-slot="nav-bar"
    >
      {children}
    </div>
  )
}
NavBar.displayName = 'RvnTabbedLayout.NavBar'

/**
 * Title slot - page title with breadcrumb
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
          {title}
          {subtitle && (
            <span
              style={{
                fontWeight: 300,
                fontSize: '0.5em',
                color: 'var(--rvn-text-muted, #666)',
                marginLeft: '0.5em',
              }}
            >
              [{subtitle}]
            </span>
          )}
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
Title.displayName = 'RvnTabbedLayout.Title'

/**
 * Tab bar container
 */
function TabBar({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        marginBottom: 'var(--rvn-space-m, 20px)',
        ...style,
      }}
      data-rvn-slot="tab-bar"
      role="tablist"
    >
      {children}
    </div>
  )
}
TabBar.displayName = 'RvnTabbedLayout.TabBar'

/**
 * Individual tab
 */
function Tab({ children, active, onClick, className, style }: TabProps) {
  return (
    <button
      className={className}
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        background: active ? 'var(--rvn-text-main, #000)' : 'transparent',
        color: active ? 'var(--rvn-text-inv, #fff)' : 'var(--rvn-text-muted, #666)',
        border: 'none',
        borderBottom: active ? 'none' : 'var(--rvn-border-w, 3px) solid transparent',
        padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
        fontFamily: 'var(--rvn-font-mono)',
        fontWeight: 700,
        fontSize: 'var(--rvn-text-sm, 12px)',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: active ? '-3px' : '0',
        ...style,
      }}
      data-rvn-slot="tab"
      data-active={active || undefined}
    >
      {children}
    </button>
  )
}
Tab.displayName = 'RvnTabbedLayout.Tab'

/**
 * Content slot - main content area below tabs
 */
function Content({ children, className, style }: SlotProps) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...style,
      }}
      data-rvn-slot="content"
      role="tabpanel"
    >
      {children}
    </div>
  )
}
Content.displayName = 'RvnTabbedLayout.Content'

/**
 * Footer slot - status bar at bottom
 */
function Footer({ children, className, style }: SlotProps) {
  return (
    <footer
      className={className}
      style={{
        marginTop: 'auto',
        borderTop: 'var(--rvn-border-w, 3px) solid var(--rvn-border, #000)',
        paddingTop: 'var(--rvn-space-l, 30px)',
        fontSize: 'var(--rvn-text-xs, 10px)',
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
Footer.displayName = 'RvnTabbedLayout.Footer'

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

/**
 * Tabbed Layout - Single-page layout with tab navigation
 *
 * Structure:
 * ```
 * +------------------------------------------+
 * |   Brand    |    Nav    |    Status       |
 * +------------------------------------------+
 * | Breadcrumb                               |
 * | LARGE TITLE                    [Actions] |
 * +------------------------------------------+
 * | [Tab 1] [Tab 2] [Tab 3]                  |
 * +------------------------------------------+
 * |                                          |
 * |              Content Area                |
 * |                                          |
 * +------------------------------------------+
 * |              Footer Status               |
 * +------------------------------------------+
 * ```
 */
function RvnTabbedLayout({
  children,
  className,
  style,
  maxWidth = '1400px',
}: TabbedLayoutProps) {
  return (
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
      data-rvn-layout="tabbed"
    >
      {children}
    </div>
  )
}
RvnTabbedLayout.displayName = 'RvnTabbedLayout'

// -----------------------------------------------------------------------------
// Compound Component Type
// -----------------------------------------------------------------------------

interface RvnTabbedLayoutComponent {
  (props: TabbedLayoutProps): React.ReactElement
  displayName: string
  Header: typeof Header
  NavBar: typeof NavBar
  Title: typeof Title
  TabBar: typeof TabBar
  Tab: typeof Tab
  Content: typeof Content
  Footer: typeof Footer
}

// -----------------------------------------------------------------------------
// Compound Component Assembly
// -----------------------------------------------------------------------------

const TabbedLayoutWithSlots = RvnTabbedLayout as RvnTabbedLayoutComponent
TabbedLayoutWithSlots.Header = Header
TabbedLayoutWithSlots.NavBar = NavBar
TabbedLayoutWithSlots.Title = Title
TabbedLayoutWithSlots.TabBar = TabBar
TabbedLayoutWithSlots.Tab = Tab
TabbedLayoutWithSlots.Content = Content
TabbedLayoutWithSlots.Footer = Footer

export { TabbedLayoutWithSlots as RvnTabbedLayout }
export type { TabbedLayoutProps, SlotProps as TabbedSlotProps, TitleSlotProps as TabbedTitleSlotProps, TabProps }
