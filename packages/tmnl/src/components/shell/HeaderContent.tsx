/**
 * HeaderContent
 *
 * Typography:
 * - Navigation → Orbitron (font-nav)
 * - Buttons → Orbitron (font-button)
 * - Wordmark → VT323 (font-terminal)
 *
 * @module components/shell
 */

import { useCallback, useEffect } from "react"
import { Crosshair, Settings, Terminal, User, Zap } from "lucide-react"
import { useDrawer, useCommandPalette } from "@/lib/overlays"

// ─────────────────────────────────────────────────────────────
// Button Primitive
// ─────────────────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "outline" | "ghost" | "tmnl"
  size?: "xs" | "sm" | "md"
  className?: string
}

function Button({ children, onClick, variant = "ghost", size = "xs", className = "" }: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center gap-1.5 font-button uppercase tracking-wide transition-colors disabled:opacity-50"

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
      data-tauri-drag-region="false"
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {children}
    </button>
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
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-white font-label focus:outline-none focus:border-neutral-500"
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

export interface HeaderContentProps {
  /** Navigation tabs */
  navTabs?: string[]
  /** Currently active tab */
  activeTab?: string
  /** Tab change callback */
  onTabChange?: (tab: string) => void
  /** Toggle left drawer */
  onToggleLeftDrawer?: () => void
  /** Toggle right drawer */
  onToggleRightDrawer?: () => void
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function HeaderContent({
  navTabs = ["OVERVIEW", "DATA", "CANVAS", "TESTBED"],
  activeTab,
  onTabChange,
  onToggleLeftDrawer,
  onToggleRightDrawer,
}: HeaderContentProps) {
  const drawer = useDrawer()
  const commandPalette = useCommandPalette()

  // ─── Toggle functions ─────────────────────────────────────────

  const toggleLeftDrawer = useCallback(() => {
    onToggleLeftDrawer?.()
  }, [onToggleLeftDrawer])

  const toggleRightDrawer = useCallback(() => {
    onToggleRightDrawer?.()
  }, [onToggleRightDrawer])

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

  return (
    <div
      data-tauri-drag-region
      className="h-full flex items-center"
      style={{ borderBottom: "var(--tmnl-border-chrome)" }}
    >
      {/* Corner overlap zone - sidebar width, shows border intersection */}
      <div
        data-tauri-drag-region
        className="h-full flex items-center justify-center shrink-0"
        style={{
          width: "var(--tmnl-size-sidebar, 48px)",
          borderRight: "var(--tmnl-border-chrome)",
        }}
      >
        {/* Corner indicator - subtle crosshair */}
        <Crosshair
          className="text-neutral-700"
          style={{
            width: 'var(--tmnl-text-base, 16px)',
            height: 'var(--tmnl-text-base, 16px)',
          }}
        />
      </div>

      {/* Main header content - after sidebar zone */}
      <div data-tauri-drag-region className="flex-1 h-full flex items-center justify-between px-4">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="text-white font-terminal"
              style={{
                fontSize: 'var(--tmnl-text-xl, 20px)',
                letterSpacing: '0.08em',
              }}
            >
              TMNL
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {navTabs.map((tab) => (
              <button
                data-tauri-drag-region="false"
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`font-nav uppercase tracking-wide transition-colors ${
                  activeTab === tab
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
      </div>
    </div>
  )
}

export default HeaderContent
