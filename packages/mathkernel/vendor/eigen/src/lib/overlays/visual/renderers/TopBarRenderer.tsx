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

/**
 * Top bar is a **sibling element** in DOM flow, not fixed/portaled.
 * Uses sticky positioning so it stays at top when scrolling.
 *
 * Pattern derived from:
 * - DataManagerTestbed.tsx:737-769 (sticky header)
 * - src/components/ui/header.tsx (h-14 flex layout)
 * - testbed/shared/primitives.tsx (TestbedHeader)
 */
const topBarContainerStyles = (
  height: number,
  visible: boolean,
  zIndex: number
): React.CSSProperties => ({
  position: "sticky",
  top: 0,
  height: `${height}px`,
  zIndex,
  // Visibility via opacity + transform for animation
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : "translateY(-100%)",
  transition: `opacity ${getAnimationDuration("top-bar")}ms ${getAnimationEasing("top-bar")}, transform ${getAnimationDuration("top-bar")}ms ${getAnimationEasing("top-bar")}`,
  pointerEvents: visible ? "auto" : "none",
})

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function TopBarRenderer({ id }: TopBarRendererProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  const overlay = useAtomValue(overlayAtom(id))
  const isSuppressed = useAtomValue(isSuppressedAtom({ type: "top-bar", id }))

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
    <header
      ref={containerRef}
      className="flex items-center border-b border-neutral-800 bg-black flex-shrink-0"
      style={topBarContainerStyles(config.height ?? 48, shouldShow, overlay.zIndex)}
      data-top-bar-id={id}
      role="banner"
    >
      {content}
    </header>
  )
}

export default TopBarRenderer
