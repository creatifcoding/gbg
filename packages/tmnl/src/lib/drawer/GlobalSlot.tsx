/**
 * Global Slot Component
 *
 * Full-viewport drawer slot for app-wide overlays.
 * Renders above all FloatingPanels.
 *
 * @module
 */

import { useRef, useEffect } from 'react'
import { useDrawerStack } from './DrawerStackContext'
import { DrawerRenderer } from './Drawer'

// =============================================================================
// GLOBAL SLOT
// =============================================================================

const SLOT_ID = 'global' as const

const containerStyles: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 9999, // Below drawer base z-index, container just for reference
}

export function GlobalSlot() {
  const { registerSlot, unregisterSlot, getDrawersForSlot } = useDrawerStack()
  const containerRef = useRef<HTMLDivElement>(null)

  // Register slot on mount
  useEffect(() => {
    if (containerRef.current) {
      registerSlot({
        id: SLOT_ID,
        containerRef: containerRef as React.RefObject<HTMLDivElement>,
      })
    }

    return () => {
      unregisterSlot(SLOT_ID)
    }
  }, [registerSlot, unregisterSlot])

  const drawers = getDrawersForSlot(SLOT_ID)
  const hasDrawers = drawers.length > 0

  return (
    <div
      ref={containerRef}
      style={{
        ...containerStyles,
        // Enable pointer events only when drawers are present
        pointerEvents: hasDrawers ? 'auto' : 'none',
      }}
      data-drawer-slot="global"
    >
      {containerRef.current && (
        <DrawerRenderer slotId={SLOT_ID} container={containerRef.current} />
      )}
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SLOT_ID as GLOBAL_SLOT_ID }
