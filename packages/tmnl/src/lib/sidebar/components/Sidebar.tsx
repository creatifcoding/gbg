/**
 * Sidebar
 *
 * Main sidebar container with core and plugin sections.
 * Icon-only design, expands drawers adjacent to sidebar.
 *
 * Animation: Sharp tactical style with anime.js
 * - Quick snap with slight overshoot on collapse/expand
 * - Stagger cascade entrance for items
 * - White indicator accent for active state
 *
 * @module sidebar/components
 */

import { memo, useCallback, useEffect, useState, useRef } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { animate, stagger } from "animejs"
import router from "@/router"

import type { SidebarItemConfig, SidebarConfig } from "../schemas"
import {
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
// Animation Constants (Apple-inspired spring physics)
// ─────────────────────────────────────────────────────────────

/** Spring-like easing for organic feel */
const SPRING_OUT = "spring(1, 80, 10, 0)" // mass, stiffness, damping, velocity

/** Entrance animation */
const ENTRANCE_DURATION = 400
const STAGGER_DELAY = 40 // ms between items

/** Collapse animation */
const COLLAPSE_DURATION = 300

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
  const drawer = useDrawer()

  // Subscribe to state (registry provided via OverlayRegistryProvider context)
  const isCollapsed = useAtomValue(sidebarCollapsedAtom)
  const { core, plugins } = useAtomValue(sortedSidebarItemsAtom)

  // Track Ctrl key for drag mode
  const [isCtrlHeld, setIsCtrlHeld] = useState(false)

  // Animation refs
  const sidebarRef = useRef<HTMLElement>(null)
  const coreItemsRef = useRef<HTMLDivElement>(null)
  const pluginItemsRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)

  // Register core items on mount
  useEffect(() => {
    for (const item of config.coreItems) {
      registerItem(item)
    }
  }, [config.coreItems])

  // ─── Stagger entrance animation on mount ────────────────────
  useEffect(() => {
    if (hasMounted.current) return
    hasMounted.current = true

    // Animate core items with stagger cascade (Apple-style spring)
    const coreItems = coreItemsRef.current?.querySelectorAll("[data-sidebar-item-id]")
    if (coreItems?.length) {
      animate(coreItems, {
        opacity: [0, 1],
        translateX: [-12, 0],
        scale: [0.9, 1],
        duration: ENTRANCE_DURATION,
        easing: SPRING_OUT,
        delay: stagger(STAGGER_DELAY),
      })
    }

    // Animate plugin items slightly after core
    const pluginItems = pluginItemsRef.current?.querySelectorAll("[data-sidebar-item-id]")
    if (pluginItems?.length) {
      animate(pluginItems, {
        opacity: [0, 1],
        translateX: [-12, 0],
        scale: [0.9, 1],
        duration: ENTRANCE_DURATION,
        easing: SPRING_OUT,
        delay: stagger(STAGGER_DELAY, { start: (core.length * STAGGER_DELAY) + 80 }),
      })
    }
  }, [core.length])

  // ─── Collapse/expand animation ──────────────────────────────
  useEffect(() => {
    if (!sidebarRef.current || !hasMounted.current) return

    const targetWidth = isCollapsed
      ? (config.width ?? SIDEBAR_WIDTH_COLLAPSED)
      : (config.width ?? SIDEBAR_WIDTH)

    animate(sidebarRef.current, {
      width: targetWidth,
      duration: COLLAPSE_DURATION,
      easing: SPRING_OUT,
    })
  }, [isCollapsed, config.width])

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
          router.navigate({ to: action.path, search: action.search })
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
    [drawer]
  )

  // Compute initial sidebar width (anime.js handles animation)
  const initialWidth = isCollapsed
    ? (config.width ?? SIDEBAR_WIDTH_COLLAPSED)
    : (config.width ?? SIDEBAR_WIDTH)

  return (
    <aside
      ref={sidebarRef}
      className={`
        h-full w-full
        flex flex-col items-center
        bg-black overflow-hidden
        ${className}
      `}
      role="navigation"
      aria-label="Main sidebar"
      data-collapsed={isCollapsed}
    >
      {/* Core section */}
      <div
        ref={coreItemsRef}
        className="flex flex-col items-center gap-1 py-2 w-full"
      >
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
      <div
        ref={pluginItemsRef}
        className="flex flex-col items-center gap-1 py-2 w-full flex-1 overflow-y-auto"
      >
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
