/**
 * WindowLayout
 *
 * Layout orchestrator for child Tauri windows.
 * Derived from AppShell conventions with simplified structure:
 * - No sidebar (child windows focus on testbed workspace)
 * - Simple header with testbed name and window controls
 * - Full workspace area for the testbed
 *
 * Grid Structure:
 * ┌──────────────────────────────────────┐
 * │          HEADER (z-50)               │  ← row 1 (48px)
 * │   [name]              [min][max][x]  │
 * ├──────────────────────────────────────┤
 * │                                      │
 * │           WORKSPACE                  │  ← row 2 (1fr)
 * │          (testbed)                   │
 * │                                      │
 * └──────────────────────────────────────┘
 *
 * @module lib/shell
 */

import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HEADER_HEIGHT = "var(--tmnl-size-header, 48px)"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface WindowLayoutProps {
  /** Header content (WindowHeaderContent component) */
  header: ReactNode
  /** Main workspace content (testbed component) */
  children: ReactNode
  /** Optional className for the container */
  className?: string
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * WindowLayout provides CSS Grid layout for child Tauri windows.
 *
 * Uses same grid conventions as AppShell:
 * - Grid template for header/workspace split
 * - z-index layering for chrome
 * - Isolation for stacking contexts
 *
 * Key differences from AppShell:
 * - No sidebar column (full width workspace)
 * - Header spans full width (no corner overlap)
 */
export function WindowLayout({ header, children, className = "" }: WindowLayoutProps) {
  return (
    <div
      className={`h-screen w-screen grid bg-black overflow-hidden ${className}`}
      style={{
        gridTemplateColumns: "1fr",
        gridTemplateRows: `${HEADER_HEIGHT} 1fr`,
      }}
      data-window-layout
    >
      {/* Header: row 1, full width, z-50
          Contains testbed name, window controls, and drag region */}
      <header
        className="row-start-1 z-50 bg-black"
        data-window-header
      >
        {header}
      </header>

      {/* Workspace: row 2, full width
          - relative: establishes containing block for absolute children
          - isolate: creates new stacking context (z-index contained)
          - overflow-y-auto: scroll independently of chrome
          - overflow-x-hidden: prevent horizontal scroll bleed */}
      <main
        className="row-start-2 relative isolate overflow-y-auto overflow-x-hidden"
        data-window-content
      >
        {children}
      </main>
    </div>
  )
}

export default WindowLayout
