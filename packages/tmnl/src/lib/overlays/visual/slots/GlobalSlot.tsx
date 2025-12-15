/**
 * Global Slot Component
 *
 * Full-viewport slot for global overlays (drawer, modal, toast, command-palette).
 * Mount at app root to enable visual overlay rendering.
 *
 * Uses proper renderers for each overlay type:
 * - DrawerRenderer for drawers (slide animations, backdrop)
 * - ModalRenderer for modals (centered, backdrop)
 * - etc.
 *
 * @module
 */

import { useRef, useEffect } from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import { useVisualOverlaySafe } from "../providers"
import { overlaysByTypeAtom } from "../../atoms"
import { GLOBAL_SLOT_ID } from "../constants"
import { DrawerRenderer } from "../renderers/DrawerRenderer"
import { ModalRenderer } from "../renderers/ModalRenderer"
import { ToastRenderer } from "../renderers/ToastRenderer"
import { CommandPaletteRenderer } from "../renderers/CommandPaletteRenderer"
import { SidebarRenderer } from "../renderers/SidebarRenderer"
import type { VisualOverlayInstance, VisualOverlayType } from "../../schemas/visual"

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const containerStyles: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 1000, // Above content, below overlays
}

// ─────────────────────────────────────────────────────────────
// Type Layer (renders all overlays of a type using proper renderer)
// ─────────────────────────────────────────────────────────────

interface TypeLayerProps {
  type: VisualOverlayType
  onCloseRequest?: (id: string) => void
}

function TypeLayer({ type, onCloseRequest }: TypeLayerProps) {
  const overlays = useAtomValue(overlaysByTypeAtom(type))

  if (overlays.length === 0) return null

  return (
    <>
      {overlays.map((overlay) => {
        // Use the appropriate renderer for each type
        switch (type) {
          case "drawer":
            return (
              <DrawerRenderer
                key={overlay.id}
                id={overlay.id}
                onCloseRequest={() => onCloseRequest?.(overlay.id)}
              />
            )
          case "modal":
            return (
              <ModalRenderer
                key={overlay.id}
                id={overlay.id}
                onCloseRequest={() => onCloseRequest?.(overlay.id)}
              />
            )
          case "toast":
            return (
              <ToastRenderer
                key={overlay.id}
                id={overlay.id}
                onDismiss={() => onCloseRequest?.(overlay.id)}
              />
            )
          case "command-palette":
            return (
              <CommandPaletteRenderer
                key={overlay.id}
                id={overlay.id}
                onCloseRequest={() => onCloseRequest?.(overlay.id)}
              />
            )
          case "sidebar":
            return (
              <SidebarRenderer
                key={overlay.id}
                id={overlay.id}
              />
            )
          default:
            // Fallback: render nothing for unhandled types
            return null
        }
      })}
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
 * Renders all global-only overlay types using proper renderers.
 * Position at app root, outside router but inside VisualOverlayProvider.
 */
export function GlobalSlot({ containerId = "tmnl-global-slot" }: GlobalSlotProps) {
  const ctx = useVisualOverlaySafe()
  const containerRef = useRef<HTMLDivElement>(null)

  // Register slot on mount
  useEffect(() => {
    if (!ctx || !containerRef.current) return

    ctx.registerSlot(GLOBAL_SLOT_ID, containerId)

    return () => {
      ctx.unregisterSlot(GLOBAL_SLOT_ID)
    }
  }, [ctx, containerId])

  // Close request handler
  const handleCloseRequest = (id: string) => {
    ctx?.close(id as any)
  }

  // GlobalSlot is ALWAYS pointer-events: none
  // Individual renderers handle their own pointer-events
  // This allows clicks to pass through to content behind

  return (
    <div
      ref={containerRef}
      id={containerId}
      style={containerStyles}
      data-overlay-slot="global"
    >
      {/* Render each global overlay type in z-order (low to high) */}
      <TypeLayer type="sidebar" onCloseRequest={handleCloseRequest} />
      <TypeLayer type="drawer" onCloseRequest={handleCloseRequest} />
      <TypeLayer type="toast" onCloseRequest={handleCloseRequest} />
      <TypeLayer type="modal" onCloseRequest={handleCloseRequest} />
      <TypeLayer type="command-palette" onCloseRequest={handleCloseRequest} />
    </div>
  )
}

export default GlobalSlot
