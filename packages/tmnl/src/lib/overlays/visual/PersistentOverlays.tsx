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

import { useCallback, useEffect, useRef, useState } from "react"
import { Settings, Terminal, User, Zap } from "lucide-react"
import { SelfchartersLogo } from "@/components/brand"
import { useDrawer } from "./hooks/useDrawer"
import { useCommandPalette } from "./hooks/useCommandPalette"
import { useSidebar } from "./hooks/useSidebar"
import { DrawerSlotContent } from "./components"
import { Sidebar, type SidebarConfig as SidebarComponentConfig } from "@/lib/sidebar"
import { useGlobalHotkeys, WhichKeyPopup } from "@/lib/hotkeys"
import { TmnlSettings } from "@/components/static-ui"
import { useScreensaver, ScreensaverOverlay } from "@/lib/screensaver"
import {
  registerPanelType,
  openRegisteredPanel,
  unregisterPanel,
  getPanel,
} from "@/lib/floating"
import { TerminalPanel, terminalPanelConfig } from "@/lib/terminal"
import type { VisualOverlayId } from "../schemas/visual"
import { Cursor } from "@/lib/cursor"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Left drawer ID - use with registerDrawerSlot() to inject content */
export const DRAWER_LEFT_ID = "persistent-drawer-left" as VisualOverlayId
/** Right drawer ID - use with registerDrawerSlot() to inject content */
export const DRAWER_RIGHT_ID = "persistent-drawer-right" as VisualOverlayId
/** Main sidebar ID */
export const SIDEBAR_ID = "main-sidebar" as VisualOverlayId
/** Terminal panel type ID for floating panel registry */
export const TERMINAL_PANEL_TYPE_ID = "terminal"

// ─────────────────────────────────────────────────────────────
// Default Sidebar Configuration
// ─────────────────────────────────────────────────────────────

