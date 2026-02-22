/**
 * Spawn panel + split/close (keyboard-driven panel management).
 *
 * @module floating/stx/spawn
 */

import { batch } from '@/lib/stx'
import { insertBySplit, split, leaf, isLeaf } from '../layout/split-tree'
import { cascadePosition, type PanelRect } from '../utils/position'
import { panelRegistry } from '../panel-registry'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT, WORKSPACE_SENTINEL } from './constants'
import { getFloatingStx } from './instance'
import { getViewport } from './helpers'
import { registerPanel, unregisterPanel } from './crud'
import { bringPanelToFront } from './z-order'
import { setFocusedPanel, getTiledPanelIds, removeFromPanelTree } from './tiling'
import {
  insertColumn,
  removeColumn as removeStripColumn,
  removeFocusedColumn,
  splitInColumn,
  removeFromColumnTree,
  findColumnIndex,
  focusPanelInStrip,
} from './strip'
import { getColumnPanelIds } from '../types/strip'

let splitCounter = 0

/**
 * Split the focused panel — insert a new empty panel beside it.
 */
export function splitPanelInDirection(
  targetId: string,
  direction: 'horizontal' | 'vertical',
  insertBefore = false,
): string | null {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()
  const targetPanel = stx.data.panels.get(targetId)?.peek()
  if (!currentTree || !targetPanel) return null

  const newId = `p-split-${++splitCounter}-${Date.now().toString(36)}`

  registerPanel({
    id: newId,
    title: `Panel ${splitCounter}`,
    mode: 'tiled',
    initialDimensions: targetPanel.dimensions,
  })

  const newTree = insertBySplit(currentTree, targetId, newId, direction, 0.5, insertBefore)

  batch(() => {
    stx.data.panelTree.set(newTree)
    stx.data.zOrder.set(stx.data.zOrder.peek().filter((id: string) => id !== newId))
    stx.data.panels.get(newId)?.mode.set('tiled')
    stx.data.activePanel.set(newId)
  })

  // ── Strip sync ──────────────────────────────────────────────────────
  // Both directions modify the column's internal tree.
  // splitInColumn auto-normalizes: horizontal roots get promoted to
  // separate strip columns (structural invariant).
  const targetIdx = findColumnIndex(targetId)
  if (targetIdx >= 0) {
    splitInColumn(targetIdx, targetId, newId, direction, insertBefore)
  } else {
    insertColumn(newId, 'half') // fallback: new column
  }

  return newId
}

/**
 * Close a panel completely — remove from tree AND from state.
 * Focus moves to an adjacent panel.
 */
export function closePanelFull(id: string): void {
  const stx = getFloatingStx()
  const tiledIds = getTiledPanelIds()
  const isTiled = tiledIds.includes(id)

  let nextFocus: string | null = null
  if (isTiled && tiledIds.length > 1) {
    // Prefer sibling within same column tree
    const colIdx = findColumnIndex(id)
    if (colIdx >= 0) {
      const col = stx.data.strip.peek().columns[colIdx]
      const colPanels = getColumnPanelIds(col).filter(pid => pid !== id)
      nextFocus = colPanels[0] ?? null
    }
    // Fallback: any other tiled panel
    if (!nextFocus) {
      const idx = tiledIds.indexOf(id)
      nextFocus = tiledIds[idx + 1] ?? tiledIds[idx - 1] ?? null
    }
  } else {
    const zOrder = stx.data.zOrder.peek()
    nextFocus = zOrder.filter((pid: string) => pid !== id).pop() ?? null
  }

  batch(() => {
    if (isTiled) {
      removeFromPanelTree(id)
      // Remove from strip — tree-aware: removes panel from column's tree,
      // only removes the column itself if it was the last panel in it.
      const colIdx = findColumnIndex(id)
      if (colIdx >= 0) {
        removeFromColumnTree(colIdx, id)
      }
    }
    unregisterPanel(id)
    if (nextFocus) {
      stx.data.activePanel.set(nextFocus)
    }
  })
}

