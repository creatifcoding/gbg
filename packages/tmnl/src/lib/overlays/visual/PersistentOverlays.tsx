/**
 * Persistent Overlays
 *
 * Renders persistent chrome (header, drawers) as DOM siblings.
 * Header is inline (not imported) for easy customization.
 * Drawers are managed via the overlay system with mutex behavior.
 *
 * EPOCH-0004: Global Overlay System
 *
 * @module
 */

import { useCallback, useEffect, useRef } from "react"
import { Crosshair, Settings, Terminal, User, Zap, PanelLeft, PanelRight } from "lucide-react"
import { useDrawer } from "./hooks/useDrawer"
import { useCommandPalette } from "./hooks/useCommandPalette"
import type { VisualOverlayId } from "../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DRAWER_LEFT_ID = "persistent-drawer-left" as VisualOverlayId
const DRAWER_RIGHT_ID = "persistent-drawer-right" as VisualOverlayId

// ─────────────────────────────────────────────────────────────
// Button Primitives (inline for customization)
// ─────────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "outline" | "ghost" | "tmnl"
  size?: "xs" | "sm" | "md"
  className?: string
}

function Button({ children, onClick, variant = "ghost", size = "xs", className = "" }: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-1.5 font-mono uppercase tracking-wider transition-colors disabled:opacity-50"

  const sizeClasses = {
    xs: "px-2 py-1",
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
  }

  const variantClasses = {
    outline: "border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white hover:bg-neutral-900",
    ghost: "text-neutral-500 hover:text-white hover:bg-neutral-900",
    tmnl: "bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700",
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Empty Drawer Content (placeholder for injection)
// ─────────────────────────────────────────────────────────────

function EmptyDrawerContent({ side }: { side: "left" | "right" }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-neutral-600 p-4">
      <div className="w-12 h-12 border border-neutral-700 rounded flex items-center justify-center mb-4">
        {side === "left" ? <PanelLeft size={20} /> : <PanelRight size={20} />}
      </div>
      <span
        className="font-mono uppercase tracking-wider"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {side === "left" ? "Left Panel" : "Right Panel"}
      </span>
      <span
        className="text-neutral-700 mt-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        No content
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Command Palette Content (placeholder)
// ─────────────────────────────────────────────────────────────

function CommandPaletteContent() {
  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Type a command..."
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        autoFocus
      />
      <div className="mt-4 text-neutral-600 text-center" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        No commands available
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PersistentOverlaysProps {
  /** Whether to show the header (defaults to true) */
  showHeader?: boolean
  /** Navigation tabs for header */
  navTabs?: string[]
  /** Currently active tab */
  activeTab?: string
  /** Tab change callback */
  onTabChange?: (tab: string) => void
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * PersistentOverlays
 *
 * Renders the header and manages persistent drawers.
 * Position BEFORE RouterProvider to be at top of document flow.
 *
 * @example
 * ```tsx
 * <VisualOverlayProvider>
 *   <PersistentOverlays />
 *   <GlobalSlot />
 *   <RouterProvider router={router} />
 * </VisualOverlayProvider>
 * ```
 */
export function PersistentOverlays({
  showHeader = true,
  navTabs = ["OVERVIEW", "DATA", "CANVAS", "TESTBED"],
  activeTab: controlledActiveTab,
  onTabChange,
}: PersistentOverlaysProps) {
  const drawer = useDrawer()
  const commandPalette = useCommandPalette()

  // Track which drawers are open
  const leftDrawerOpenRef = useRef(false)
  const rightDrawerOpenRef = useRef(false)

  // ─── Drawer Mutex Logic ─────────────────────────────────────

  const toggleLeftDrawer = useCallback(() => {
    if (leftDrawerOpenRef.current) {
      // Close left drawer
      drawer.close(DRAWER_LEFT_ID)
      leftDrawerOpenRef.current = false
    } else {
      // Mutex: close right drawer if open
      if (rightDrawerOpenRef.current) {
        drawer.close(DRAWER_RIGHT_ID)
        rightDrawerOpenRef.current = false
      }
      // Open left drawer
      drawer.open(
        { id: DRAWER_LEFT_ID, side: "left", width: 320, showBackdrop: false },
        <EmptyDrawerContent side="left" />
      )
      leftDrawerOpenRef.current = true
    }
  }, [drawer])

  const toggleRightDrawer = useCallback(() => {
    if (rightDrawerOpenRef.current) {
      // Close right drawer
      drawer.close(DRAWER_RIGHT_ID)
      rightDrawerOpenRef.current = false
    } else {
      // Mutex: close left drawer if open
      if (leftDrawerOpenRef.current) {
        drawer.close(DRAWER_LEFT_ID)
        leftDrawerOpenRef.current = false
      }
      // Open right drawer
      drawer.open(
        { id: DRAWER_RIGHT_ID, side: "right", width: 320, showBackdrop: false },
        <EmptyDrawerContent side="right" />
      )
      rightDrawerOpenRef.current = true
    }
  }, [drawer])

  // ─── Command Palette ────────────────────────────────────────

  const toggleCommand = useCallback(() => {
    commandPalette.toggle({}, <CommandPaletteContent />)
  }, [commandPalette])

  // ─── Keyboard Shortcut (⌘K) ─────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        toggleCommand()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggleCommand])

  // ─── Settings (placeholder) ─────────────────────────────────

  const openSettings = useCallback(() => {
    console.log("[Header] Settings - not yet implemented")
  }, [])

  // ─── Tab Change ─────────────────────────────────────────────

  const handleTabChange = useCallback((tab: string) => {
    onTabChange?.(tab)
  }, [onTabChange])

  if (!showHeader) {
    return null
  }

  return (
    <header
      className="border-b border-neutral-800 flex items-center justify-between px-4 bg-black shrink-0"
      style={{ height: 'var(--tmnl-size-header, 48px)' }}
      data-persistent-header
    >
      {/* Left section */}
      <div className="flex items-center gap-6">
        <button
          onClick={toggleLeftDrawer}
          className="p-1 hover:bg-neutral-900 transition-colors"
          title="Toggle Left Panel"
        >
          <User
            className="text-neutral-600 hover:text-white"
            style={{
              width: 'var(--tmnl-text-base, 16px)',
              height: 'var(--tmnl-text-base, 16px)',
            }}
          />
        </button>

        <div className="flex items-center gap-2">
          <Crosshair
            className="text-white"
            style={{
              width: 'var(--tmnl-text-lg, 18px)',
              height: 'var(--tmnl-text-lg, 18px)',
            }}
          />
          <span
            className="text-white font-bold tracking-tight uppercase"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            TMNL
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 ml-4">
          {navTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`font-mono uppercase tracking-wider transition-colors ${
                controlledActiveTab === tab
                  ? 'text-white'
                  : 'text-neutral-600 hover:text-neutral-300'
              }`}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Right section */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={toggleCommand}>
          <Terminal
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
          CMD
        </Button>
        <Button variant="ghost" onClick={openSettings}>
          <Settings
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
        </Button>
        <Button variant="tmnl" onClick={toggleRightDrawer}>
          <Zap
            style={{
              width: 'var(--tmnl-text-xs, 12px)',
              height: 'var(--tmnl-text-xs, 12px)',
            }}
          />
          ACTIONS
        </Button>
      </div>
    </header>
  )
}

export default PersistentOverlays
