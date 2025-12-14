/**
 * Drawer Renderer
 *
 * Renders drawer overlay content with slide animations.
 *
 * @module
 */

import { useEffect, useRef } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlayRegistry,
  overlayAtom,
  getContent,
  isSuppressedAtom,
} from "../../atoms"
import { getAnimationDuration, getAnimationEasing, BACKDROP_COLOR } from "../constants"
import type { VisualOverlayId, DrawerConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DrawerRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested (backdrop click, escape) */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const backdropStyles = (visible: boolean): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: BACKDROP_COLOR,
  opacity: visible ? 1 : 0,
  transition: `opacity ${getAnimationDuration("drawer")}ms ${getAnimationEasing("drawer")}`,
  pointerEvents: visible ? "auto" : "none",
})

const drawerContainerStyles = (
  side: "left" | "right",
  width: number,
  visible: boolean
): React.CSSProperties => ({
  position: "absolute",
  // Position below header (48px)
  top: "var(--tmnl-size-header, 48px)",
  bottom: 0,
  [side]: 0,
  width: `${width}px`,
  transform: visible ? "translateX(0)" : `translateX(${side === "left" ? "-100%" : "100%"})`,
  transition: `transform ${getAnimationDuration("drawer")}ms ${getAnimationEasing("drawer")}`,
  // Match old drawer styling
  backgroundColor: "#000",
  borderLeft: side === "right" ? "1px solid rgb(38, 38, 38)" : undefined,
  borderRight: side === "left" ? "1px solid rgb(38, 38, 38)" : undefined,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
})

const contentStyles: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function DrawerRenderer({ id, onCloseRequest }: DrawerRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id), {
    registry: overlayRegistry,
  })

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "drawer", id }),
    { registry: overlayRegistry }
  )

  // Handle escape key
  useEffect(() => {
    if (!overlay || !overlay.isVisible) return

    const config = overlay.config as DrawerConfig
    if (!config.closeOnEscape) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRequest?.()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [overlay, onCloseRequest])

  // Handle animation state transitions
  useEffect(() => {
    if (!ctx || !overlay) return

    if (overlay.animationState === "entering") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "visible")
      }, getAnimationDuration("drawer"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("drawer"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as DrawerConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  const handleBackdropClick = () => {
    if (config.closeOnBackdropClick) {
      onCloseRequest?.()
    }
  }

  return (
    <div ref={containerRef} data-drawer-id={id}>
      {/* Backdrop */}
      {config.showBackdrop && (
        <div
          style={backdropStyles(isVisible)}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        style={drawerContainerStyles(config.side ?? "right", config.width ?? 400, isVisible)}
        role="dialog"
        aria-modal="true"
      >
        <div style={contentStyles}>{content}</div>
      </div>
    </div>
  )
}

export default DrawerRenderer
