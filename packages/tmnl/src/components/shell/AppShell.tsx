/**
 * AppShell
 *
 * Layout orchestrator using CSS Grid.
 * Defines viewport grid with Header, Sidebar, and Content as siblings.
 * Handles overlap at top-left corner (header on top).
 *
 * Grid Structure:
 * ┌────────────────────────────────────┐
 * │░░░░│      HEADER (z-50)            │  ← row 1 (48px)
 * ├────┼───────────────────────────────┤
 * │SIDE│         CONTENT               │  ← row 2 (1fr)
 * │BAR │      (children)               │
 * └────┴───────────────────────────────┘
 *   ↑ col 1 (48px)    ↑ col 2 (1fr)
 *
 * ░░░░ = overlap zone (header on top of sidebar corner)
 *
 * @module components/shell
 */

import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HEADER_HEIGHT = "var(--tmnl-size-header, 48px)"
const SIDEBAR_WIDTH = "var(--tmnl-size-sidebar, 48px)"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AppShellProps {
  /** Header content */
  header: ReactNode
  /** Sidebar content */
  sidebar: ReactNode
  /** Main content (routes, pages) */
  children: ReactNode
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function AppShell({ header, sidebar, children }: AppShellProps) {
  return (
    <div
      className="h-screen w-full grid bg-black overflow-hidden"
      style={{
        gridTemplateColumns: `${SIDEBAR_WIDTH} 1fr`,
        gridTemplateRows: `${HEADER_HEIGHT} 1fr`,
      }}
      data-app-shell
    >
      {/* Header: row 1, col 1-2 (full width), z-50
          Content is padded left by sidebar width to show corner overlap */}
      <header
        className="col-span-2 row-start-1 z-50 bg-black"
        data-shell-header
      >
        {header}
      </header>

      {/* Sidebar: row 1-2 (full height), col 1, z-40
          Top portion (header height) shows through as overlap corner */}
      <aside
        className="row-span-2 col-start-1 z-40 bg-black"
        data-shell-sidebar
      >
        {sidebar}
      </aside>

      {/* Content: row 2, col 2 (fills remaining space)
          - relative: establishes containing block for absolute children
          - isolate: creates new stacking context (z-index contained)
          - overflow-auto: scroll independently of chrome
          - overflow-x-hidden: prevent horizontal scroll bleed */}
      <main
        className="row-start-2 col-start-2 relative isolate overflow-y-auto overflow-x-hidden"
        data-shell-content
      >
        {children}
      </main>
    </div>
  )
}

export default AppShell
