/**
 * Command Palette Renderer
 *
 * Renders command palette overlay with fade/scale animations.
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
import { getAnimationDuration, getAnimationEasing, BACKDROP_COLOR } from "../constants"
import type { VisualOverlayId, CommandPaletteConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CommandPaletteRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const backdropStyles = (visible: boolean): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  opacity: visible ? 1 : 0,
  transition: `opacity ${getAnimationDuration("command-palette")}ms ${getAnimationEasing("command-palette")}`,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  paddingTop: "15vh",
})

const paletteContainerStyles = (visible: boolean): React.CSSProperties => ({
  position: "relative",
  width: "100%",
  maxWidth: "600px",
  backgroundColor: "var(--tmnl-bg-surface, #1a1a1a)",
  borderRadius: "12px",
  border: "1px solid var(--tmnl-border, #333)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  transform: visible ? "scale(1) translateY(0)" : "scale(0.98) translateY(-10px)",
  opacity: visible ? 1 : 0,
  transition: `transform ${getAnimationDuration("command-palette")}ms ${getAnimationEasing("command-palette")}, opacity ${getAnimationDuration("command-palette")}ms ${getAnimationEasing("command-palette")}`,
  overflow: "hidden",
})

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CommandPaletteRenderer({ id, onCloseRequest }: CommandPaletteRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id))

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "command-palette", id })
  )

  // Handle escape key
  useEffect(() => {
    if (!overlay || !overlay.isVisible) return

    const config = overlay.config as CommandPaletteConfig
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
      }, getAnimationDuration("command-palette"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("command-palette"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as CommandPaletteConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCloseRequest?.()
    }
  }

  return (
    <div
      ref={containerRef}
      style={backdropStyles(isVisible)}
      onClick={handleBackdropClick}
      data-command-palette-id={id}
      role="presentation"
    >
      <div
        style={paletteContainerStyles(isVisible)}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}

export default CommandPaletteRenderer
