/**
 * Panel Slot Component
 *
 * Per-panel drawer slot for panel-scoped overlays.
 * Clips to panel bounds via overflow:hidden.
 *
 * @module
 */

import { useRef, useEffect } from 'react'
import { useDrawerStackSafe } from './DrawerStackContext'
import { DrawerRenderer } from './Drawer'

// =============================================================================
// PANEL SLOT
// =============================================================================

interface PanelSlotProps {
  /** Panel ID this slot belongs to */
  panelId: string
  /** Optional custom styles */
  style?: React.CSSProperties
  /** Optional class name */
  className?: string
}

const containerStyles: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'hidden', // Clip drawers to panel bounds
  zIndex: 100, // Above panel content, below other panels
}

export function PanelSlot({ panelId, style, className }: PanelSlotProps) {
  const context = useDrawerStackSafe()
  const containerRef = useRef<HTMLDivElement>(null)

  // Register slot on mount (only if provider exists)
  useEffect(() => {
    if (!context || !containerRef.current) return

    context.registerSlot({
      id: panelId,
      containerRef: containerRef as React.RefObject<HTMLDivElement>,
      bounds: containerRef.current.getBoundingClientRect(),
    })

    return () => {
      context.unregisterSlot(panelId)
    }
  }, [panelId, context])

  // Update bounds on resize (only if provider exists)
  useEffect(() => {
    if (!context || !containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        context.registerSlot({
          id: panelId,
          containerRef: containerRef as React.RefObject<HTMLDivElement>,
          bounds: entry.target.getBoundingClientRect(),
        })
      }
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [panelId, context])

  // No provider = no-op (gracefully render nothing)
  if (!context) {
    return null
  }

  const drawers = context.getDrawersForSlot(panelId)
  const hasDrawers = drawers.length > 0

  return (
    <div
      ref={containerRef}
      style={{
        ...containerStyles,
        ...style,
        // Enable pointer events only when drawers are present
        pointerEvents: hasDrawers ? 'auto' : 'none',
      }}
      className={className}
      data-drawer-slot={panelId}
    >
      {containerRef.current && (
        <DrawerRenderer slotId={panelId} container={containerRef.current} />
      )}
    </div>
  )
}
