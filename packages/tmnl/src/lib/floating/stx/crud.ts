/**
 * Panel CRUD — register, unregister, close, get.
 *
 * @module floating/stx/crud
 */

import { batch } from '@/lib/stx'
import type { PanelState, PanelConfig, Position } from '../types'
import { cascadePosition, type PanelRect } from '../utils/position'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from './constants'
import { getFloatingStx } from './instance'
import { getViewport } from './helpers'

/**
 * Register a new panel.
 * Uses cascade placement to avoid stacking panels on top of each other.
 */
export function registerPanel(config: PanelConfig): PanelState {
  const stx = getFloatingStx()
  const dims = config.initialDimensions ?? { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }

  // Smart placement
  let position: Position
  if (config.initialPosition) {
    position = config.initialPosition
  } else {
    const panelsMap = stx.data.panels.peek()
    const existingRects: PanelRect[] = []
    panelsMap.forEach((p) => {
      if (p.visibility !== 'hidden') {
        existingRects.push({ x: p.position.x, y: p.position.y, width: p.dimensions.width, height: p.dimensions.height })
      }
    })
    position = cascadePosition(existingRects, dims, getViewport())
  }

  // Cache zOrder length + baseZ for single read
  const zOrderLen = stx.data.zOrder.peek().length
  const baseZ = stx.data.baseZIndex.peek()

  const panel: PanelState = {
    id: config.id,
    title: config.title,
    mode: config.mode ?? 'floating',
    position,
    dimensions: dims,
    constraints: config.constraints ?? { minWidth: 200, minHeight: 150 },
    zIndex: baseZ + zOrderLen,
    visibility: 'visible',
    isDragging: false,
    isResizing: false,
    isMaximized: false,
    preMaximizePosition: undefined,
    preMaximizeDimensions: undefined,
    preMinimizePosition: undefined,
    preMinimizeDimensions: undefined,
    tiledWidth: config.tiledWidth ?? dims.width,
    isCollapsed: false,
    floatOriginSide: undefined,
    accent: config.accent,
    headerHidden: config.headerHidden ?? false,
    tabs: [],
    activeTabId: undefined,
    autoSize: config.autoSize ?? false,
    closable: config.closable ?? true,
    minimizable: config.minimizable ?? true,
    resizable: config.resizable ?? (!(config.autoSize ?? false)),
    visitorId: config.visitorId,
    visitorData: config.visitorData,
  }

  batch(() => {
    stx.data.panels.set(config.id, panel)
    stx.data.zOrder.set([...stx.data.zOrder.peek(), config.id])
  })

  return panel
}

/**
 * Unregister a panel (removes from state + z-order)
 */
export function unregisterPanel(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.panels.delete(id)
    const newOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    stx.data.zOrder.set(newOrder)
    if (stx.data.activePanel.peek() === id) {
      stx.data.activePanel.set(newOrder[newOrder.length - 1] ?? null)
    }
  })
}

/**
 * Close panel (alias for unregisterPanel)
 */
export function closePanel(id: string): void {
  unregisterPanel(id)
}

/**
 * Get panel snapshot by ID
 */
export function getPanel(id: string): PanelState | undefined {
  return getFloatingStx().data.panels.get(id)?.peek()
}
