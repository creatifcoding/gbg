/**
 * Toast Renderer
 *
 * Renders toast notification with slide/fade animations.
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
import { getAnimationDuration, getAnimationEasing } from "../constants"
import type { VisualOverlayId, ToastConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ToastRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
  /** Callback when close requested */
  onCloseRequest?: () => void
}

// ─────────────────────────────────────────────────────────────
// Position styles
// ─────────────────────────────────────────────────────────────

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  "top-left": { top: 16, left: 16 },
  "top-center": { top: 16, left: "50%", transform: "translateX(-50%)" },
  "top-right": { top: 16, right: 16 },
  "bottom-left": { bottom: 16, left: 16 },
  "bottom-center": { bottom: 16, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 16, right: 16 },
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  info: { borderLeft: "4px solid var(--tmnl-info, #3b82f6)" },
  success: { borderLeft: "4px solid var(--tmnl-success, #22c55e)" },
  warning: { borderLeft: "4px solid var(--tmnl-warning, #f59e0b)" },
  error: { borderLeft: "4px solid var(--tmnl-error, #ef4444)" },
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const toastContainerStyles = (
  position: string,
  variant: string,
  visible: boolean
): React.CSSProperties => ({
  position: "fixed",
  ...POSITION_STYLES[position],
  backgroundColor: "var(--tmnl-bg-surface, #1a1a1a)",
  borderRadius: "6px",
  border: "1px solid var(--tmnl-border, #333)",
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
  padding: "12px 16px",
  minWidth: "280px",
  maxWidth: "400px",
  opacity: visible ? 1 : 0,
  transform: visible
    ? POSITION_STYLES[position].transform ?? "translateY(0)"
    : position.startsWith("top")
    ? "translateY(-20px)"
    : "translateY(20px)",
  transition: `opacity ${getAnimationDuration("toast")}ms ${getAnimationEasing("toast")}, transform ${getAnimationDuration("toast")}ms ${getAnimationEasing("toast")}`,
  pointerEvents: visible ? "auto" : "none",
  ...VARIANT_STYLES[variant],
})

const closeButtonStyles: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  background: "none",
  border: "none",
  color: "var(--tmnl-text-muted, #666)",
  cursor: "pointer",
  padding: 4,
  lineHeight: 1,
  fontSize: 16,
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ToastRenderer({ id, onCloseRequest }: ToastRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id), {
    registry: overlayRegistry,
  })

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "toast", id }),
    { registry: overlayRegistry }
  )

  // Handle animation state transitions
  useEffect(() => {
    if (!ctx || !overlay) return

    if (overlay.animationState === "entering") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "visible")
      }, getAnimationDuration("toast"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("toast"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as ToastConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  return (
    <div
      ref={containerRef}
      style={toastContainerStyles(
        config.position ?? "bottom-right",
        config.variant ?? "info",
        isVisible
      )}
      data-toast-id={id}
      role="alert"
      aria-live="polite"
    >
      {config.dismissible && (
        <button
          style={closeButtonStyles}
          onClick={() => onCloseRequest?.()}
          aria-label="Close notification"
        >
          ×
        </button>
      )}
      <div style={{ paddingRight: config.dismissible ? 24 : 0 }}>{content}</div>
    </div>
  )
}

export default ToastRenderer
