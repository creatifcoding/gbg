/**
 * Tiling operations — tree management, float↔tile transitions, docking.
 *
 * @module floating/stx/tiling
 */

import { batch } from '@/lib/stx'
import type { Position, Dimensions } from '../types'
import {
  leaf,
  split,
  insertBySplit,
  removePanel as removeFromTree,
  collectPanelIds,
  findAdjacentPanel as findAdjacent,
  setSplitRatio as setTreeSplitRatio,
  moveSeparator as moveTreeSeparator,
  findParent,
  swapPanels,
  replacePanel,
  buildFlatColumns,
  type SplitNode,
  type SplitBranch,
} from '../layout/split-tree'
import { DEFAULT_WIDTH, DEFAULT_HEIGHT, WORKSPACE_SENTINEL } from './constants'
import { getColumnPanelIds } from '../types/strip'
import { getEdgeLeaf as getEdgeLeafFromTree } from '../layout/split-tree/queries'
import { getFloatingStx } from './instance'
import { reassignZIndices, getViewport } from './helpers'

/** Get the current panel tree (or null if no tiled panels) */
export function getPanelTree(): SplitNode | null {
  return getFloatingStx().data.panelTree.peek()
}

/** Replace the entire panel tree */
export function setPanelTree(tree: SplitNode | null): void {
  getFloatingStx().data.panelTree.set(tree)
}

/**
 * Add a panel to the tiled layout by splitting an existing tiled panel.
 */
export function addToTree(
  panelId: string,
  targetPanelId?: string,
  direction: 'horizontal' | 'vertical' = 'horizontal',
  ratio = 0.5,
  insertBefore = false,
): void {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()

  if (!currentTree) {
    stx.data.panelTree.set(leaf(panelId))
    return
  }

  if (!targetPanelId) {
    const existing = currentTree
    const incoming = leaf(panelId)
    stx.data.panelTree.set(
      split(direction, insertBefore ? incoming : existing, insertBefore ? existing : incoming, ratio),
    )
    return
  }

  stx.data.panelTree.set(
    insertBySplit(currentTree, targetPanelId, panelId, direction, ratio, insertBefore),
  )
}

/**
 * Remove a panel from the tiled tree.
 */
export function removeFromPanelTree(panelId: string): void {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()
  if (!currentTree) return

  const newTree = removeFromTree(currentTree, panelId)
  stx.data.panelTree.set(newTree)
}

/**
 * Update a split ratio for the parent of a panel.
 */
export function updateSplitRatio(panelId: string, ratio: number): void {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()
  if (!currentTree) return

  stx.data.panelTree.set(setTreeSplitRatio(currentTree, panelId, ratio))
}

/**
 * Move a separator by pixel delta.
 */
export function movePanelSeparator(panelId: string, delta: number, totalSize: number): void {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()
  if (!currentTree) return

  stx.data.panelTree.set(moveTreeSeparator(currentTree, panelId, delta, totalSize))
}

/**
 * Set the active/focused panel and record the focus direction.
 */
export function setFocusedPanel(
  panelId: string,
  direction?: 'left' | 'right' | 'up' | 'down',
): void {
  const stx = getFloatingStx()
  batch(() => {
    stx.data.activePanel.set(panelId)
    stx.data.focusDirection.set(direction ?? null)
  })
}

/**
 * Move focus to adjacent panel in a direction.
 */
export function moveFocusInDirection(
  direction: 'left' | 'right' | 'up' | 'down',
): string | null {
  const stx = getFloatingStx()
  const activeId = stx.data.activePanel.peek()
  if (!activeId) return null

  const strip = stx.data.strip.peek()
  const isHorizontal = direction === 'left' || direction === 'right'

  // ── 1. Try intra-column navigation first ──────────────────────────
  // Find which column the active panel lives in
  const colIdx = strip.columns.findIndex(col =>
    getColumnPanelIds(col).includes(activeId),
  )

  if (colIdx >= 0) {
    const col = strip.columns[colIdx]
    // Search within the column's tree for an adjacent panel
    const intraNext = findAdjacent(col.tree, activeId, direction)
    if (intraNext && intraNext !== WORKSPACE_SENTINEL) {
      setFocusedPanel(intraNext, direction)
      // Also sync strip focusedIndex to this column
      if (strip.focusedIndex !== colIdx) {
        stx.data.strip.set({ ...strip, focusedIndex: colIdx })
      }
      return intraNext
    }
  }

  // ── 2. Cross-column navigation (left/right at column edges) ───────
  if (isHorizontal) {
    const delta = direction === 'left' ? -1 : 1
    const nextColIdx = colIdx + delta
    if (nextColIdx >= 0 && nextColIdx < strip.columns.length) {
      const nextCol = strip.columns[nextColIdx]
      const panelIds = getColumnPanelIds(nextCol)
      if (panelIds.length > 0) {
        // Focus the edge-closest panel in the next column
        const edge = direction === 'left' ? 'last' : 'first'
        const nextId = getEdgeLeafFromTree(nextCol.tree, edge)
        if (nextId) {
          setFocusedPanel(nextId, direction)
          stx.data.strip.set({ ...strip, focusedIndex: nextColIdx })
          return nextId
        }
      }
    }
  }

  // ── 3. Fallback: global tree for vertical only ─────────────────────
  // Strip columns are authoritative for horizontal nav — no global tree
  // override. Global tree fallback only for up/down when column tree
  // didn't find an adjacent (shouldn't normally happen).
  if (!isHorizontal) {
    const currentTree = stx.data.panelTree.peek()
    if (currentTree) {
      const nextId = findAdjacent(currentTree, activeId, direction)
      if (nextId) {
        setFocusedPanel(nextId, direction)
      }
      return nextId
    }
  }

  return null
}

