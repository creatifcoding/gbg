/**
 * Top Bar Content
 *
 * Canvas-derived top bar with tactical brutalist styling.
 * Corner decorations, neutral palette, monospace typography.
 *
 * Pattern from: src/components/static-ui/canvas-toolbar/toolbar.tsx
 *
 * EPOCH-0004: Global Overlay System
 *
 * @module
 */

import { PanelLeft, PanelRight, Save, Upload, Command } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Toolbar Primitives (from canvas-toolbar)
// ─────────────────────────────────────────────────────────────

function ToolbarButton({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        px-3 py-2 font-mono uppercase tracking-widest
        transition-colors flex items-center gap-1.5
        border-r border-neutral-800 last:border-r-0
        disabled:opacity-30 disabled:cursor-not-allowed
        ${
          active
            ? "bg-neutral-800 text-white"
            : "text-neutral-500 hover:bg-neutral-900 hover:text-white"
        }
      `}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}

function IconButton({
  children,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        group relative w-9 h-9
        flex items-center justify-center
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors
        border-r border-neutral-800 last:border-r-0
      `}
    >
      <span
        className={`
          absolute inset-0
          transition-all duration-150 ease-out
          ${active
            ? 'bg-neutral-800 opacity-100'
            : 'bg-neutral-800 opacity-0 group-hover:opacity-100'
          }
        `}
      />
      <span
        className={`
          relative z-10
          transition-colors duration-150
          ${active
            ? 'text-white'
            : 'text-neutral-500 group-hover:text-white'
          }
        `}
      >
        {children}
      </span>
    </button>
  )
}

/** Corner decoration - tactical brutalist aesthetic */
function CornerDecorations() {
  return (
    <>
      <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-neutral-700" />
      <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-neutral-700" />
      <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-neutral-700" />
      <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-neutral-700" />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TopBarContentProps {
  /** Title to display */
  title?: string
  /** Whether sidebar toggle is shown */
  showSidebarToggle?: boolean
  /** Whether drawer toggle is shown */
  showDrawerToggle?: boolean
  /** Sidebar toggle callback */
  onSidebarToggle?: () => void
  /** Drawer toggle callback */
  onDrawerToggle?: () => void
  /** Command palette toggle callback */
  onCommandPalette?: () => void
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function TopBarContent({
  title = "TMNL",
  showSidebarToggle = true,
  showDrawerToggle = true,
  onSidebarToggle,
  onDrawerToggle,
  onCommandPalette,
}: TopBarContentProps) {
  return (
    <div className="relative h-full w-full flex items-center bg-black">
      <CornerDecorations />

      {/* Left section */}
      <div className="flex items-center h-full">
        {showSidebarToggle && (
          <IconButton onClick={onSidebarToggle} title="Toggle Sidebar">
            <PanelLeft size={14} />
          </IconButton>
        )}

        {/* Title */}
        <div className="px-4 flex items-center gap-2 border-r border-neutral-800 h-full">
          <div className="w-1.5 h-1.5 bg-neutral-700" />
          <span
            className="font-mono uppercase tracking-widest text-neutral-400"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {title}
          </span>
        </div>
      </div>

      {/* Center section - command palette */}
      <div className="flex-1 flex justify-center">
        <button
          onClick={onCommandPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-neutral-800 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <Command size={12} />
          <span className="font-mono uppercase tracking-wider">Command</span>
          <kbd className="ml-2 px-1.5 py-0.5 font-mono rounded bg-neutral-800 border border-neutral-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center h-full">
        <ToolbarButton onClick={() => console.log("Save")} title="Save State">
          <Save size={10} />
          <span className="hidden lg:inline">Save</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => console.log("Load")} title="Load State">
          <Upload size={10} />
          <span className="hidden lg:inline">Load</span>
        </ToolbarButton>
        {showDrawerToggle && (
          <IconButton onClick={onDrawerToggle} title="Toggle Drawer">
            <PanelRight size={14} />
          </IconButton>
        )}
      </div>
    </div>
  )
}

export default TopBarContent
