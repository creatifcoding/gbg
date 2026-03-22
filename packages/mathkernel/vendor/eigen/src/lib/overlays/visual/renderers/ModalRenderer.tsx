/**
 * Modal Renderer
 *
 * Renders modal overlay content with fade/scale animations.
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
import type { VisualOverlayId, ModalConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ModalRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Size presets
// ─────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-full mx-4",
} as const

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const backdropStyles = (visible: boolean): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: BACKDROP_COLOR,
  opacity: visible ? 1 : 0,
  transition: `opacity ${getAnimationDuration("modal")}ms ${getAnimationEasing("modal")}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
})

const modalContainerStyles = (visible: boolean): React.CSSProperties => ({
  position: "relative",
  backgroundColor: "var(--tmnl-bg-surface, #1a1a1a)",
  borderRadius: "8px",
  border: "1px solid var(--tmnl-border, #333)",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  transform: visible ? "scale(1)" : "scale(0.95)",
  opacity: visible ? 1 : 0,
  transition: `transform ${getAnimationDuration("modal")}ms ${getAnimationEasing("modal")}, opacity ${getAnimationDuration("modal")}ms ${getAnimationEasing("modal")}`,
  maxHeight: "90vh",
  overflow: "auto",
})

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ModalRenderer({ id, onCloseRequest }: ModalRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id))

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "modal", id })
  )

  // Handle escape key
  useEffect(() => {
    if (!overlay || !overlay.isVisible) return

    const config = overlay.config as ModalConfig
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
      }, getAnimationDuration("modal"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("modal"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as ModalConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && config.closeOnBackdropClick) {
      onCloseRequest?.()
    }
  }

  return (
    <div
      ref={containerRef}
      style={backdropStyles(isVisible)}
      onClick={handleBackdropClick}
      data-modal-id={id}
      role="presentation"
    >
      <div
        style={modalContainerStyles(isVisible)}
        className={`w-full ${SIZE_MAP[config.size ?? "md"]}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}

export default ModalRenderer
