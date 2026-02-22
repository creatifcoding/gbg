/**
 * EdgeDropZone — overlay zones that appear during floating panel drag
 *
 * When a floating panel is being dragged, edge drop zones appear at
 * the workspace edges. Uses elementsFromPoint hit testing (SM §7.2)
 * since dnd-kit captures pointer events during active drag.
 *
 * SM reference: §7.1 Drop Zone Types, §7.2 Hit Testing, §7.3 Edge Highlight Rendering
 *
 * @module
 */

import { memo, useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import type { DockEdge } from '../types'
import { PANEL } from '../tokens'

// =============================================================================
// Constants
// =============================================================================

/** Zone activation area in px */
const ZONE_SIZE = 48
/** Active zone highlight */
const ACTIVE_BG = 'rgba(34, 197, 94, 0.12)'
/** Active border highlight */
const ACTIVE_BORDER_COLOR = 'rgba(34, 197, 94, 0.4)'
/** How often to run hit testing during drag (ms) */
const HIT_TEST_INTERVAL = 50

// =============================================================================
// Props
// =============================================================================

export interface EdgeDropZoneProps {
  /** Which edge this zone occupies */
  edge: DockEdge
  /** Whether this zone is currently active (pointer over it) */
  isActive: boolean
}

export interface EdgeDropZoneOverlayProps {
  /** Called when a panel is dropped on an edge */
  onDock: (edge: DockEdge) => void
}

// =============================================================================
// Single Edge Zone (visual only — hit testing is in overlay)
// =============================================================================

const EdgeZone = memo(function EdgeZone({ edge, isActive }: EdgeDropZoneProps) {
  const borderSide = edge === 'left' ? 'borderRight'
    : edge === 'right' ? 'borderLeft'
    : edge === 'top' ? 'borderBottom'
    : 'borderTop'

  const style: CSSProperties = {
    position: 'absolute',
    zIndex: 9999,
    background: isActive ? ACTIVE_BG : 'transparent',
    transition: 'background 100ms ease-out',
    pointerEvents: 'none', // Hit testing is done via elementsFromPoint
    [borderSide]: isActive ? `2px solid ${ACTIVE_BORDER_COLOR}` : 'none',
    // Position based on edge
    ...(edge === 'left' && { top: 0, left: 0, bottom: 0, width: ZONE_SIZE }),
    ...(edge === 'right' && { top: 0, right: 0, bottom: 0, width: ZONE_SIZE }),
    ...(edge === 'top' && { top: 0, left: ZONE_SIZE, right: ZONE_SIZE, height: ZONE_SIZE }),
    ...(edge === 'bottom' && { bottom: 0, left: ZONE_SIZE, right: ZONE_SIZE, height: ZONE_SIZE }),
  }

  return <div data-inner-edge-dropzone={edge} style={style} />
})

// =============================================================================
// EdgeDropZoneOverlay — elementsFromPoint hit testing (SM §7.2)
// =============================================================================

export const EdgeDropZoneOverlay = memo(function EdgeDropZoneOverlay({
  onDock,
}: EdgeDropZoneOverlayProps) {
  const draggingId = useSelector(() => getFloatingStx().data.draggingPanel.get())
  const [activeEdge, setActiveEdge] = useState<DockEdge | null>(null)
  const activeEdgeRef = useRef<DockEdge | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep ref in sync for cleanup callback
  activeEdgeRef.current = activeEdge

  // elementsFromPoint hit testing during drag
  useEffect(() => {
    if (!draggingId) {
      setActiveEdge(null)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const hitTest = (e: PointerEvent) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY)
      let found: DockEdge | null = null

      for (const el of elements) {
        const zone = (el as HTMLElement).dataset?.innerEdgeDropzone as DockEdge | undefined
        if (zone) {
          found = zone
          break
        }
      }

      setActiveEdge(found)
    }

    // Listen to pointermove during drag for real-time hit testing
    document.addEventListener('pointermove', hitTest, { passive: true })

    return () => {
      document.removeEventListener('pointermove', hitTest)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [draggingId])

  // On drag end: if we're over an edge zone, dock
  useEffect(() => {
    if (!draggingId) {
      // Drag just ended — check if we were over a zone
      if (activeEdgeRef.current) {
        // Small delay to let dnd-kit finish its cleanup
        const edge = activeEdgeRef.current
        requestAnimationFrame(() => {
          // Only dock if there's a valid panel that was being dragged
          // (the draggingId was just cleared, so we use the ref)
        })
      }
      return
    }

    const handlePointerUp = () => {
      if (activeEdgeRef.current && draggingId) {
        onDock(activeEdgeRef.current)
        setActiveEdge(null)
      }
    }

    document.addEventListener('pointerup', handlePointerUp)
    return () => document.removeEventListener('pointerup', handlePointerUp)
  }, [draggingId, onDock])

  if (!draggingId) return null

  return (
    <div
      data-edge-drop-overlay
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    >
      <EdgeZone edge="left" isActive={activeEdge === 'left'} />
      <EdgeZone edge="right" isActive={activeEdge === 'right'} />
      <EdgeZone edge="top" isActive={activeEdge === 'top'} />
      <EdgeZone edge="bottom" isActive={activeEdge === 'bottom'} />
    </div>
  )
})
