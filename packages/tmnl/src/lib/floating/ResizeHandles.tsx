/**
 * Resize Handles Component
 *
 * 8 invisible handles (4 edges + 4 corners) for panel resize.
 * Captures pointer events and integrates with stx for state.
 *
 * @pattern Pointer capture + stx integration
 * @module
 */

import { useCallback, useRef, useEffect } from 'react'
import {
  getFloatingStx,
  updatePanelDimensions,
  updatePanelPosition,
  setResizing,
  updateModifierKeys,
  bringPanelToFront,
} from './floating-stx'
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
  panelId: string
  edge: ResizeEdge
  initialDimensions: Dimensions
  initialPosition: Position
  initialPointer: Position
}

// =============================================================================
// Edge/Corner Configuration
// =============================================================================

interface HandleConfig {
  edge: ResizeEdge
  cursor: string
  style: React.CSSProperties
}

// Apple-style: generous hitboxes, corners get priority
const EDGE_THICKNESS = 6      // Edge handle thickness
const CORNER_SIZE = 16        // Corner hit area (larger for precision)
const EDGE_INSET = 4          // How far edge extends into panel

const HANDLES: HandleConfig[] = [
  // Edges - thin but generous hit area
  {
    edge: 'n',
    cursor: 'ns-resize',
    style: {
      top: -EDGE_INSET,
      left: CORNER_SIZE,
      right: CORNER_SIZE,
      height: EDGE_THICKNESS + EDGE_INSET,
    },
  },
  {
    edge: 's',
    cursor: 'ns-resize',
    style: {
      bottom: -EDGE_INSET,
      left: CORNER_SIZE,
      right: CORNER_SIZE,
      height: EDGE_THICKNESS + EDGE_INSET,
    },
  },
  {
    edge: 'e',
    cursor: 'ew-resize',
    style: {
      right: -EDGE_INSET,
      top: CORNER_SIZE,
      bottom: CORNER_SIZE,
      width: EDGE_THICKNESS + EDGE_INSET,
    },
  },
  {
    edge: 'w',
    cursor: 'ew-resize',
    style: {
      left: -EDGE_INSET,
      top: CORNER_SIZE,
      bottom: CORNER_SIZE,
      width: EDGE_THICKNESS + EDGE_INSET,
    },
  },
  // Corners - larger hit area, higher z-index for priority
  {
    edge: 'nw',
    cursor: 'nwse-resize',
    style: {
      top: -EDGE_INSET,
      left: -EDGE_INSET,
      width: CORNER_SIZE + EDGE_INSET,
      height: CORNER_SIZE + EDGE_INSET,
    },
  },
  {
    edge: 'ne',
    cursor: 'nesw-resize',
    style: {
      top: -EDGE_INSET,
      right: -EDGE_INSET,
      width: CORNER_SIZE + EDGE_INSET,
      height: CORNER_SIZE + EDGE_INSET,
    },
  },
  {
    edge: 'sw',
    cursor: 'nesw-resize',
    style: {
      bottom: -EDGE_INSET,
      left: -EDGE_INSET,
      width: CORNER_SIZE + EDGE_INSET,
      height: CORNER_SIZE + EDGE_INSET,
    },
  },
  {
    edge: 'se',
    cursor: 'nwse-resize',
    style: {
      bottom: -EDGE_INSET,
      right: -EDGE_INSET,
      width: CORNER_SIZE + EDGE_INSET,
      height: CORNER_SIZE + EDGE_INSET,
    },
  },
]

// =============================================================================
// Resize Calculation
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

  // Handle horizontal resize
  if (state.edge.includes('e')) {
    width = state.initialDimensions.width + deltaX
  }
  if (state.edge.includes('w')) {
    const newWidth = state.initialDimensions.width - deltaX
    if (newWidth >= 100) {
      width = newWidth
      x = state.initialPosition.x + deltaX
    }
  }

  // Handle vertical resize
  if (state.edge.includes('s')) {
    height = state.initialDimensions.height + deltaY
  }
  if (state.edge.includes('n')) {
    const newHeight = state.initialDimensions.height - deltaY
    if (newHeight >= 100) {
      height = newHeight
      y = state.initialPosition.y + deltaY
    }
  }

  return {
    dimensions: { width: Math.max(100, width), height: Math.max(100, height) },
    position: { x, y },
  }
}

// =============================================================================
// Component
// =============================================================================

export function ResizeHandles({
  panelId,
  dimensions,
  position,
  disabled = false,
  onResizeStart,
  onResizeEnd,
}: ResizeHandlesProps) {
  const resizeStateRef = useRef<ResizeState | null>(null)
  const currentPositionRef = useRef(position)
  const currentDimensionsRef = useRef(dimensions)

  // Keep refs in sync
  useEffect(() => {
    if (!resizeStateRef.current) {
      currentPositionRef.current = position
      currentDimensionsRef.current = dimensions
    }
  }, [position, dimensions])

  // Global modifier key tracking (ignore input elements to prevent interference)
  useEffect(() => {
    const handleKeyChange = (e: KeyboardEvent) => {
      // Ignore keyboard events from input elements (search, text fields, etc.)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      updateModifierKeys({
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
      })
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

      // Bring to front on resize start
      bringPanelToFront(panelId)

      // Capture pointer
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      // Initialize resize state
      resizeStateRef.current = {
        panelId,
        edge,
        initialDimensions: currentDimensionsRef.current,
        initialPosition: currentPositionRef.current,
        initialPointer: { x: e.clientX, y: e.clientY },
      }

      setResizing(panelId, true)
      onResizeStart?.(edge)
    },
    [panelId, disabled, onResizeStart]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      // Get sensitivity from stx modifier keys directly
      const stx = getFloatingStx()
      const mods = stx.data.modifierKeys.get()
      const sensitivity = (mods.ctrl && mods.shift) ? 0.01 : mods.shift ? 0.1 : 1.0

      const currentPointer = { x: e.clientX, y: e.clientY }
      const result = calculateResize(state, currentPointer, sensitivity)

      // Update via stx
      updatePanelDimensions(panelId, result.dimensions)
      updatePanelPosition(panelId, result.position)

      // Track current values
      currentDimensionsRef.current = result.dimensions
      currentPositionRef.current = result.position
    },
    [panelId]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return

      // Release pointer capture
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      setResizing(panelId, false)
      onResizeEnd?.(currentDimensionsRef.current, currentPositionRef.current)

      resizeStateRef.current = null
    },
    [panelId, onResizeEnd]
  )

  if (disabled) return null

  // Corners get higher z-index for priority targeting
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
            // Corners get higher z-index for easier targeting
            zIndex: isCorner(handle.edge) ? 12 : 10,
            // Touch-friendly: ensure minimum touch target
            touchAction: 'none',
            // Re-enable pointer events (wrapper has none)
            pointerEvents: 'auto',
            // Debug: uncomment to visualize handles
            // backgroundColor: isCorner(handle.edge) ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.2)',
            ...handle.style,
          }}
        />
      ))}
    </>
  )
}

export default ResizeHandles