const defaultSidebarConfig: SidebarComponentConfig = {
  coreItems: [
    {
      id: "home" as any,
      label: "Home",
      icon: { type: "lucide", value: "Home" },
      group: "core",
      action: { _tag: "RouteAction", path: "/" },
      order: 0,
    },
    {
      id: "playground" as any,
      label: "Playground",
      icon: { type: "lucide", value: "FlaskConical" },
      group: "core",
      action: { _tag: "RouteAction", path: "/playground" },
      order: 10,
    },
    {
      id: "testbed" as any,
      label: "Testbed",
      icon: { type: "lucide", value: "TestTube2" },
      group: "core",
      action: { _tag: "RouteAction", path: "/testbed" },
      order: 20,
    },
    {
      id: "settings" as any,
      label: "Settings",
      icon: { type: "lucide", value: "Settings" },
      group: "core",
      action: { _tag: "DrawerAction", drawerId: "settings", side: "right", width: 320 },
      order: 100,
    },
  ],
  width: 48,
  storageKey: "tmnl:sidebar",
}

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
  const sidebar = useSidebar()

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Terminal panel state - track the open panel instance ID
  const [terminalPanelId, setTerminalPanelId] = useState<string | null>(null)

  // ─── Screensaver ─────────────────────────────────────────────
  // Idle-triggered ASCII art overlay (60s default timeout)
  const screensaver = useScreensaver({
    idleTimeout: 60_000, // 1 minute
    enabled: true,
  })

  // ─── Toggle Terminal Panel ──────────────────────────────────
  // Must be defined before useGlobalHotkeys which references it
  const toggleTerminalPanel = useCallback(() => {
    console.log('[PersistentOverlays] toggleTerminalPanel called, current panelId:', terminalPanelId)
    if (terminalPanelId) {
      // Panel is open - check if it still exists, then close it
      const panel = getPanel(terminalPanelId)
      console.log('[PersistentOverlays] Closing panel, exists:', !!panel)
      if (panel) {
        unregisterPanel(terminalPanelId)
      }
      setTerminalPanelId(null)
    } else {
      // Panel is closed - open a new one
      console.log('[PersistentOverlays] Opening panel with type:', TERMINAL_PANEL_TYPE_ID)
      const newPanelId = openRegisteredPanel(TERMINAL_PANEL_TYPE_ID)
      console.log('[PersistentOverlays] Opened panel with id:', newPanelId)
      setTerminalPanelId(newPanelId)
    }
  }, [terminalPanelId])

  // ─── Global Hotkeys ─────────────────────────────────────────
  // Wires all system commands and handles keyboard events
  // Ctrl+Shift+P → minibuffer, Ctrl+, → settings, Ctrl+` → terminal, etc.
  const {
    isReady: hotkeysReady,
    showWhichKey,
    whichKeyEntries,
    currentSequence,
  } = useGlobalHotkeys({
    debug: false,
    onSettings: useCallback(() => setSettingsOpen(true), []),
    onTerminal: toggleTerminalPanel,
  })

  // Ref to track latest sidebar operations (avoids stale closure in effect)
  const sidebarRef = useRef(sidebar)
  sidebarRef.current = sidebar

  // ─── Mount Sidebar ───────────────────────────────────────────
  // Empty deps = mount once on initial render, unmount on component unmount
  // Uses ref to access latest sidebar operations without causing re-runs

  useEffect(() => {
    sidebarRef.current.mount(
      { id: SIDEBAR_ID as string, side: "left", collapsedWidth: 48 },
      <Sidebar config={defaultSidebarConfig} />
    )

    return () => {
      sidebarRef.current.unmount(SIDEBAR_ID)
    }
  }, [])

  // ─── Register Terminal Panel Type ────────────────────────────
  // Register the terminal panel type with the floating panel registry
  // This enables opening terminal panels via openRegisteredPanel('terminal')

  useEffect(() => {
    console.log('[PersistentOverlays] Registering terminal panel type:', TERMINAL_PANEL_TYPE_ID)
    console.log('[PersistentOverlays] terminalPanelConfig:', terminalPanelConfig)
    console.log('[PersistentOverlays] TerminalPanel component:', TerminalPanel)

    registerPanelType({
      id: TERMINAL_PANEL_TYPE_ID,
      title: terminalPanelConfig.title,
      component: TerminalPanel,
      defaultDimensions: terminalPanelConfig.defaultDimensions,
      minDimensions: terminalPanelConfig.minDimensions,
      resizable: terminalPanelConfig.resizable,
      closable: terminalPanelConfig.closable,
    })

    console.log('[PersistentOverlays] Terminal panel type registered')

    // Cleanup: no need to unregister as panel types are global singletons
  }, [])

  // ─── Toggle functions ─────────────────────────────────────────

  const toggleLeftDrawer = useCallback(() => {
    drawer.toggle(
      { id: DRAWER_LEFT_ID, side: "left", width: 280, showBackdrop: false },
      <DrawerSlotContent drawerId={DRAWER_LEFT_ID} side="left" />
    )
  }, [drawer])

  const toggleRightDrawer = useCallback(() => {
    drawer.toggle(
      { id: DRAWER_RIGHT_ID, side: "right", width: 320, showBackdrop: false },
      <DrawerSlotContent drawerId={DRAWER_RIGHT_ID} side="right" />
    )
  }, [drawer])

  // ─── Command Palette ────────────────────────────────────────
  // Uses minibuffer with CommandProvider for M-x behavior

  const toggleCommand = useCallback(() => {
    commandPalette.toggle()
  }, [commandPalette])

  // ─── Settings ─────────────────────────────────────────────────

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  // ─── Tab Change ─────────────────────────────────────────────

  const handleTabChange = useCallback((tab: string) => {
    onTabChange?.(tab)
  }, [onTabChange])

  if (!showHeader) {
    return (
      <>
        {/* Screensaver overlay - renders even when header hidden */}
        <ScreensaverOverlay isActive={screensaver.isActive} />
        {/* AI Cursor - global, always mounted */}
        <Cursor />
      </>
    )
  }

  return (
    <>
    {/* Screensaver overlay - highest z-index */}
    <ScreensaverOverlay isActive={screensaver.isActive} />

    {/* AI Cursor - global Dynamic Island overlay */}
    <Cursor />

    <header
      className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800 flex items-center justify-between px-4 bg-black"
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
          <SelfchartersLogo.Static
            variant="solid"
            size={18}
            fillColor="#ffffff"
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

      {/* Which-key popup - shows available key continuations */}
      {showWhichKey && whichKeyEntries.length > 0 && (
        <WhichKeyPopup entries={whichKeyEntries} prefix={currentSequence} />
      )}

      {/* Settings modal */}
      <TmnlSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
    </>
  )
}

export default PersistentOverlays
