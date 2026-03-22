/**
 * DrawerSlotContent
 *
 * Renders registered slot content for a drawer, or fallback if none.
 * Uses the drawer slot registry for injection pattern.
 *
 * @module
 */

import { useSyncExternalStore, useCallback } from "react"
import { PanelLeft, PanelRight } from "lucide-react"
import {
  getDrawerSlotContent,
  hasDrawerSlotContent,
} from "../../atoms/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DrawerSlotContentProps {
  /** Drawer ID to check for registered content */
  drawerId: string
  /** Side of drawer (for fallback display) */
  side: "left" | "right"
}

// ─────────────────────────────────────────────────────────────
// Subscription for external store (drawer slot registry)
// ─────────────────────────────────────────────────────────────

// Listeners for registry changes
const listeners = new Set<() => void>()

/**
 * Notify all subscribers of registry changes.
 * Call this after registerDrawerSlot/unregisterDrawerSlot.
 */
export const notifyDrawerSlotChange = (): void => {
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ─────────────────────────────────────────────────────────────
// Empty Drawer Fallback
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
        No content registered
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * Drawer content that checks slot registry for injected content.
 *
 * @example
 * ```tsx
 * // In PersistentOverlays
 * drawer.toggle(
 *   { id: "settings", side: "right" },
 *   <DrawerSlotContent drawerId="settings" side="right" />
 * )
 *
 * // Elsewhere in app
 * registerDrawerSlot("settings", <SettingsPanel />)
 * ```
 */
export function DrawerSlotContent({ drawerId, side }: DrawerSlotContentProps) {
  // Subscribe to registry changes
  const getSnapshot = useCallback(() => {
    return hasDrawerSlotContent(drawerId) ? drawerId : null
  }, [drawerId])

  const hasContent = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Get content if registered
  const content = hasContent ? getDrawerSlotContent(drawerId) : null

  return content ? <>{content}</> : <EmptyDrawerContent side={side} />
}

export default DrawerSlotContent
