/**
 * Top Bar Content
 *
 * Content component for the top bar overlay.
 * Uses visual overlay hooks instead of prop-drilling callbacks.
 *
 * EPOCH-0004: Global Overlay System
 *
 * @module
 */

import { PanelLeft, PanelRight, Save, Upload, Command } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDrawer, useCommandPalette } from "@/lib/overlays/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TopBarContentProps {
  /** Title to display */
  title?: string
  /** Whether sidebar is available */
  showSidebarToggle?: boolean
  /** Whether drawer is available */
  showDrawerToggle?: boolean
  /** Content for sidebar (when toggled) */
  sidebarContent?: React.ReactNode
  /** Content for drawer (when toggled) */
  drawerContent?: React.ReactNode
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function TopBarContent({
  title = "TMNL",
  showSidebarToggle = true,
  showDrawerToggle = true,
  sidebarContent,
  drawerContent,
}: TopBarContentProps) {
  const drawer = useDrawer()
  const commandPalette = useCommandPalette()

  const toolbarActions = [
    { icon: Save, label: "Save State", onClick: () => console.log("Save") },
    { icon: Upload, label: "Load State", onClick: () => console.log("Load") },
  ]

  const handleSidebarToggle = () => {
    if (sidebarContent) {
      drawer.open(
        { id: "sidebar", slot: "global" as any, side: "left", width: 280 },
        sidebarContent
      )
    }
  }

  const handleDrawerToggle = () => {
    if (drawerContent) {
      drawer.open(
        { id: "settings", slot: "global" as any, side: "right", width: 400 },
        drawerContent
      )
    }
  }

  const handleCommandPalette = () => {
    commandPalette.toggle(
      { placeholder: "Type a command or search..." },
      <div className="p-4 text-sm text-gray-400">
        Command palette content goes here
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-between px-2 md:px-4">
      {/* Left section */}
      <div className="flex items-center gap-2 md:gap-4">
        {showSidebarToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSidebarToggle}
            className="text-[var(--tmnl-accent,#4ade80)] hover:bg-[var(--tmnl-accent,#4ade80)]/10"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
        <h1
          className="text-lg md:text-xl font-bold text-[var(--tmnl-accent,#4ade80)]"
          style={{ textShadow: "0 0 5px var(--tmnl-accent, #4ade80)" }}
        >
          {title}
        </h1>
      </div>

      {/* Center section - command palette trigger */}
      <button
        onClick={handleCommandPalette}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--tmnl-border,#333)] bg-[var(--tmnl-bg-muted,#1a1a1a)] text-sm text-[var(--tmnl-text-muted,#666)] hover:border-[var(--tmnl-accent,#4ade80)]/50 transition-colors"
      >
        <Command className="h-4 w-4" />
        <span>Command...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-xs rounded bg-[var(--tmnl-bg-surface,#222)] border border-[var(--tmnl-border,#333)]">
          ⌘K
        </kbd>
      </button>

      {/* Right section */}
      <div className="flex items-center gap-1 md:gap-2">
        {toolbarActions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            onClick={action.onClick}
            className="text-[var(--tmnl-accent,#4ade80)] hover:bg-[var(--tmnl-accent,#4ade80)]/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{action.label}</span>
          </Button>
        ))}
        {showDrawerToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDrawerToggle}
            className="text-[var(--tmnl-accent,#4ade80)] hover:bg-[var(--tmnl-accent,#4ade80)]/10"
          >
            <PanelRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  )
}

export default TopBarContent
