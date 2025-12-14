/**
 * Sidebar
 *
 * Main sidebar container with core and plugin sections.
 * Icon-only design, expands drawers adjacent to sidebar.
 *
 * @module sidebar/components
 */

import { memo, useCallback, useEffect, useState } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useNavigate } from "@tanstack/react-router"

import type { SidebarItemConfig, SidebarConfig } from "../schemas"
import {
  sidebarRegistry,
  sidebarCollapsedAtom,
  sortedSidebarItemsAtom,
  registerItem,
  setActiveId,
  toggleCollapsed,
} from "../atoms"
import { SidebarItem } from "./SidebarItem"
import { SidebarDivider } from "./SidebarDivider"
import { useDrawer } from "@/lib/overlays"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 48 // px
const SIDEBAR_WIDTH_COLLAPSED = 0 // px (hidden when collapsed)

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarProps {
  /** Sidebar configuration with core items */
  config: SidebarConfig
  /** Optional className for container */
  className?: string
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Main sidebar component.
 *
 * Features:
 * - Icon-only buttons with tooltips
 * - Core section (fixed) + plugin section (reorderable)
 * - Ctrl+drag to reorder plugins
 * - Collapse/expand toggle
 * - Drawer integration for drawer actions
 */
export const Sidebar = memo(function Sidebar({ config, className = "" }: SidebarProps) {
  const navigate = useNavigate()
  const drawer = useDrawer()

  // Subscribe to state
  const isCollapsed = useAtomValue(sidebarCollapsedAtom, { registry: sidebarRegistry })
  const { core, plugins } = useAtomValue(sortedSidebarItemsAtom, { registry: sidebarRegistry })

  // Track Ctrl key for drag mode
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)

  // Register core items on mount
  useEffect(() => {
    for (const item of config.coreItems) {
      registerItem(item)
    }
  }, [config.coreItems])

  // Ctrl key tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") setIsCtrlHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") setIsCtrlHeld(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  // Handle item click based on action type
  const handleItemClick = useCallback(
    (item: SidebarItemConfig) => {
      const action = item.action

      switch (action._tag) {
        case "RouteAction":
          setActiveId(item.id)
          navigate({ to: action.path, search: action.search })
          break

        case "CommandAction":
          // TODO: Integrate with command palette system
          console.log("Command action:", action.commandId, action.args)
          break

        case "DrawerAction":
          setActiveId(item.id)
          drawer.toggle(
            {
              id: action.drawerId as any,
              side: action.side,
              width: action.width ?? 280,
              showBackdrop: false,
            },
            <div className="p-4 text-neutral-400">
              Drawer content for: {item.label}
            </div>
          )
          break

        case "WidgetAction":
          // TODO: Integrate with widget system
          console.log("Widget action:", action.widgetType, action.config)
          break
      }
    },
    [navigate, drawer]
  )

  // Compute sidebar width
  const width = isCollapsed
    ? (config.width ?? SIDEBAR_WIDTH_COLLAPSED)
    : (config.width ?? SIDEBAR_WIDTH)

  return (
    <aside
      className={`
        fixed left-0 top-12 bottom-0 z-40
        flex flex-col items-center
        bg-neutral-900/95 border-r border-neutral-800
        transition-all duration-200 ease-out
        ${className}
      `}
      style={{ width: `${width}px` }}
      role="navigation"
      aria-label="Main sidebar"
      data-collapsed={isCollapsed}
    >
      {/* Core section */}
      <div className="flex flex-col items-center gap-1 py-2 w-full">
        {core.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            onClick={handleItemClick}
            isCtrlHeld={false}
          />
        ))}
      </div>

      {/* Divider (only if plugins exist) */}
      {plugins.length > 0 && <SidebarDivider />}

      {/* Plugin section (reorderable) */}
      <div className="flex flex-col items-center gap-1 py-2 w-full flex-1 overflow-y-auto">
        {plugins.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            onClick={handleItemClick}
            isCtrlHeld={isCtrlHeld}
          />
        ))}
      </div>

      {/* Collapse toggle at bottom */}
      <button
        type="button"
        className="
          w-10 h-10 mb-2
          flex items-center justify-center
          text-neutral-500 hover:text-neutral-300
          transition-colors
        "
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg
          className={`w-4 h-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  )
})
