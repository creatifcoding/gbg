/**
 * Resize calculation — pure math for resize operations.
 *
 * @module floating/hooks/resize-calc
 */

import type { Dimensions, Position, ResizeEdge } from '../types'

export interface ResizeState {
  initialDimensions: Dimensions
  initialPosition: Position
  initialPointer: Position
  edge: ResizeEdge
}

/**
 * Calculate new dimensions based on edge being dragged.
 */
export function calculateNewDimensions(
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

  if (state.edge.includes('e')) {
    width = state.initialDimensions.width + deltaX
  }
  if (state.edge.includes('w')) {
    width = state.initialDimensions.width - deltaX
    x = state.initialPosition.x + deltaX
  }
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
