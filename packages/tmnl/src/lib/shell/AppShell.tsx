/**
 * AppShell
 *
 * Layout orchestrator using CSS Grid.
 * Defines viewport grid with Header, Sidebar, and Workspace as siblings.
 * Handles overlap at top-left corner (header on top).
 *
 * Grid Structure:
 * ┌────────────────────────────────────┐
 * │░░░░│      HEADER (z-50)            │  ← row 1 (48px)
 * ├────┼───────────────────────────────┤
 * │SIDE│         WORKSPACE             │  ← row 2 (1fr)
 * │BAR │      (children)               │
 * └────┴───────────────────────────────┘
 *   ↑ col 1 (48px)    ↑ col 2 (1fr)
 *
 * ░░░░ = overlap zone (header on top of sidebar corner)
 *
 * @module lib/shell
 */

import type { JSX, ReactNode } from "react"
import {
  AppShellHeader,
  type AppShellHeaderProps,
} from "./AppShell/Header"
import {
  AppShellSidebar,
  type AppShellSidebarProps,
} from "./AppShell/Sidebar"
import {
  AppShellWorkspace,
  type AppShellWorkspaceProps,
} from "./AppShell/Workspace"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HEADER_HEIGHT = "var(--tmnl-size-header, 48px)"
const SIDEBAR_WIDTH = "var(--tmnl-size-sidebar, 48px)"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AppShellProps {
  /** Compound sections: AppShell.Header, AppShell.Sidebar, AppShell.Workspace */
  children: ReactNode
  /** Optional className for root container */
  className?: string
}

type AppShellCompound = ((props: AppShellProps) => JSX.Element) & {
  Header: (props: AppShellHeaderProps) => JSX.Element
  Sidebar: (props: AppShellSidebarProps) => JSX.Element
  Workspace: (props: AppShellWorkspaceProps) => JSX.Element
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

function AppShellRoot({ children, className = "" }: AppShellProps) {
  return (
    <div
      className={`h-screen w-screen grid bg-black overflow-hidden ${className}`}
      style={{
        gridTemplateColumns: `${SIDEBAR_WIDTH} 1fr`,
        gridTemplateRows: `${HEADER_HEIGHT} 1fr`,
      }}
      data-app-shell
    >
      {children}
    </div>
  )
}

export const AppShell = Object.assign(AppShellRoot, {
  Header: AppShellHeader,
  Sidebar: AppShellSidebar,
  Workspace: AppShellWorkspace,
}) as AppShellCompound

export {
  AppShellHeader,
  type AppShellHeaderProps,
  AppShellSidebar,
  type AppShellSidebarProps,
  AppShellWorkspace,
  type AppShellWorkspaceProps,
}

export default AppShell