let spawnCounter = 0

/**
 * Spawn a new panel with registered content.
 */
export function spawnPanel(
  visitorId: string,
  opts: {
    mode?: 'tiled' | 'floating'
    targetPanelId?: string
    direction?: 'horizontal' | 'vertical'
    data?: unknown
    title?: string
    accent?: string
  } = {},
): string | null {
  const entry = panelRegistry.get(visitorId)

  const label = opts.title ?? entry?.label ?? visitorId
  const mode = opts.mode ?? entry?.defaults?.mode ?? 'tiled'
  const accent = opts.accent ?? entry?.defaults?.accent
  const width = entry?.defaults?.width ?? DEFAULT_WIDTH
  const height = entry?.defaults?.height ?? DEFAULT_HEIGHT

  const newId = `p-${visitorId}-${++spawnCounter}-${Date.now().toString(36)}`

  // For floating mode, cascade position so panels don't stack at (0,0)
  let initialPosition: { x: number; y: number } | undefined
  if (mode === 'floating') {
    const stx = getFloatingStx()
    const panels = stx.data.panels.peek() ?? {}
    const existingRects: PanelRect[] = []
    for (const [pid, p] of Object.entries(panels)) {
      if (pid === newId) continue
      const panel = p as any
      if (panel?.mode === 'floating' && panel?.visibility === 'visible') {
        existingRects.push({
          x: panel.position?.x ?? 0,
          y: panel.position?.y ?? 0,
          width: panel.dimensions?.width ?? DEFAULT_WIDTH,
          height: panel.dimensions?.height ?? DEFAULT_HEIGHT,
        })
      }
    }
    const viewport = getViewport()
    initialPosition = cascadePosition(existingRects, { width, height }, viewport)
  }

  registerPanel({
    id: newId,
    title: label,
    mode,
    initialPosition,
    initialDimensions: { width, height },
    visitorId,
    visitorData: opts.data,
    accent,
  })

  if (mode === 'floating') {
    bringPanelToFront(newId)
    setFocusedPanel(newId)
  }

  if (mode === 'tiled') {
    const stx = getFloatingStx()
    const currentTree = stx.data.panelTree.peek()

    // Is the tree just the sentinel (empty workspace)?
    const isSentinel = currentTree && isLeaf(currentTree) && currentTree.panelId === WORKSPACE_SENTINEL

    if (isSentinel || !currentTree) {
      // First panel — replace sentinel entirely, fill the space
      batch(() => {
        stx.data.panelTree.set(leaf(newId))
        stx.data.zOrder.set(stx.data.zOrder.peek().filter((id: string) => id !== newId))
        stx.data.panels.get(newId)?.mode.set('tiled')
        stx.data.activePanel.set(newId)
      })
    } else if (opts.targetPanelId) {
      const dir = opts.direction ?? 'horizontal'
      const newTree = insertBySplit(currentTree, opts.targetPanelId, newId, dir)
      batch(() => {
        stx.data.panelTree.set(newTree)
        stx.data.zOrder.set(stx.data.zOrder.peek().filter((id: string) => id !== newId))
        stx.data.panels.get(newId)?.mode.set('tiled')
        stx.data.activePanel.set(newId)
      })
    } else {
      const dir = opts.direction ?? 'horizontal'
      const newTree = split(dir, currentTree, leaf(newId), 0.5)
      batch(() => {
        stx.data.panelTree.set(newTree)
        stx.data.zOrder.set(stx.data.zOrder.peek().filter((id: string) => id !== newId))
        stx.data.panels.get(newId)?.mode.set('tiled')
        stx.data.activePanel.set(newId)
      })
    }

    // Also insert into the strip model (parallel during migration).
    // Index-aware: insert after focused column so new panel appears adjacent.
    insertColumn(newId, 'half', { after: 'focused' })
  }

  return newId
}
