/**
 * useResize Hook
 *
 * Pointer event handling for panel resize operations.
 * Integrates with stx for sensitivity based on modifier keys.
 *
 * @pattern Pointer capture + stx integration
 * @module
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  getFloatingStx,
  updatePanelDimensions,
  setResizing,
  updateModifierKeys,
} from '../floating-stx'
import type { ResizeEdge, Dimensions, Position, UseResizeReturn } from '../types'

// =============================================================================
// Resize Calculation
// =============================================================================

interface ResizeState {
  initialDimensions: Dimensions
  initialPosition: Position
  initialPointer: Position
  edge: ResizeEdge
}

/**
 * Calculate new dimensions based on edge being dragged
 */
function calculateNewDimensions(
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
    width = state.initialDimensions.width - deltaX
    x = state.initialPosition.x + deltaX
  }

  // Handle vertical resize
  if (state.edge.includes('s')) {
    height = state.initialDimensions.height + deltaY
  }
  if (state.edge.includes('n')) {
    height = state.initialDimensions.height - deltaY
    y = state.initialPosition.y + deltaY
  }

  return {
    dimensions: { width: Math.max(100, width), height: Math.max(100, height) },
    position: { x, y },
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseResizeOptions {
  /** Panel ID */
  panelId: string
  /** Initial dimensions */
  initialDimensions: Dimensions
  /** Initial position */
  initialPosition: Position
  /** Callback when resize completes */
  onResizeEnd?: (dimensions: Dimensions, position: Position) => void
}

export function useResize({
  panelId,
  initialDimensions,
  initialPosition,
  onResizeEnd,
}: UseResizeOptions): UseResizeReturn {
  const [isResizing, setIsResizingState] = useState(false)
  const [resizeEdge, setResizeEdge] = useState<ResizeEdge | null>(null)

  const resizeStateRef = useRef<ResizeState | null>(null)
  const currentPositionRef = useRef(initialPosition)

  // Update refs when props change
  useEffect(() => {
    if (!isResizing) {
      currentPositionRef.current = initialPosition
    }
  }, [initialPosition, isResizing])

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

  const startResize = useCallback(
    (edge: ResizeEdge) => {
      setResizeEdge(edge)
      setIsResizingState(true)
      setResizing(panelId, true)
    },
    [panelId]
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isResizing || !resizeStateRef.current) return

      const stx = getFloatingStx()
      const sensitivity = stx.computed.resizeSensitivity

      const currentPointer = { x: e.clientX, y: e.clientY }
      const result = calculateNewDimensions(
        resizeStateRef.current,
        currentPointer,
        sensitivity
      )

      // Update dimensions via stx
      updatePanelDimensions(panelId, result.dimensions)

      // Store new position
      currentPositionRef.current = result.position
    },
    [isResizing, panelId]
  )

  const handlePointerUp = useCallback(() => {
    if (!isResizing) return

    const stx = getFloatingStx()
    const panel = stx.data.panels.get().get(panelId)

    setIsResizingState(false)
    setResizeEdge(null)
    setResizing(panelId, false)
    resizeStateRef.current = null

    if (panel && onResizeEnd) {
      onResizeEnd(panel.dimensions, currentPositionRef.current)
    }
  }, [isResizing, panelId, onResizeEnd])

  // Initialize resize state when starting
  const handlePointerDown = useCallback(
    (e: PointerEvent, edge: ResizeEdge) => {
      e.preventDefault()
      e.stopPropagation()

      // Capture pointer for smooth resize
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      resizeStateRef.current = {
        initialDimensions,
        initialPosition: currentPositionRef.current,
        initialPointer: { x: e.clientX, y: e.clientY },
        edge,
      }

      startResize(edge)
    },
    [initialDimensions, startResize]
  )

  return {
    startResize,
    isResizing,
    resizeEdge,
    handlePointerMove,
    handlePointerUp,
    // Expose for direct binding
    createHandlers: (edge: ResizeEdge) => ({
      onPointerDown: (e: React.PointerEvent) => handlePointerDown(e.nativeEvent, edge),
    }),
  }
}

// Extend the return type
declare module '../types' {
  interface UseResizeReturn {
    createHandlers: (edge: ResizeEdge) => {
      onPointerDown: (e: React.PointerEvent) => void
    }
  }
}
