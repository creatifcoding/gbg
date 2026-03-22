/**
 * Z-Order management — bring to front, send to back, position/dimension updates.
 *
 * @module floating/stx/z-order
 */

import { batch } from '@/lib/stx'
import type { Position, Dimensions } from '../types'
import { getFloatingStx } from './instance'
import { reassignZIndices } from './helpers'

/**
 * Bring panel to front (highest z-index)
 */
export function bringPanelToFront(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    const zOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    zOrder.push(id)
    stx.data.zOrder.set(zOrder)
    stx.data.activePanel.set(id)
    reassignZIndices(zOrder)
  })
}

/**
 * Send panel to back (lowest z-index)
 */
export function sendPanelToBack(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    const zOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    zOrder.unshift(id)
    stx.data.zOrder.set(zOrder)
    reassignZIndices(zOrder)
  })
}

/**
 * Update panel position (fine-grained write)
 */
export function updatePanelPosition(id: string, position: Position): void {
  getFloatingStx().data.panels.get(id)?.position.set(position)
}

/**
 * Update panel dimensions with constraint enforcement
 */
export function updatePanelDimensions(id: string, dimensions: Dimensions): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel) return

  panelObs.dimensions.set({
    width: Math.max(panel.constraints.minWidth ?? 200, Math.min(dimensions.width, panel.constraints.maxWidth ?? Infinity)),
    height: Math.max(panel.constraints.minHeight ?? 150, Math.min(dimensions.height, panel.constraints.maxHeight ?? Infinity)),
  })
}
