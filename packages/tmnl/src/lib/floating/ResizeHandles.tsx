/**
 * Resize Handles Component
 *
 * 8 invisible handles (4 edges + 4 corners) for panel resize.
 * 
 * Performance model:
 * - pointermove writes directly to stx (single source of truth)
 * - FloatingPanel reads dimensions/position from stx selectors
 * - no secondary transform/position state
 *
 * @module
 */

import { useCallback, useRef, useEffect, memo } from 'react'
import { batch } from '@/lib/stx'
import {
  getFloatingStx,
  setResizing,
  updateModifierKeys,
  bringPanelToFront,
  updatePanelDimensions,
  updatePanelPosition,
} from './floating-stx'
import { getBounds, clampResize } from './context/FloatingBoundsContext'
import type { ResizeEdge, Dimensions, Position } from './types'

// =============================================================================
// Types
// =============================================================================

interface ResizeHandlesProps {
  panelId: string
  dimensions: Dimensions
  position: Position
  disabled?: boolean
  onResizeStart?: (edge: ResizeEdge) => void
  onResizeEnd?: (dimensions: Dimensions, position: Position) => void
}

interface ResizeState {
  edge: ResizeEdge
  initialDimensions: Dimensions
  initialPosition: Position
  initialPointer: Position
}

// =============================================================================
// Handle Configuration
// =============================================================================

interface HandleConfig {
  edge: ResizeEdge
  cursor: string
  style: React.CSSProperties
}

const EDGE_THICKNESS = 6
const CORNER_SIZE = 16
const EDGE_INSET = 4

const HANDLES: HandleConfig[] = [
  { edge: 'n', cursor: 'ns-resize', style: { top: -EDGE_INSET, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 's', cursor: 'ns-resize', style: { bottom: -EDGE_INSET, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'e', cursor: 'ew-resize', style: { right: -EDGE_INSET, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'w', cursor: 'ew-resize', style: { left: -EDGE_INSET, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'nw', cursor: 'nwse-resize', style: { top: -EDGE_INSET, left: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'ne', cursor: 'nesw-resize', style: { top: -EDGE_INSET, right: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'sw', cursor: 'nesw-resize', style: { bottom: -EDGE_INSET, left: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'se', cursor: 'nwse-resize', style: { bottom: -EDGE_INSET, right: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
]

// =============================================================================
// Resize Math (pure function, no side effects)
// =============================================================================

function calculateResize(
  state: ResizeState,
  currentPointer: Position,
  sensitivity: number
): { dimensions: Dimensions; position: Position } {
  const deltaX = (currentPointer.x - state.initialPointer.x) * sensitivity
  const deltaY = (currentPointer.y - state.initialPointer.y) * sensitivity

  let width = state.initialDimensions.width
  let height = state.initialDimensions.height
  let x = state.initialPosition.x
  let y = state.initialPosition.y

  if (state.edge.includes('e')) width = state.initialDimensions.width + deltaX
  if (state.edge.includes('w')) {
    const newWidth = state.initialDimensions.width - deltaX
    if (newWidth >= 100) { width = newWidth; x = state.initialPosition.x + deltaX }
  }
  if (state.edge.includes('s')) height = state.initialDimensions.height + deltaY
  if (state.edge.includes('n')) {
    const newHeight = state.initialDimensions.height - deltaY
    if (newHeight >= 100) { height = newHeight; y = state.initialPosition.y + deltaY }
  }

  return {
    dimensions: { width: Math.max(100, width), height: Math.max(100, height) },
    position: { x, y },
  }
}

// =============================================================================
// Component
// =============================================================================

export const ResizeHandles = memo(function ResizeHandles({
  panelId,
  dimensions,
  position,
  disabled = false,
  onResizeStart,
  onResizeEnd,
}: ResizeHandlesProps) {
  const resizeStateRef = useRef<ResizeState | null>(null)
  const lastResultRef = useRef<{ dimensions: Dimensions; position: Position } | null>(null)

  // Global modifier key tracking
  useEffect(() => {
    const handleKeyChange = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      updateModifierKeys({ shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey })
    }
    window.addEventListener('keydown', handleKeyChange)
    window.addEventListener('keyup', handleKeyChange)
    return () => {
      window.removeEventListener('keydown', handleKeyChange)
      window.removeEventListener('keyup', handleKeyChange)
    }
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, edge: ResizeEdge) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()

      bringPanelToFront(panelId)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      resizeStateRef.current = {
        edge,
        initialDimensions: { ...dimensions },
        initialPosition: { ...position },
        initialPointer: { x: e.clientX, y: e.clientY },
      }
      lastResultRef.current = null

      setResizing(panelId, true)
      onResizeStart?.(edge)
    },
    [panelId, dimensions, position, disabled, onResizeStart]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      // Read modifier keys without subscribing
      const mods = getFloatingStx().data.modifierKeys.peek()
      const sensitivity = (mods.ctrl && mods.shift) ? 0.01 : mods.shift ? 0.1 : 1.0

      let result = calculateResize(state, { x: e.clientX, y: e.clientY }, sensitivity)

      // Clamp within bounds
      const bounds = getBounds()
      if (bounds) {
        const clamped = clampResize(result.position, result.dimensions, { width: 100, height: 100 }, bounds)
        result = { dimensions: clamped.dimensions, position: clamped.position }
      }

      // Single source of truth: write resize preview directly to stx
      batch(() => {
        updatePanelDimensions(panelId, result.dimensions)
        updatePanelPosition(panelId, result.position)
      })

      lastResultRef.current = result
    },
    [panelId]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeStateRef.current) return

      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Optional completion callback with final stx-backed values
      const final = lastResultRef.current
      if (final) {
        onResizeEnd?.(final.dimensions, final.position)
      }

      setResizing(panelId, false)
      resizeStateRef.current = null
      lastResultRef.current = null
    },
    [panelId, onResizeEnd]
  )

  if (disabled) return null

  const isCorner = (edge: ResizeEdge) => edge.length === 2

  return (
    <>
      {HANDLES.map((handle) => (
        <div
          key={handle.edge}
          data-resize-handle={handle.edge}
          onPointerDown={(e) => handlePointerDown(e, handle.edge)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'absolute',
            cursor: handle.cursor,
            zIndex: isCorner(handle.edge) ? 12 : 10,
            touchAction: 'none',
            pointerEvents: 'auto',
            ...handle.style,
          }}
        />
      ))}
    </>
  )
})

export default ResizeHandles
