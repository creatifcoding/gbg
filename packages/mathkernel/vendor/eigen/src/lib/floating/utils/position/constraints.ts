/**
 * Constraint algorithms — clamp, snap-to-grid, magnetic snap.
 *
 * @module floating/utils/position/constraints
 */

import type { Position, Dimensions } from '../../types'
import { VIEWPORT_PADDING, type Viewport, type PanelRect, type MagneticSnapOptions } from './types'

/**
 * Round a position to the nearest grid point.
 * gridSize of 0 = no snapping (passthrough).
 */
export function snapToGrid(position: Position, gridSize: number): Position {
  if (gridSize <= 0) return position
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  }
}

/**
 * Clamp a position so the panel stays fully within the viewport.
 */
export function clampToViewport(
  position: Position,
  dimensions: Dimensions,
  viewport: Viewport,
): Position {
  return {
    x: Math.max(
      viewport.x + VIEWPORT_PADDING,
      Math.min(position.x, viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING),
    ),
    y: Math.max(
      viewport.y + VIEWPORT_PADDING,
      Math.min(position.y, viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING),
    ),
  }
}

/**
 * Applies magnetic snap behavior to a panel position.
 */
export function applyMagneticSnap(
  position: Position,
  dimensions: Dimensions,
  viewport: Viewport,
  siblings: ReadonlyArray<PanelRect>,
  options: MagneticSnapOptions = {},
): Position {
  const threshold = options.threshold ?? 10
  const includeViewportCenter = options.includeViewportCenter ?? true
  const includePanelAlign = options.includePanelAlign ?? true

  const xTargets: number[] = [
    viewport.x + VIEWPORT_PADDING,
    viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING,
  ]

  const yTargets: number[] = [
    viewport.y + VIEWPORT_PADDING,
    viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING,
  ]

  if (includeViewportCenter) {
    xTargets.push(viewport.x + (viewport.width - dimensions.width) / 2)
    yTargets.push(viewport.y + (viewport.height - dimensions.height) / 2)
  }

  if (includePanelAlign) {
    for (const panel of siblings) {
      xTargets.push(panel.x)
      xTargets.push(panel.x + panel.width - dimensions.width)
      xTargets.push(panel.x + (panel.width - dimensions.width) / 2)
      yTargets.push(panel.y)
      yTargets.push(panel.y + panel.height - dimensions.height)
      yTargets.push(panel.y + (panel.height - dimensions.height) / 2)
    }
  }

  const snappedX = snapScalar(position.x, xTargets, threshold)
  const snappedY = snapScalar(position.y, yTargets, threshold)

  return clampToViewport(
    { x: snappedX, y: snappedY },
    dimensions,
    viewport,
  )
}

// =============================================================================
// Internal Helpers (exported for sibling use)
// =============================================================================

export function snapScalar(value: number, targets: ReadonlyArray<number>, threshold: number): number {
  let best = value
  let bestDist = Infinity

  for (const t of targets) {
    const dist = Math.abs(value - t)
    if (dist <= threshold && dist < bestDist) {
      best = t
      bestDist = dist
    }
  }

  return best
}

/** Check if two rectangles overlap (with zero tolerance) */
export function rectsOverlap(a: PanelRect, b: PanelRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
