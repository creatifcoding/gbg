/**
 * useCanvasDrop Hook
 *
 * Handles ghost shape creation and canvas drop for tldraw integration.
 * Bridges GridDragService to tldraw editor.
 *
 * @module
 */

import { useCallback, useRef } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { createShapeId } from 'tldraw'
import type { GridRow, Point } from '../../types'

// =============================================================================
// TYPES
// =============================================================================

export interface UseCanvasDropOptions {
  /** tldraw editor instance */
  editor: Editor
  /** Source shape ID (for tracking) */
  sourceShapeId: string
  /** Callback to create the final shape on drop */
  onDrop?: (rowData: GridRow, canvasPos: Point) => void
}

export interface UseCanvasDropResult {
  /** Create a ghost shape at screen position */
  createGhost: (rowData: GridRow, screenPos: Point) => TLShapeId
  /** Update ghost position */
  updateGhost: (ghostId: TLShapeId, screenPos: Point) => void
  /** Remove ghost shape */
  removeGhost: (ghostId: TLShapeId) => void
  /** Convert screen to canvas coordinates */
  screenToCanvas: (screenPos: Point) => Point
}

// =============================================================================
// HOOK
// =============================================================================

export function useCanvasDrop(options: UseCanvasDropOptions): UseCanvasDropResult {
  const { editor, sourceShapeId, onDrop } = options

  // Track active ghosts
  const activeGhostsRef = useRef<Set<TLShapeId>>(new Set())

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenPos: Point): Point => {
      const canvasPos = editor.screenToPage(screenPos)
      return { x: canvasPos.x, y: canvasPos.y }
    },
    [editor]
  )

  // Create ghost shape
  const createGhost = useCallback(
    (rowData: GridRow, screenPos: Point): TLShapeId => {
      const canvasPos = screenToCanvas(screenPos)
      const ghostId = createShapeId()

      // Create an acquire-ghost shape (or any ghost shape type you have)
      editor.createShape({
        id: ghostId,
        type: 'acquire-ghost',
        x: canvasPos.x - 30, // Center offset
        y: canvasPos.y - 30,
        props: {
          w: 60,
          h: 60,
          rowName: 'name' in rowData ? (rowData as any).name : rowData.id,
          status: 'status' in rowData ? (rowData as any).status : 'active',
        },
      })

      activeGhostsRef.current.add(ghostId)

      return ghostId
    },
    [editor, screenToCanvas]
  )

  // Update ghost position
  const updateGhost = useCallback(
    (ghostId: TLShapeId, screenPos: Point) => {
      const canvasPos = screenToCanvas(screenPos)
      const ghost = editor.getShape(ghostId)

      if (ghost) {
        editor.updateShape({
          id: ghostId,
          type: 'acquire-ghost',
          x: canvasPos.x - 30,
          y: canvasPos.y - 30,
        })
      }
    },
    [editor, screenToCanvas]
  )

  // Remove ghost shape
  const removeGhost = useCallback(
    (ghostId: TLShapeId) => {
      try {
        editor.deleteShape(ghostId)
        activeGhostsRef.current.delete(ghostId)
      } catch {
        // Shape may already be deleted
      }
    },
    [editor]
  )

  return {
    createGhost,
    updateGhost,
    removeGhost,
    screenToCanvas,
  }
}
