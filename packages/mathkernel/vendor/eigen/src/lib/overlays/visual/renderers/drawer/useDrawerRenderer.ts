/**
 * useDrawerRenderer Hook
 *
 * Base hook for drawer rendering logic. Encapsulates:
 * - Overlay state subscription
 * - Escape key handling
 * - Animation state transitions
 * - Backdrop click handling
 *
 * Directional renderers compose this hook with their specific
 * animation variants and positioning styles.
 *
 * @module
 */

import { useEffect, useCallback } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../../providers"
import {
  overlayAtom,
  getContent,
  isSuppressedAtom,
} from "../../../atoms"
import type { VisualOverlayId, DrawerConfig } from "../../../schemas/visual"
import type { UseDrawerRendererReturn } from "./types"

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useDrawerRenderer(
  id: VisualOverlayId,
  onCloseRequest?: () => void
): UseDrawerRendererReturn {
  const ctx = useVisualOverlaySafe()
  const overlay = useAtomValue(overlayAtom(id))
  const isSuppressed = useAtomValue(isSuppressedAtom({ type: "drawer", id }))

  // ─── Escape Key Handler ─────────────────────────────────────
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

  // ─── Animation Complete Handler ─────────────────────────────
  const handleAnimationComplete = useCallback(
    (definition: string) => {
      if (!ctx || !overlay) return

      if (definition === "visible" && overlay.animationState === "entering") {
        ctx.setAnimationState(id, "visible")
      }
      if (definition === "hidden" && overlay.animationState === "exiting") {
        ctx.setAnimationState(id, "exited")
      }
    },
    [ctx, overlay, id]
  )

  // ─── Backdrop Click Handler ─────────────────────────────────
  const handleBackdropClick = useCallback(() => {
    if (!overlay) return
    const config = overlay.config as DrawerConfig
    if (config.closeOnOverlayClick) {
      onCloseRequest?.()
    }
  }, [overlay, onCloseRequest])

  // ─── Early Returns ──────────────────────────────────────────
  if (!overlay || isSuppressed) {
    return {
      shouldRender: false,
      config: null,
      content: null,
      isVisible: false,
      handleAnimationComplete,
      handleBackdropClick,
    }
  }

  const config = overlay.config as DrawerConfig
  const content = getContent(overlay.contentKey)
  const isVisible =
    overlay.animationState === "visible" ||
    overlay.animationState === "entering"

  return {
    shouldRender: true,
    config,
    content,
    isVisible,
    handleAnimationComplete,
    handleBackdropClick,
  }
}
