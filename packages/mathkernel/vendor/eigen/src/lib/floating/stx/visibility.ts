/**
 * Visibility, mode, maximize/restore, stash/unstash, header toggle.
 *
 * @module floating/stx/visibility
 */

import { batch } from '@/lib/stx'
import type { PanelVisibility, PanelStorage } from '../types'
import { getFloatingStx } from './instance'
import { getMaxBounds } from './helpers'
import { bringPanelToFront } from './z-order'

/** Set panel visibility */
export function setPanelVisibility(id: string, visibility: PanelVisibility): void {
  getFloatingStx().data.panels.get(id)?.visibility.set(visibility)
}

/**
 * Minimize panel to collapsed strip.
 * Saves current position/dimensions for restore, sets visibility to 'minimized'.
 */
export function minimizePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.visibility === 'minimized') return

  // If maximized, restore first then minimize
  if (panel.isMaximized) {
    restorePanel(id)
  }

  const current = getFloatingStx().data.panels.get(id)?.peek()
  if (!current) return

  batch(() => {
    panelObs!.preMinimizePosition.set({ ...current.position })
    panelObs!.preMinimizeDimensions.set({ ...current.dimensions })
    panelObs!.visibility.set('minimized')
  })
}

/**
 * Restore panel from minimized (collapsed strip) state.
 */
export function restoreFromMinimize(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.visibility !== 'minimized') return

  batch(() => {
    panelObs!.visibility.set('visible')
    if (panel.preMinimizePosition) {
      panelObs!.position.set(panel.preMinimizePosition)
    }
    if (panel.preMinimizeDimensions) {
      panelObs!.dimensions.set(panel.preMinimizeDimensions)
    }
    panelObs!.preMinimizePosition.set(undefined)
    panelObs!.preMinimizeDimensions.set(undefined)
  })

  bringPanelToFront(id)
}

/** Toggle panel mode between floating and docked */
export function togglePanelMode(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (panel) {
    panelObs.mode.set(panel.mode === 'floating' ? 'docked' : 'floating')
  }
}

/** Maximize panel to fill bounds container (or viewport) */
export function maximizePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.isMaximized) return

  const { position: maxPos, dimensions: maxDims } = getMaxBounds()

  batch(() => {
    panelObs.isMaximized.set(true)
    panelObs.preMaximizePosition.set({ ...panel.position })
    panelObs.preMaximizeDimensions.set({ ...panel.dimensions })
    panelObs.position.set(maxPos)
    panelObs.dimensions.set(maxDims)
  })

  bringPanelToFront(id)
}

/** Restore panel from maximized state */
export function restorePanel(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || !panel.isMaximized) return

  batch(() => {
    panelObs.isMaximized.set(false)
    panelObs.position.set(panel.preMaximizePosition ?? panel.position)
    panelObs.dimensions.set(panel.preMaximizeDimensions ?? panel.dimensions)
    panelObs.preMaximizePosition.set(undefined)
    panelObs.preMaximizeDimensions.set(undefined)
  })
}

/**
 * Stash all floating panels to edge strips (minimize all).
 */
export function stashFloatsToEdges(): void {
  const stx = getFloatingStx()
  const zOrder = stx.data.zOrder.peek()

  batch(() => {
    for (const id of zOrder) {
      const panelObs = stx.data.panels.get(id)
      const panel = panelObs?.peek()
      if (!panel || panel.mode !== 'floating' || panel.visibility !== 'visible') continue

      panelObs.preMinimizePosition.set({ ...panel.position })
      panelObs.preMinimizeDimensions.set({ ...panel.dimensions })
      panelObs.visibility.set('minimized')
    }
  })
}

/**
 * Unstash all floating panels (restore from minimized).
 */
export function unstashFloats(): void {
  const stx = getFloatingStx()
  const zOrder = stx.data.zOrder.peek()

  batch(() => {
    for (const id of zOrder) {
      const panelObs = stx.data.panels.get(id)
      const panel = panelObs?.peek()
      if (!panel || panel.visibility !== 'minimized') continue

      panelObs.visibility.set('visible')
      if (panel.preMinimizePosition) {
        panelObs.position.set(panel.preMinimizePosition)
      }
      if (panel.preMinimizeDimensions) {
        panelObs.dimensions.set(panel.preMinimizeDimensions)
      }
      panelObs.preMinimizePosition.set(undefined)
      panelObs.preMinimizeDimensions.set(undefined)
    }
  })
}

/** Toggle panel header visibility */
export function togglePanelHeader(id: string): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  const panel = panelObs?.peek()
  if (panel) {
    panelObs.headerHidden.set(!panel.headerHidden)
  }
}

/** Restore persisted state and apply to registered panels */
export function restorePersistedState(storage: PanelStorage): void {
  const stx = getFloatingStx()
  batch(() => {
    for (const [id, persisted] of Object.entries(storage.panels)) {
      const panelObs = stx.data.panels.get(id)
      if (panelObs?.peek()) {
        panelObs.position.set(persisted.position)
        panelObs.dimensions.set(persisted.dimensions)
        panelObs.visibility.set(persisted.visibility)
        panelObs.mode.set(persisted.mode)
        if (persisted.tiledWidth !== undefined) panelObs.tiledWidth.set(persisted.tiledWidth)
        if (persisted.isCollapsed !== undefined) panelObs.isCollapsed.set(persisted.isCollapsed)
        if (persisted.floatOriginSide !== undefined) panelObs.floatOriginSide.set(persisted.floatOriginSide)
        if (persisted.accent !== undefined) panelObs.accent.set(persisted.accent)
        if (persisted.headerHidden !== undefined) panelObs.headerHidden.set(persisted.headerHidden)
      }
    }

    const panelsMap = stx.data.panels.peek()
    const existingIds = new Set(panelsMap.keys())
    const validOrder = storage.order.filter(id => existingIds.has(id))
    for (const [id] of panelsMap) {
      if (!validOrder.includes(id)) validOrder.push(id)
    }
    stx.data.zOrder.set(validOrder)
  })
}
