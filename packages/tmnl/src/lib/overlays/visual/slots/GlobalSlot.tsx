/**
 * Global Slot Component
 *
 * Full-viewport slot for global overlays (modal, toast, command-palette, top-bar).
 * Mount at app root to enable visual overlay rendering.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <VisualOverlayProvider>
 *       <GlobalSlot />
 *       <RouterProvider router={router} />
 *     </VisualOverlayProvider>
 *   )
 * }
 * ```
 *
 * @module
 */

import { useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlaysByTypeAtom,
  visualOverlaysAtom,
  getContent,
} from "../../atoms"
import { GLOBAL_SLOT_ID, GLOBAL_ONLY_TYPES } from "../constants"
import type { VisualOverlayInstance, VisualOverlayType, VisualOverlayId } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const containerStyles: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 1, // Base, individual overlays have their own z-index
}

const overlayWrapperStyles = (zIndex: number, pointerEvents: boolean): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  zIndex,
  pointerEvents: pointerEvents ? "auto" : "none",
})

// ─────────────────────────────────────────────────────────────
// Overlay Wrapper (renders individual overlay)
// ─────────────────────────────────────────────────────────────

interface OverlayWrapperProps {
  overlay: VisualOverlayInstance
  onAnimationEnd?: (id: string, state: "visible" | "exited") => void
}

function OverlayWrapper({ overlay, onAnimationEnd }: OverlayWrapperProps) {
  const content = getContent(overlay.contentKey)

  // Call animation callbacks when entering/exiting
  useEffect(() => {
    if (overlay.animationState === "entering") {
      // Small delay to allow mount, then mark visible
      const timer = setTimeout(() => {
        onAnimationEnd?.(overlay.id, "visible")
      }, 50) // Animation timing handled by renderers
      return () => clearTimeout(timer)
    }
  }, [overlay.animationState, overlay.id, onAnimationEnd])

  if (!content) return null

  // Determine if this overlay type needs pointer events
  const needsPointerEvents = overlay.isVisible

  return (
    <div
      style={overlayWrapperStyles(overlay.zIndex, needsPointerEvents)}
      data-overlay-id={overlay.id}
      data-overlay-type={overlay.type}
      data-overlay-state={overlay.animationState}
    >
      {content}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Type Layer (renders all overlays of a type)
// ─────────────────────────────────────────────────────────────

interface TypeLayerProps {
  type: VisualOverlayType
  onAnimationEnd?: (id: string, state: "visible" | "exited") => void
}

function TypeLayer({ type, onAnimationEnd }: TypeLayerProps) {
  const overlays = useAtomValue(overlaysByTypeAtom(type))

  if (overlays.length === 0) return null

  return (
    <>
      {overlays.map((overlay) => (
        <OverlayWrapper
          key={overlay.id}
          overlay={overlay}
          onAnimationEnd={onAnimationEnd}
        />
      ))}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Global Slot Component
// ─────────────────────────────────────────────────────────────

export interface GlobalSlotProps {
  /** Custom container ID for testing */
  containerId?: string
}

/**
 * GlobalSlot
 *
 * Renders all global-only overlay types (modal, toast, command-palette, top-bar).
 * Position at app root, outside router but inside VisualOverlayProvider.
 */
export function GlobalSlot({ containerId = "tmnl-global-slot" }: GlobalSlotProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)
  const allOverlays = useAtomValue(visualOverlaysAtom)

  // Register slot on mount
  useEffect(() => {
    if (!ctx || !containerRef.current) return

    ctx.registerSlot(GLOBAL_SLOT_ID, containerId)

    return () => {
      ctx.unregisterSlot(GLOBAL_SLOT_ID)
    }
  }, [ctx, containerId])

  // Animation end handler
  const handleAnimationEnd = (id: string, state: "visible" | "exited") => {
    if (!ctx) return
    ctx.setAnimationState(id as any, state)
  }

  // Check if any overlay is visible (for pointer events)
  const hasVisibleOverlays = Array.from(allOverlays.values()).some(
    (o) => GLOBAL_ONLY_TYPES.includes(o.type as any) && o.isVisible
  )

  return (
    <div
      ref={containerRef}
      id={containerId}
      style={{
        ...containerStyles,
        pointerEvents: hasVisibleOverlays ? "auto" : "none",
      }}
      data-overlay-slot="global"
    >
      {/* Render each global overlay type in z-order */}
      <TypeLayer type="sidebar" onAnimationEnd={handleAnimationEnd} />
      <TypeLayer type="top-bar" onAnimationEnd={handleAnimationEnd} />
      <TypeLayer type="drawer" onAnimationEnd={handleAnimationEnd} />
      <TypeLayer type="toast" onAnimationEnd={handleAnimationEnd} />
      <TypeLayer type="modal" onAnimationEnd={handleAnimationEnd} />
      <TypeLayer type="command-palette" onAnimationEnd={handleAnimationEnd} />
    </div>
  )
}

export default GlobalSlot
