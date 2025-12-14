/**
 * Top Bar Renderer
 *
 * Renders top bar overlay with slide animations.
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
import type { VisualOverlayId, TopBarConfig } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TopBarRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const topBarContainerStyles = (
  height: number,
  visible: boolean
): React.CSSProperties => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: `${height}px`,
  backgroundColor: "var(--tmnl-bg-surface, #1a1a1a)",
  borderBottom: "1px solid var(--tmnl-border, #333)",
  transform: visible ? "translateY(0)" : "translateY(-100%)",
  transition: `transform ${getAnimationDuration("top-bar")}ms ${getAnimationEasing("top-bar")}`,
  display: "flex",
  alignItems: "center",
  pointerEvents: visible ? "auto" : "none",
})

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function TopBarRenderer({ id }: TopBarRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id), {
    registry: overlayRegistry,
  })

  const isSuppressed = useAtomValue(
    isSuppressedAtom({ type: "top-bar", id }),
    { registry: overlayRegistry }
  )

  // Handle animation state transitions
  useEffect(() => {
    if (!ctx || !overlay) return

    if (overlay.animationState === "entering") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "visible")
      }, getAnimationDuration("top-bar"))
      return () => clearTimeout(timer)
    }

    if (overlay.animationState === "exiting") {
      const timer = setTimeout(() => {
        ctx.setAnimationState(id, "exited")
      }, getAnimationDuration("top-bar"))
      return () => clearTimeout(timer)
    }
  }, [ctx, id, overlay?.animationState])

  if (!overlay || isSuppressed) return null

  const config = overlay.config as TopBarConfig
  const content = getContent(overlay.contentKey)
  const isVisible = overlay.animationState === "visible" || overlay.animationState === "entering"

  // Check if initially visible
  const shouldShow = config.initiallyVisible !== false && isVisible

  return (
    <div
      ref={containerRef}
      style={topBarContainerStyles(config.height ?? 48, shouldShow)}
      data-top-bar-id={id}
      role="banner"
    >
      {content}
    </div>
  )
}

export default TopBarRenderer
