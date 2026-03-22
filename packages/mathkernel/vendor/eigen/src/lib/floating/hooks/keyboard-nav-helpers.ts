/**
 * Keyboard navigation helpers — pure utility functions.
 *
 * @module floating/hooks/keyboard-nav-helpers
 */

import {
  getTiledPanelIds,
  setFocusedPanel,
} from '../stx/actions'
import { getFloatingStx } from '../floating-stx'
import { swapPanels, collectPanelIds, findAdjacentPanel } from '../layout/split-tree'
import { WORKSPACE_SENTINEL } from '../stx/constants'
import { batch } from '@/lib/stx'

/** Is the given panel currently in tiled mode? */
export function isTiled(panelId: string): boolean {
  return getTiledPanelIds().includes(panelId)
}

/** Is the given panel currently floating? */
export function isFloating(panelId: string): boolean {
  const panel = getFloatingStx().data.panels.get(panelId)?.peek()
  return panel?.mode === 'floating'
}

/** Get all floating panel IDs (from zOrder) */
export function getFloatingPanelIds(): string[] {
  return getFloatingStx().data.zOrder.peek() ?? []
}

/** Swap a tiled panel with its neighbor in any direction */
export function swapInDirection(direction: 'left' | 'right' | 'up' | 'down'): void {
  const stx = getFloatingStx()
  const tree = stx.data.panelTree.peek()
  const activeId = stx.data.activePanel.peek()
  if (!tree || !activeId) return

  const targetId = findAdjacentPanel(tree, activeId, direction)
  if (!targetId || targetId === WORKSPACE_SENTINEL) return

  batch(() => {
    stx.data.panelTree.set(swapPanels(tree, activeId, targetId))
    stx.data.activePanel.set(activeId)
    stx.data.focusDirection.set(direction)
  })

  // Clear direction after animation settles
  setTimeout(() => {
    stx.data.focusDirection.set(null)
  }, 300)
}

/**
 * Cycle focus through floating panels.
 */
export function focusFloatingInDirection(direction: 'left' | 'right' | 'up' | 'down'): void {
  const floatingIds = getFloatingPanelIds()
  if (floatingIds.length === 0) return

  const stx = getFloatingStx()
  const activeId = stx.data.activePanel.peek()
  const idx = activeId ? floatingIds.indexOf(activeId) : -1

  const forward = direction === 'right' || direction === 'down'
  let nextIdx: number
  if (idx < 0) {
    nextIdx = forward ? 0 : floatingIds.length - 1
  } else {
    nextIdx = forward
      ? (idx + 1) % floatingIds.length
      : (idx - 1 + floatingIds.length) % floatingIds.length
  }

  setFocusedPanel(floatingIds[nextIdx], direction)
}
