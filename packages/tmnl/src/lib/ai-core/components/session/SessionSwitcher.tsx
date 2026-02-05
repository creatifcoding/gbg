/**
 * SessionSwitcher Component
 *
 * Combined compound component that integrates SessionHeader + SessionSidebar
 * into a cohesive collapsible hybrid layout (Variant C from plan).
 *
 * @example
 * ```tsx
 * // Basic usage with SessionProvider
 * <SessionProvider>
 *   <SessionSwitcher>
 *     <ChatArea />
 *   </SessionSwitcher>
 * </SessionProvider>
 *
 * // Using compound components
 * <SessionProvider>
 *   <SessionSwitcher.Root>
 *     <SessionSwitcher.Header />
 *     <SessionSwitcher.Content>
 *       <SessionSwitcher.Sidebar />
 *       <SessionSwitcher.Main>
 *         <ChatArea />
 *       </SessionSwitcher.Main>
 *     </SessionSwitcher.Content>
 *   </SessionSwitcher.Root>
 * </SessionProvider>
 * ```
 */

import {
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ReactNode,
  createContext,
  useContext,
} from 'react'
import { SessionHeader, type SessionHeaderProps } from './SessionHeader'
import { SessionSidebar, type SessionSidebarProps } from './SessionSidebar'
import { useSessionContext } from './SessionProvider'
import { RVN_DARK } from '../rvn/rvn-tokens'

// =============================================================================
// Context
// =============================================================================

interface SessionSwitcherContextValue {
  sidebarExpanded: boolean
}

const SessionSwitcherContext = createContext<SessionSwitcherContextValue | null>(null)

function useSessionSwitcherContext(): SessionSwitcherContextValue {
  const ctx = useContext(SessionSwitcherContext)
  if (!ctx) {
    throw new Error('SessionSwitcher components must be used within SessionSwitcher.Root')
  }
  return ctx
}

// =============================================================================
// Styles
// =============================================================================

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: RVN_DARK.bg,
}

const contentStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}

const mainStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
}

// =============================================================================
// Root Component
// =============================================================================

export interface SessionSwitcherRootProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
}

/**
 * Root container for SessionSwitcher compound component
 */
function SessionSwitcherRoot({ children, style, ...props }: SessionSwitcherRootProps) {
  const { sessions } = useSessionContext()

  return (
    <SessionSwitcherContext.Provider value={{ sidebarExpanded: sessions.sidebarExpanded }}>
      <div style={{ ...rootStyle, ...style }} data-slot="session-switcher" {...props}>
        {children}
      </div>
    </SessionSwitcherContext.Provider>
  )
}

SessionSwitcherRoot.displayName = 'SessionSwitcher.Root'

// =============================================================================
// Content Component
// =============================================================================

export interface SessionSwitcherContentProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode
}

/**
 * Content area containing sidebar and main
 */
function SessionSwitcherContent({ children, style, ...props }: SessionSwitcherContentProps) {
  return (
    <div style={{ ...contentStyle, ...style }} data-slot="session-content" {...props}>
      {children}
    </div>
  )
}

SessionSwitcherContent.displayName = 'SessionSwitcher.Content'

// =============================================================================
// Main Component
// =============================================================================

export interface SessionSwitcherMainProps extends ComponentPropsWithoutRef<'main'> {
  children: ReactNode
}

/**
 * Main content area (chat, etc.)
 */
function SessionSwitcherMain({ children, style, ...props }: SessionSwitcherMainProps) {
  return (
    <main style={{ ...mainStyle, ...style }} data-slot="session-main" {...props}>
      {children}
    </main>
  )
}

SessionSwitcherMain.displayName = 'SessionSwitcher.Main'

// =============================================================================
// Simple Combined Component
// =============================================================================

export interface SessionSwitcherProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /** Content to render in main area */
  children: ReactNode
  /** Props for SessionHeader */
  headerProps?: SessionHeaderProps
  /** Props for SessionSidebar */
  sidebarProps?: SessionSidebarProps
  /** Hide header */
  hideHeader?: boolean
  /** Hide sidebar */
  hideSidebar?: boolean
}

/**
 * Combined SessionSwitcher with header, sidebar, and main area
 *
 * This is the simple API for common use cases. For more control,
 * use the compound components (SessionSwitcher.Root, etc.)
 *
 * Layout (Variant C - Collapsible Hybrid):
 * ```
 * ┌─────────────────────────────────────────────────┐
 * │ ▶ [● Session: Title]                    [+ New] │ ← Header
 * ├─────────┬───────────────────────────────────────┤
 * │ SIDEBAR │                                       │
 * │ (when   │         Main Content                  │
 * │ expanded)│        (children)                    │
 * │         │                                       │
 * └─────────┴───────────────────────────────────────┘
 * ```
 */
function SessionSwitcherSimple({
  children,
  headerProps,
  sidebarProps,
  hideHeader = false,
  hideSidebar = false,
  style,
  ...props
}: SessionSwitcherProps) {
  return (
    <SessionSwitcherRoot style={style} {...props}>
      {!hideHeader && <SessionHeader {...headerProps} />}
      <SessionSwitcherContent>
        {!hideSidebar && <SessionSidebar {...sidebarProps} />}
        <SessionSwitcherMain>{children}</SessionSwitcherMain>
      </SessionSwitcherContent>
    </SessionSwitcherRoot>
  )
}

SessionSwitcherSimple.displayName = 'SessionSwitcher'

// =============================================================================
// Compound Export
// =============================================================================

/**
 * SessionSwitcher with compound component API
 *
 * Simple usage:
 * ```tsx
 * <SessionSwitcher>
 *   <ChatArea />
 * </SessionSwitcher>
 * ```
 *
 * Compound usage:
 * ```tsx
 * <SessionSwitcher.Root>
 *   <SessionSwitcher.Header />
 *   <SessionSwitcher.Content>
 *     <SessionSwitcher.Sidebar />
 *     <SessionSwitcher.Main>
 *       <ChatArea />
 *     </SessionSwitcher.Main>
 *   </SessionSwitcher.Content>
 * </SessionSwitcher.Root>
 * ```
 */
export const SessionSwitcher = Object.assign(SessionSwitcherSimple, {
  Root: SessionSwitcherRoot,
  Header: SessionHeader,
  Content: SessionSwitcherContent,
  Sidebar: SessionSidebar,
  Main: SessionSwitcherMain,
})

// Type exports for compound components
export type {
  SessionSwitcherRootProps,
  SessionSwitcherContentProps,
  SessionSwitcherMainProps,
}