/**
 * Get all panel IDs in the current tree (tiled panels).
 */
export function getTiledPanelIds(): string[] {
  const tree = getFloatingStx().data.panelTree.peek()
  if (!tree) return []
  return collectPanelIds(tree).filter(id => id !== WORKSPACE_SENTINEL)
}

/** Set panel collapsed state (tiled vertical strip) */
export function setPanelCollapsed(id: string, collapsed: boolean): void {
  getFloatingStx().data.panels.get(id)?.isCollapsed.set(collapsed)
}

/** Toggle panel collapsed state */
export function togglePanelCollapsed(id: string): void {
  const stx = getFloatingStx()
  const panelObs = stx.data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel) return

  const newCollapsed = !panel.isCollapsed
  panelObs.isCollapsed.set(newCollapsed)

  // Auto-collapse column when ALL its panels are collapsed
  if (newCollapsed) {
    const strip = stx.data.strip.peek()
    const colIdx = strip.columns.findIndex(col =>
      getColumnPanelIds(col).includes(id),
    )
    if (colIdx >= 0) {
      const col = strip.columns[colIdx]
      const allIds = getColumnPanelIds(col)
      const allCollapsed = allIds.every(pid =>
        stx.data.panels.get(pid)?.isCollapsed.peek() ?? false,
      )
      if (allCollapsed) {
        const cols = [...strip.columns]
        cols[colIdx] = { ...col, isCollapsed: true }
        stx.data.strip.set({ ...strip, columns: cols })
      }
    }
  }

  // Auto-expand column when ANY panel is expanded
  if (!newCollapsed) {
    const strip = stx.data.strip.peek()
    const colIdx = strip.columns.findIndex(col =>
      getColumnPanelIds(col).includes(id),
    )
    if (colIdx >= 0 && strip.columns[colIdx].isCollapsed) {
      const cols = [...strip.columns]
      cols[colIdx] = { ...strip.columns[colIdx], isCollapsed: false }
      stx.data.strip.set({ ...strip, columns: cols })
    }
  }
}

/** Set panel accent color */
export function setPanelAccent(id: string, accent: string | undefined): void {
  getFloatingStx().data.panels.get(id)?.accent.set(accent)
}

/**
 * Float a tiled panel: remove from split tree, switch to floating mode.
 */
export function floatPanel(
  id: string,
  position?: Position,
  dimensions?: Dimensions,
): void {
  const stx = getFloatingStx()
  const panelObs = stx.data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.mode !== 'tiled') return

  const currentTree = stx.data.panelTree.peek()
  let originSide: 'left' | 'right' = 'left'
  if (currentTree) {
    const ids = collectPanelIds(currentTree).filter(i => i !== WORKSPACE_SENTINEL)
    const idx = ids.indexOf(id)
    if (idx >= 0 && idx >= ids.length / 2) {
      originSide = 'right'
    }
  }

  const floatPos = position ?? (() => {
    const viewport = getViewport()
    const w = dimensions?.width ?? panel.dimensions.width ?? DEFAULT_WIDTH
    const h = dimensions?.height ?? panel.dimensions.height ?? DEFAULT_HEIGHT
    return {
      x: viewport.x + (viewport.width - w) / 2,
      y: viewport.y + (viewport.height - h) / 2,
    }
  })()

  const floatDims = dimensions ?? {
    width: panel.dimensions.width || DEFAULT_WIDTH,
    height: panel.dimensions.height || DEFAULT_HEIGHT,
  }

  batch(() => {
    if (currentTree) {
      let newTree = removeFromTree(currentTree, id)
      if (newTree && newTree._tag === 'leaf' && newTree.panelId === WORKSPACE_SENTINEL) {
        newTree = null
      }
      stx.data.panelTree.set(newTree)
    }

    panelObs.mode.set('floating')
    panelObs.position.set(floatPos)
    panelObs.dimensions.set(floatDims)
    panelObs.floatOriginSide.set(originSide)
    panelObs.isCollapsed.set(false)

    const zOrder = [...stx.data.zOrder.peek(), id]
    stx.data.zOrder.set(zOrder)
    stx.data.activePanel.set(id)
    reassignZIndices(zOrder)
  })
}

