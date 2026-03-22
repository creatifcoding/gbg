/**
 * RvnPanel - Compound Panel Component
 *
 * Brutalist panel with black header, content area, and optional footer.
 * Follows components.build composition pattern.
 *
 * @example
 * ```tsx
 * <RvnPanel>
 *   <RvnPanel.Header>
 *     <RvnPanel.Title>Mission Objectives</RvnPanel.Title>
 *     <RvnPanel.Subtitle>PRIORITY: ALPHA</RvnPanel.Subtitle>
 *   </RvnPanel.Header>
 *   <RvnPanel.Content>
 *     <p>Panel content here...</p>
 *   </RvnPanel.Content>
 *   <RvnPanel.Footer>
 *     <span>Footer left</span>
 *     <span>Footer right</span>
 *   </RvnPanel.Footer>
 * </RvnPanel>
 * ```
 */

import * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RvnPanelContextValue {
  /** Whether the panel has a header */
  hasHeader: boolean
}

interface RvnPanelRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface RvnPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface RvnPanelTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

interface RvnPanelSubtitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
}

interface RvnPanelContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Remove default padding */
  noPadding?: boolean
}

interface RvnPanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const RvnPanelContext = React.createContext<RvnPanelContextValue>({
  hasHeader: false,
})

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  root: {
    border: 'var(--rvn-border, 3px solid #000000)',
    background: 'var(--rvn-surface, #ffffff)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    borderRadius: 'var(--rvn-radius, 0)',
  },
  header: {
    borderBottom: 'var(--rvn-border, 3px solid #000000)',
    padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--rvn-text-main, #000000)',
    color: 'var(--rvn-surface, #ffffff)',
    gap: 'var(--rvn-space-m, 20px)',
  },
  title: {
    fontFamily: 'var(--rvn-font-sans)',
    fontWeight: 700,
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--rvn-text-inverse, #ffffff)',
  },
  subtitle: {
    fontFamily: 'var(--rvn-font-mono)',
    fontSize: '10px',
    color: '#cccccc',
    flexShrink: 0,
  },
  content: {
    padding: 'var(--rvn-space-m, 20px)',
    flex: 1,
  },
  contentNoPadding: {
    padding: 0,
    flex: 1,
  },
  footer: {
    borderTop: '1px solid var(--rvn-border, #000000)',
    padding: 'var(--rvn-space-s, 10px) var(--rvn-space-m, 20px)',
    background: 'var(--rvn-surface, #ffffff)',
    color: 'var(--rvn-text-main, #000000)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--rvn-space-m, 20px)',
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Root panel container
 */
function Root({ children, style, ...props }: RvnPanelRootProps) {
  // Check if children includes a Header
  const hasHeader = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === Header
  )

  return (
    <RvnPanelContext.Provider value={{ hasHeader }}>
      <div
        style={{ ...styles.root, ...style }}
        data-rvn-panel=""
        {...props}
      >
        {children}
      </div>
    </RvnPanelContext.Provider>
  )
}

/**
 * Panel header with black background
 */
function Header({ children, style, ...props }: RvnPanelHeaderProps) {
  return (
    <div
      style={{ ...styles.header, ...style }}
      data-rvn-panel-header=""
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Panel title text
 */
function Title({ children, style, ...props }: RvnPanelTitleProps) {
  return (
    <span
      style={{ ...styles.title, ...style }}
      data-rvn-panel-title=""
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Panel subtitle (appears right-aligned in header)
 */
function Subtitle({ children, style, ...props }: RvnPanelSubtitleProps) {
  return (
    <span
      style={{ ...styles.subtitle, ...style }}
      data-rvn-panel-subtitle=""
      {...props}
    >
      {children}
    </span>
  )
}

/**
 * Panel content area
 */
function Content({ children, noPadding, style, ...props }: RvnPanelContentProps) {
  const contentStyle = noPadding ? styles.contentNoPadding : styles.content

  return (
    <div
      style={{ ...contentStyle, ...style }}
      data-rvn-panel-content=""
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Panel footer with space-between layout
 */
function Footer({ children, style, ...props }: RvnPanelFooterProps) {
  return (
    <div
      style={{ ...styles.footer, ...style }}
      data-rvn-panel-footer=""
      {...props}
    >
      {children}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Root.displayName = 'RvnPanel.Root'
Header.displayName = 'RvnPanel.Header'
Title.displayName = 'RvnPanel.Title'
Subtitle.displayName = 'RvnPanel.Subtitle'
Content.displayName = 'RvnPanel.Content'
Footer.displayName = 'RvnPanel.Footer'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnPanel = {
  Root,
  Header,
  Title,
  Subtitle,
  Content,
  Footer,
}

// Also export individual components for tree-shaking
export {
  Root as RvnPanelRoot,
  Header as RvnPanelHeader,
  Title as RvnPanelTitle,
  Subtitle as RvnPanelSubtitle,
  Content as RvnPanelContent,
  Footer as RvnPanelFooter,
}

// Export types
export type {
  RvnPanelRootProps,
  RvnPanelHeaderProps,
  RvnPanelTitleProps,
  RvnPanelSubtitleProps,
  RvnPanelContentProps,
  RvnPanelFooterProps,
}
