/**
 * Resize handle configuration — positions and cursors.
 *
 * @module floating/resize-handle-config
 */

import type { ResizeEdge, Dimensions, Position } from './types'

export interface HandleConfig {
  edge: ResizeEdge
  cursor: string
  style: React.CSSProperties
}

export interface ResizeState {
  edge: ResizeEdge
  initialDimensions: Dimensions
  initialPosition: Position
  initialPointer: Position
}

const EDGE_THICKNESS = 6
const CORNER_SIZE = 16
const EDGE_INSET = 4

export const HANDLES: HandleConfig[] = [
  { edge: 'n', cursor: 'ns-resize', style: { top: -EDGE_INSET, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 's', cursor: 'ns-resize', style: { bottom: -EDGE_INSET, left: CORNER_SIZE, right: CORNER_SIZE, height: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'e', cursor: 'ew-resize', style: { right: -EDGE_INSET, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'w', cursor: 'ew-resize', style: { left: -EDGE_INSET, top: CORNER_SIZE, bottom: CORNER_SIZE, width: EDGE_THICKNESS + EDGE_INSET } },
  { edge: 'nw', cursor: 'nwse-resize', style: { top: -EDGE_INSET, left: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'ne', cursor: 'nesw-resize', style: { top: -EDGE_INSET, right: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'sw', cursor: 'nesw-resize', style: { bottom: -EDGE_INSET, left: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
  { edge: 'se', cursor: 'nwse-resize', style: { bottom: -EDGE_INSET, right: -EDGE_INSET, width: CORNER_SIZE + EDGE_INSET, height: CORNER_SIZE + EDGE_INSET } },
]

/**
 * Pure resize math — calculate new dimensions/position from drag delta.
 */
export function calculateResize(
  state: ResizeState,
  currentPointer: Position,
  sensitivity: number,
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
