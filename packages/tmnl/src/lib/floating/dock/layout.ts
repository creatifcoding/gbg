/**
 * Dock Layout Functions
 *
 * Pure functions for edge/corner dock zone detection and layout resolution.
 * Zero React dependency — these are geometry math only.
 *
 * @module
 */

import type { Position, Dimensions } from '../types'
import type { Viewport } from '../utils/position'
import { DOCK_THRESHOLD, type DockZone } from './types'

/**
 * Approximate equality check for layout classification.
 */
export function approx(a: number, b: number, epsilon: number = 2): boolean {
  return Math.abs(a - b) <= epsilon
}

/**
 * Classify a docked layout into its dock zone.
 * Inspects position + dimensions relative to viewport to determine zone.
 */
export function classifyDockZone(
  layout: { position: Position; dimensions: Dimensions },
  viewport: Viewport,
): DockZone {
  const halfW = Math.round(viewport.width / 2)
  const halfH = Math.round(viewport.height / 2)

  const isHalfW = approx(layout.dimensions.width, halfW)
  const isHalfH = approx(layout.dimensions.height, halfH)
  const isFullW = approx(layout.dimensions.width, viewport.width)
  const isFullH = approx(layout.dimensions.height, viewport.height)

  const isLeft = approx(layout.position.x, 0)
  const isRight = approx(layout.position.x, halfW)
  const isTop = approx(layout.position.y, 0)
  const isBottom = approx(layout.position.y, halfH)

  if (isHalfW && isHalfH && isLeft && isTop) return 'Top Left'
  if (isHalfW && isHalfH && isRight && isTop) return 'Top Right'
  if (isHalfW && isHalfH && isLeft && isBottom) return 'Bottom Left'
  if (isHalfW && isHalfH && isRight && isBottom) return 'Bottom Right'

  if (isHalfW && isFullH && isLeft) return 'Left'
  if (isHalfW && isFullH && isRight) return 'Right'
  if (isFullW && isHalfH && isTop) return 'Top'
  if (isFullW && isHalfH && isBottom) return 'Bottom'

  return 'Left'
}

/**
 * Human-readable label with directional arrow for a dock zone.
 */
export function dockZoneLabel(zone: DockZone): string {
  switch (zone) {
    case 'Left': return '⬅ Left'
    case 'Right': return 'Right ➡'
    case 'Top': return '⬆ Top'
    case 'Bottom': return '⬇ Bottom'
    case 'Top Left': return '↖ Top Left'
    case 'Top Right': return '↗ Top Right'
    case 'Bottom Left': return '↙ Bottom Left'
    case 'Bottom Right': return '↘ Bottom Right'
  }
}

/**
 * Resolve dock layout from panel position near viewport edges.
 *
 * Returns half/quarter layout if near an edge/corner, null if center.
 * Priority: corners (quarter) > edges (half).
 */
export function resolveDockLayout(
  position: Position,
  dimensions: Dimensions,
  viewport: Viewport,
): { position: Position; dimensions: Dimensions } | null {
  const nearLeft = position.x <= DOCK_THRESHOLD
  const nearRight = position.x + dimensions.width >= viewport.width - DOCK_THRESHOLD
  const nearTop = position.y <= DOCK_THRESHOLD
  const nearBottom = position.y + dimensions.height >= viewport.height - DOCK_THRESHOLD

  const halfW = Math.round(viewport.width / 2)
  const halfH = Math.round(viewport.height / 2)

  // Corners → quarter layouts
  if (nearLeft && nearTop) {
    return { position: { x: 0, y: 0 }, dimensions: { width: halfW, height: halfH } }
  }
  if (nearRight && nearTop) {
    return { position: { x: halfW, y: 0 }, dimensions: { width: halfW, height: halfH } }
  }
  if (nearLeft && nearBottom) {
    return { position: { x: 0, y: halfH }, dimensions: { width: halfW, height: halfH } }
  }
  if (nearRight && nearBottom) {
    return { position: { x: halfW, y: halfH }, dimensions: { width: halfW, height: halfH } }
  }

  // Edges → half layouts
  if (nearLeft) {
    return { position: { x: 0, y: 0 }, dimensions: { width: halfW, height: viewport.height } }
  }
  if (nearRight) {
    return { position: { x: halfW, y: 0 }, dimensions: { width: halfW, height: viewport.height } }
  }
  if (nearTop) {
    return { position: { x: 0, y: 0 }, dimensions: { width: viewport.width, height: halfH } }
  }
  if (nearBottom) {
    return { position: { x: 0, y: halfH }, dimensions: { width: viewport.width, height: halfH } }
  }

  return null
}
