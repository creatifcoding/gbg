/**
 * Sidebar Renderer
 *
 * Renders sidebar overlays. Acts as a pass-through to content component
 * which handles its own positioning and styling.
 *
 * The sidebar content (from src/lib/sidebar) manages its own:
 * - Fixed positioning
 * - Collapsed/expanded state
 * - Items rendering
 *
 * This renderer tracks the overlay in the system for:
 * - Z-index management
 * - Suppression support
 * - Animation state
 *
 * @module
 */

import { useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlayAtom,
  getContent,
  isSuppressedAtom,
} from "../../atoms"
import { getAnimationDuration } from "../constants"
import type { VisualOverlayId } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarRendererProps {
  /** Overlay ID */
  id: VisualOverlayId
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

/**
 * SidebarRenderer
 *
 * Pass-through renderer that lets the content component handle
 * its own container and styling. This keeps the sidebar logic
 * encapsulated in src/lib/sidebar while integrating with the
 * overlay system for tracking and suppression.
 */
export function SidebarRenderer({ id }: SidebarRendererProps) {
  const ctx = useVisualOverlaySafe()
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

  // Pass-through: content handles its own rendering
  const content = getContent(overlay.contentKey)

  return <>{content}</>
}

export default SidebarRenderer