/**
 * Tile a floating panel: remove from z-order, insert into split tree.
 */
export function tilePanel(
  id: string,
  targetPanelId?: string,
  direction: 'horizontal' | 'vertical' = 'horizontal',
  ratio = 0.5,
): void {
  const stx = getFloatingStx()
  const panelObs = stx.data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.mode === 'tiled') return

  batch(() => {
    panelObs.tiledWidth.set(panel.dimensions.width)
    panelObs.mode.set('tiled')
    panelObs.isCollapsed.set(false)
    panelObs.isMaximized.set(false)
    panelObs.isDragging.set(false)

    const newZOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    stx.data.zOrder.set(newZOrder)
    if (stx.data.draggingPanel.peek() === id) stx.data.draggingPanel.set(null)

    const currentTree = stx.data.panelTree.peek()
    if (!currentTree) {
      stx.data.panelTree.set(leaf(id))
    } else if (targetPanelId) {
      stx.data.panelTree.set(
        insertBySplit(currentTree, targetPanelId, id, direction, ratio),
      )
    } else {
      const ids = collectPanelIds(currentTree)
      if (ids.includes(WORKSPACE_SENTINEL)) {
        stx.data.panelTree.set(replacePanel(currentTree, WORKSPACE_SENTINEL, id))
      } else {
        const realIds = ids.filter(i => i !== WORKSPACE_SENTINEL)
        realIds.push(id)
        const newTree = buildFlatColumns(realIds, direction)
        if (newTree) stx.data.panelTree.set(newTree)
      }
    }

    stx.data.activePanel.set(id)
    reassignZIndices(newZOrder)
  })
}

/**
 * Dock a floating panel to a workspace edge.
 */
export function dockToEdge(
  id: string,
  edge: 'left' | 'right' | 'top' | 'bottom',
  ratio = 0.3,
): void {
  const stx = getFloatingStx()
  const panelObs = stx.data.panels.get(id)
  const panel = panelObs?.peek()
  if (!panel || panel.mode === 'tiled') return

  const direction = (edge === 'left' || edge === 'right') ? 'horizontal' : 'vertical'
  const insertBefore = edge === 'left' || edge === 'top'
  const currentTree = stx.data.panelTree.peek()

  if (!currentTree) {
    batch(() => {
      panelObs.tiledWidth.set(panel.dimensions.width)
      panelObs.mode.set('tiled')
      panelObs.isCollapsed.set(false)
      panelObs.isMaximized.set(false)
      panelObs.isDragging.set(false)

      const newZOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
      stx.data.zOrder.set(newZOrder)
      if (stx.data.draggingPanel.peek() === id) stx.data.draggingPanel.set(null)

      const panelLeaf = leaf(id)
      const wsLeaf = leaf(WORKSPACE_SENTINEL)

      stx.data.panelTree.set(
        insertBefore
          ? split(direction, panelLeaf, wsLeaf, ratio)
          : split(direction, wsLeaf, panelLeaf, 1 - ratio),
      )

      stx.data.activePanel.set(id)
      reassignZIndices(newZOrder)
    })
    return
  }

  tilePanel(id, undefined, direction, insertBefore ? ratio : 1 - ratio)

  const updatedTree = stx.data.panelTree.peek()
  if (!updatedTree) return

  if (updatedTree._tag === 'split' && insertBefore) {
    const branch = updatedTree as SplitBranch
    const [first, second] = branch.children
    if (first._tag === 'split' || (first._tag === 'leaf' && first.panelId !== id)) {
      stx.data.panelTree.set(
        split(direction, second, first, ratio),
      )
    }
  }
}

/**
 * Dock a floating panel between existing tiled panels (inner edge).
 */
export function dockToInnerEdge(
  id: string,
  edge: 'left' | 'right' | 'top' | 'bottom',
  ratio = 0.5,
): void {
  const stx = getFloatingStx()
  const currentTree = stx.data.panelTree.peek()
  if (!currentTree) {
    dockToEdge(id, edge, ratio)
    return
  }

  const ids = collectPanelIds(currentTree).filter(i => i !== WORKSPACE_SENTINEL)
  if (ids.length === 0) {
    dockToEdge(id, edge, ratio)
    return
  }

  const targetId = (edge === 'left' || edge === 'top') ? ids[0] : ids[ids.length - 1]
  const direction = (edge === 'left' || edge === 'right') ? 'horizontal' : 'vertical'
  const insertBefore = edge === 'left' || edge === 'top'

  tilePanel(id, targetId, direction, ratio)

  if (insertBefore) {
    const tree = stx.data.panelTree.peek()
    if (!tree) return
    const result = findParent(tree, id)
    if (result && result.index === 1) {
      stx.data.panelTree.set(swapPanels(tree, id, targetId))
    }
  }
}
