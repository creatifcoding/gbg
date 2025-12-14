/**
 * Sidebar Renderer (Stub)
 *
 * Placeholder for future sidebar overlay implementation.
 * Will render navigation sidebars with collapse/expand animations.
 *
 * @module
 */

import { useEffect, useRef } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlayAtom,
  getContent,
  isSuppressedAtom,
} from "../../atoms"
import { getAnimationDuration, getAnimationEasing } from "../constants"
import type { VisualOverlayId, SidebarConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const sidebarContainerStyles = (
  side: "left" | "right",
  width: number,
  collapsedWidth: number,
  collapsed: boolean,
  visible: boolean
): React.CSSProperties => ({
  position: "fixed",
  top: 0,
  bottom: 0,
  [side]: 0,
  width: `${collapsed ? collapsedWidth : width}px`,
  backgroundColor: "var(--tmnl-bg-surface, #1a1a1a)",
  borderRight: side === "left" ? "1px solid var(--tmnl-border, #333)" : undefined,
  borderLeft: side === "right" ? "1px solid var(--tmnl-border, #333)" : undefined,
  transform: visible ? "translateX(0)" : `translateX(${side === "left" ? "-100%" : "100%"})`,
  transition: `transform ${getAnimationDuration("sidebar")}ms ${getAnimationEasing("sidebar")}, width ${getAnimationDuration("sidebar")}ms ${getAnimationEasing("sidebar")}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  pointerEvents: visible ? "auto" : "none",
})

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function SidebarRenderer({ id }: SidebarRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id))

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "sidebar", id })
  )

  // Handle animation state transitions
  useEffect(() => {
    if (!ctx || !overlay) return

    if (overlay.animationState === "entering") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "visible")
      }, getAnimationDuration("sidebar"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("sidebar"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as SidebarConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  return (
    <div
      ref={containerRef}
      style={sidebarContainerStyles(
        config.side ?? "left",
        config.width ?? 240,
        config.collapsedWidth ?? 64,
        config.initiallyCollapsed ?? false,
        isVisible
      )}
      data-sidebar-id={id}
      role="navigation"
    >
      {content}
    </div>
  )
}

export default SidebarRenderer
