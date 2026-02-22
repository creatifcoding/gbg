/**
 * Floating STX computed/derived selectors
 *
 * Pure derivations from observable state. No side effects.
 *
 * @module
 */

import type { FloatingStxData, PanelState } from '../types'

export const floatingComputed = {
  /**
   * Panels sorted by z-index (ascending)
   */
  sortedPanels: (get: { data: FloatingStxData }) => {
    const panels = get.data.panels
    const zOrder = get.data.zOrder
    return zOrder
      .map((id: string) => panels.get(id))
      .filter((p): p is PanelState => p !== undefined)
  },

  /**
   * Top panel (highest z-index)
   */
  topPanel: (get: { data: FloatingStxData }) => {
    const zOrder = get.data.zOrder
    return zOrder[zOrder.length - 1] ?? null
  },

  /**
   * Currently active panel data
   */
  activePanelData: (get: { data: FloatingStxData }) => {
    const activeId = get.data.activePanel
    if (!activeId) return null
    return get.data.panels.get(activeId) ?? null
  },

  /**
   * Resize sensitivity based on modifier keys
   * - Normal: 1.0
   * - Shift: 0.1 (fine)
   * - Ctrl+Shift: 0.01 (ultra-fine)
   */
  resizeSensitivity: (get: { data: FloatingStxData }) => {
    const mods = typeof get.data.modifierKeys.get === 'function'
      ? get.data.modifierKeys.get()
      : get.data.modifierKeys
    if (mods.ctrl && mods.shift) return 0.01
    if (mods.shift) return 0.1
    return 1.0
  },

  /**
   * Visible panels only
   */
  visiblePanels: (get: { data: FloatingStxData }) => {
    const panels = get.data.panels
    const zOrder = get.data.zOrder
    return zOrder
      .map((id: string) => panels.get(id))
      .filter((p): p is PanelState => p !== undefined && p.visibility === 'visible')
  },

  // ─── SM Migration: mode-partitioned queries ─────────────────────────

  /**
   * Panels currently in tiled mode (visible, not collapsed)
   */
  tiledPanels: (get: { data: FloatingStxData }) => {
    const result: PanelState[] = []
    get.data.panels.forEach((p: PanelState) => {
      if (p.mode === 'tiled' && p.visibility !== 'hidden') result.push(p)
    })
    return result
  },

  /**
   * Panels currently in floating mode (ordered by z-index)
   */
  floatingPanels: (get: { data: FloatingStxData }) => {
    const panels = get.data.panels
    const zOrder = get.data.zOrder
    return zOrder
      .map((id: string) => panels.get(id))
      .filter((p): p is PanelState => p !== undefined && p.mode === 'floating' && p.visibility !== 'hidden')
  },

  /**
   * Collapsed tiled panels (vertical strip state)
   */
  collapsedPanels: (get: { data: FloatingStxData }) => {
    const result: PanelState[] = []
    get.data.panels.forEach((p: PanelState) => {
      if (p.mode === 'tiled' && p.isCollapsed) result.push(p)
    })
    return result
  },
}
