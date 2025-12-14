/**
 * Panel Slot Component
 *
 * Panel-scoped slot for drawer and sidebar overlays.
 * Use to render overlays within a specific panel's bounds.
 *
 * @example
 * ```tsx
 * function EditorPanel() {
 *   return (
 *     <div className="relative h-full">
 *       <PanelSlot slotId="editor-panel" />
 *       <Editor />
 *     </div>
 *   )
 * }
 *
 * // Then open drawer scoped to this panel:
 * drawer.open({ slot: "editor-panel", side: "right" }, <PropertiesPanel />)
 * ```
 *
 * @module
 */

import { useRef, useEffect, useCallback } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import {
  overlayRegistry,
  overlaysBySlotAtom,
  getContent,
} from "../../atoms"
import { isReservedSlotId } from "../constants"
import type { SlotId, VisualOverlayInstance } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const containerStyles: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
}

const overlayWrapperStyles = (zIndex: number, pointerEvents: boolean): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  zIndex,
  pointerEvents: pointerEvents ? "auto" : "none",
})

// ─────────────────────────────────────────────────────────────
// Overlay Wrapper
// ─────────────────────────────────────────────────────────────

interface OverlayWrapperProps {
  overlay: VisualOverlayInstance
  onAnimationEnd?: (id: string, state: "visible" | "exited") => void
}

function OverlayWrapper({ overlay, onAnimationEnd }: OverlayWrapperProps) {
  const content = getContent(overlay.contentKey)

  useEffect(() => {
    if (overlay.animationState === "entering") {
      const timer = setTimeout(() => {
        onAnimationEnd?.(overlay.id, "visible")
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [overlay.animationState, overlay.id, onAnimationEnd])

  if (!content) return null

  return (
    <div
      style={overlayWrapperStyles(overlay.zIndex, overlay.isVisible)}
      data-overlay-id={overlay.id}
      data-overlay-type={overlay.type}
      data-overlay-state={overlay.animationState}
    >
      {content}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Panel Slot Component
// ─────────────────────────────────────────────────────────────

export interface PanelSlotProps {
  /** Unique slot identifier (cannot be "global") */
  slotId: SlotId
  /** Container ID for the panel */
  containerId?: string
  /** CSS class for the slot container */
  className?: string
}

/**
 * PanelSlot
 *
 * Renders overlays scoped to a specific panel (drawer, sidebar).
 * Tracks panel bounds via ResizeObserver for proper positioning.
 */
export function PanelSlot({
  slotId,
  containerId,
  className,
}: PanelSlotProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  // Validate slot ID
  if (isReservedSlotId(slotId)) {
    console.warn(`PanelSlot: "${slotId}" is a reserved slot ID. Use a different ID.`)
    return null
  }

  // Get overlays for this slot
  const overlays = useAtomValue(overlaysBySlotAtom(slotId), {
    registry: overlayRegistry,
  })

  // Update bounds on resize
  const updateBounds = useCallback(() => {
    if (!ctx || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    ctx.updateSlotBounds(slotId, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })
  }, [ctx, slotId])

  // Register slot and observe resize
  useEffect(() => {
    if (!ctx || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()

    // Register with initial bounds
    ctx.registerSlot(slotId, containerId ?? `panel-${slotId}`, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })

    // Observe resize
    const observer = new ResizeObserver(updateBounds)
    observer.observe(container)

    return () => {
      observer.disconnect()
      ctx.unregisterSlot(slotId)
    }
  }, [ctx, slotId, containerId, updateBounds])

  // Animation end handler
  const handleAnimationEnd = (id: string, state: "visible" | "exited") => {
    if (!ctx) return
    ctx.setAnimationState(id as any, state)
  }

  const hasVisibleOverlays = overlays.some((o) => o.isVisible)

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...containerStyles,
        pointerEvents: hasVisibleOverlays ? "auto" : "none",
      }}
      data-overlay-slot={slotId}
    >
      {overlays.map((overlay) => (
        <OverlayWrapper
          key={overlay.id}
          overlay={overlay}
          onAnimationEnd={handleAnimationEnd}
        />
      ))}
    </div>
  )
}

export default PanelSlot
