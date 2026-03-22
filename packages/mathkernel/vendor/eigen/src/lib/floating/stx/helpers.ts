/**
 * STX internal helpers — shared utilities for action modules.
 *
 * @module floating/stx/helpers
 */

import type { Position, Dimensions } from '../types'
import { cascadePosition, type PanelRect, type Viewport } from '../utils/position'
import { getBounds } from '../context/bounds'
import { getFloatingStx } from './instance'

/**
 * Reassign z-indices for all panels in z-order.
 * Uses indexed for-loop — faster than forEach for hot path.
 */
export function reassignZIndices(zOrder: readonly string[]): void {
  const stx = getFloatingStx()
  const baseZ = stx.data.baseZIndex.peek()
  for (let i = 0; i < zOrder.length; i++) {
    const panelObs = stx.data.panels.get(zOrder[i])
    if (panelObs?.peek()) {
      panelObs.zIndex.set(baseZ + i)
    }
  }
}

/** Get workspace viewport (bounds container or window fallback) */
export function getViewport(): Viewport {
  const bounds = getBounds()
  if (bounds) {
    return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
  }
  return {
    x: 0, y: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600,
  }
}

/** Get full-size dimensions for maximize (bounds or viewport) */
export function getMaxBounds(): { position: Position; dimensions: Dimensions } {
  const bounds = getBounds()
  if (bounds) {
    return { position: { x: bounds.left, y: bounds.top }, dimensions: { width: bounds.width, height: bounds.height } }
  }
  return {
    position: { x: 0, y: 0 },
    dimensions: {
      width: typeof window !== 'undefined' ? window.innerWidth : 1920,
      height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    },
  }
}
