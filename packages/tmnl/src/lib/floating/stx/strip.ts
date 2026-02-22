/**
 * Strip mutations — O(1) index-aware operations on the flat Column[] model.
 *
 * All operations read/write the `strip` observable in stx directly.
 * No tree walks, no recursive traversals. Array index is the address.
 *
 * Index-aware insertion:
 *   insertColumn(panelId, { at: 3 })          — splice at exact index
 *   insertColumn(panelId, { after: 'focused' }) — insert after focused
 *   insertColumn(panelId, { before: 2 })       — insert before index 2
 *   insertColumn(panelId)                      — append (default)
 *
 * @module floating/stx/strip
 */

import { batch } from '@/lib/stx'
import { getFloatingStx } from './instance'
import type { Strip, Column, ColumnWidth } from '../types/strip'
import type { SplitNode } from '../layout/split-tree/types'
import { leaf, isLeaf } from '../layout/split-tree/types'
import { insertBySplit, removePanel as removeFromTree } from '../layout/split-tree/mutations'
import { collectPanelIds } from '../layout/split-tree/queries'
import {
  singleColumn,
  treeColumn,
  fractionalColumn,
  getColumnPanelId,
  getColumnPanelIds,
  WIDTH_PRESETS,
  PRESET_CYCLE,
  emptyStrip,
  COLLAPSED_COLUMN_WIDTH,
} from '../types/strip'

// =============================================================================
// Read helpers
// =============================================================================

/** Get current strip snapshot (peek, no subscription) */
export function peekStrip(): Strip {
  return getFloatingStx().data.strip.peek()
}

/** Get the focused column (or null) */
export function getFocusedColumn(): Column | null {
  const strip = peekStrip()
  return strip.columns[strip.focusedIndex] ?? null
}

/** Get the focused column's active panelId (or null) */
export function getFocusedPanelId(): string | null {
  const col = getFocusedColumn()
  return col ? getColumnPanelId(col) : null
}

/** Find the column index containing a panelId, or -1 */
export function findColumnIndex(panelId: string): number {
  const strip = peekStrip()
  return strip.columns.findIndex(col => getColumnPanelIds(col).includes(panelId))
}

/** Get column count */
export function getColumnCount(): number {
  return peekStrip().columns.length
}

// =============================================================================
// Insertion — index-aware
// =============================================================================

export type InsertPosition =
  | { at: number }            // Exact index (clamped to [0, length])
  | { after: number | 'focused' }    // Insert after index or after focused
  | { before: number | 'focused' }   // Insert before index or before focused
  // Omit → append

/**
 * Insert a new single column into the strip.
 *
 * O(1) amortized — single splice at computed index.
 * Focuses the new column after insertion.
 */
export function insertColumn(
  panelId: string,
  width: ColumnWidth = 'half',
  position?: InsertPosition,
): number {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()
  const cols = [...strip.columns]
  const col = singleColumn(panelId, width)

  const insertIdx = resolveInsertIndex(cols.length, strip.focusedIndex, position)

  cols.splice(insertIdx, 0, col)

  stx.data.strip.set({
    ...strip,
    columns: cols,
    focusedIndex: insertIdx,
  })

  return insertIdx
}

/**
 * Insert multiple columns at once (batch spawn).
 * Returns the index of the last inserted column.
 */
export function insertColumns(
  panels: Array<{ panelId: string; width?: ColumnWidth }>,
  position?: InsertPosition,
): number {
  if (panels.length === 0) return -1

  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()
  const cols = [...strip.columns]

  const startIdx = resolveInsertIndex(cols.length, strip.focusedIndex, position)
  const newCols = panels.map(p => singleColumn(p.panelId, p.width ?? 'half'))
  cols.splice(startIdx, 0, ...newCols)

  const lastInserted = startIdx + newCols.length - 1

  stx.data.strip.set({
    ...strip,
    columns: cols,
    focusedIndex: lastInserted,
  })

  return lastInserted
}

// =============================================================================
// Removal — index-aware
// =============================================================================

/**
 * Remove a column by index. Focus moves to adjacent.
 *
 * O(1) — single splice + clamp.
 */
export function removeColumnAt(index: number): string | null {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (index < 0 || index >= strip.columns.length) return null
  if (strip.columns.length <= 0) return null

  const removed = strip.columns[index]
  const removedPanelId = getColumnPanelId(removed)
  const cols = [...strip.columns]
  cols.splice(index, 1)

  // Clamp focus — prefer same index (shifts right neighbor into position),
  // fallback to last item
  const newFocus = cols.length === 0
    ? -1
    : Math.min(index, cols.length - 1)

  stx.data.strip.set({
    ...strip,
    columns: cols,
    focusedIndex: newFocus,
  })

  return removedPanelId
}

/**
 * Remove a column by panelId. Finds the column, removes it.
 */
export function removeColumn(panelId: string): boolean {
  const idx = findColumnIndex(panelId)
  if (idx === -1) return false
  removeColumnAt(idx)
  return true
}

/**
 * Remove the focused column.
 */
export function removeFocusedColumn(): string | null {
  const strip = peekStrip()
  if (strip.focusedIndex < 0) return null
  return removeColumnAt(strip.focusedIndex)
}

// =============================================================================
// Swap — O(1) array index swap
// =============================================================================

/**
 * Swap two columns by index. Both indices must be valid.
 *
 * O(1) — two array assignments.
 */
export function swapColumns(indexA: number, indexB: number): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (
    indexA < 0 || indexA >= strip.columns.length ||
    indexB < 0 || indexB >= strip.columns.length ||
    indexA === indexB
  ) return false

  const cols = [...strip.columns]
  ;[cols[indexA], cols[indexB]] = [cols[indexB], cols[indexA]]

  stx.data.strip.set({ ...strip, columns: cols })
  return true
}

/**
 * Swap focused column left. Focus follows.
 */
export function swapFocusedLeft(): boolean {
  const strip = peekStrip()
  if (strip.focusedIndex <= 0) return false
  const i = strip.focusedIndex
  const ok = swapColumns(i, i - 1)
  if (ok) setFocusedIndex(i - 1)
  return ok
}

/**
 * Swap focused column right. Focus follows.
 */
export function swapFocusedRight(): boolean {
  const strip = peekStrip()
  if (strip.focusedIndex >= strip.columns.length - 1) return false
  const i = strip.focusedIndex
  const ok = swapColumns(i, i + 1)
  if (ok) setFocusedIndex(i + 1)
  return ok
}

// =============================================================================
// Move — remove + insert at new index (reorder)
// =============================================================================

/**
 * Move a column from one index to another.
 * O(1) amortized — splice out, splice in.
 */
export function moveColumn(fromIndex: number, toIndex: number): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (
    fromIndex < 0 || fromIndex >= strip.columns.length ||
    toIndex < 0 || toIndex >= strip.columns.length ||
    fromIndex === toIndex
  ) return false

  const cols = [...strip.columns]
  const [moved] = cols.splice(fromIndex, 1)
  cols.splice(toIndex, 0, moved)

  const newFocus = strip.focusedIndex === fromIndex
    ? toIndex
    : strip.focusedIndex

  stx.data.strip.set({ ...strip, columns: cols, focusedIndex: newFocus })
  return true
}

// =============================================================================
// Focus — index navigation
// =============================================================================

/**
 * Set focused column index directly.
 */
export function setFocusedIndex(index: number): void {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()
  const clamped = Math.max(-1, Math.min(index, strip.columns.length - 1))

  if (clamped === strip.focusedIndex) return

  batch(() => {
    stx.data.strip.focusedIndex.set(clamped)
    // Sync activePanel in main stx for cross-system compat
    if (clamped >= 0) {
      const col = strip.columns[clamped]
      if (col) stx.data.activePanel.set(getColumnPanelId(col))
    }
  })
}

/**
 * Focus left. Clamps at 0.
 */
export function focusLeft(): void {
  const strip = peekStrip()
  setFocusedIndex(Math.max(0, strip.focusedIndex - 1))
}

/**
 * Focus right. Clamps at length - 1.
 */
export function focusRight(): void {
  const strip = peekStrip()
  setFocusedIndex(Math.min(strip.columns.length - 1, strip.focusedIndex + 1))
}

/**
 * Focus by panelId — find column and focus it.
 */
export function focusPanelInStrip(panelId: string): boolean {
  const idx = findColumnIndex(panelId)
  if (idx === -1) return false
  setFocusedIndex(idx)
  return true
}

// =============================================================================
// Column Width — cycle presets
// =============================================================================

/**
 * Cycle width preset on a column at index.
 * narrow → half → wide → full → narrow → ...
 */
export function cycleColumnWidth(index: number): ColumnWidth | null {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (index < 0 || index >= strip.columns.length) return null

  const col = strip.columns[index]
  const currentIdx = PRESET_CYCLE.indexOf(col.width)
  const nextWidth = PRESET_CYCLE[(currentIdx + 1) % PRESET_CYCLE.length]

  const cols = [...strip.columns]
  // Clear widthPct — explicit preset cycle takes authority
  cols[index] = { ...col, width: nextWidth, widthPct: 0 }

  stx.data.strip.set({ ...strip, columns: cols })
  return nextWidth
}

/**
 * Cycle width on focused column.
 */
export function cycleFocusedWidth(): ColumnWidth | null {
  const strip = peekStrip()
  if (strip.focusedIndex < 0) return null
  return cycleColumnWidth(strip.focusedIndex)
}

/**
 * Set exact width on a column at index.
 */
export function setColumnWidth(index: number, width: ColumnWidth): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (index < 0 || index >= strip.columns.length) return false

  const col = strip.columns[index]
  if (col.width === width) return true

  const cols = [...strip.columns]
  cols[index] = { ...col, width, widthPct: 0 }

  stx.data.strip.set({ ...strip, columns: cols })
  return true
}

// =============================================================================
// Push/Pop — array-level column operations
// =============================================================================

/**
 * Push a new tree-column into the strip.
 * Like insertColumn but accepts a full SplitNode tree.
 */
export function pushTreeColumn(
  tree: SplitNode,
  width: ColumnWidth = 'half',
  position?: InsertPosition,
): number {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()
  const cols = [...strip.columns]
  const col = treeColumn(tree, width)

  const insertIdx = resolveInsertIndex(cols.length, strip.focusedIndex, position)
  cols.splice(insertIdx, 0, col)

  stx.data.strip.set({
    ...strip,
    columns: cols,
    focusedIndex: insertIdx,
  })

  return insertIdx
}

/**
 * Pop a column from the strip by index. Returns the column's tree or null.
 */
export function popColumn(index?: number): SplitNode | null {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  const idx = index ?? strip.focusedIndex
  if (idx < 0 || idx >= strip.columns.length) return null

  const removed = strip.columns[idx]
  const cols = [...strip.columns]
  cols.splice(idx, 1)

  const newFocus = cols.length === 0
    ? -1
    : Math.min(idx, cols.length - 1)

  stx.data.strip.set({ ...strip, columns: cols, focusedIndex: newFocus })
  return removed.tree
}

// =============================================================================
// Horizontal Promotion — unfold h-splits at column root into strip columns
// =============================================================================

/**
 * If a column's tree root is a horizontal split, promote each horizontal
 * child to its own strip column. The strip IS the horizontal projection.
 *
 * Example: column { tree: split(h, A, B) } → two columns [{ tree: A }, { tree: B }]
 * Nested: split(h, split(h, A, B), C) → three columns [A, B, C]
 *
 * Vertical roots are left alone — they stay inside one column.
 */
export function promoteHorizontalToStrip(columnIndex: number): void {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (columnIndex < 0 || columnIndex >= strip.columns.length) return

  const col = strip.columns[columnIndex]
  if (isLeaf(col.tree)) return // Single panel — nothing to promote
  if (col.tree._tag !== 'split' || col.tree.direction !== 'horizontal') return // Vertical — keep

  // Collect horizontal children (recursively flatten same-direction)
  const hChildren = flattenHorizontal(col.tree)

  // Compute the original column's pixel fraction of viewport
  const parentPct = col.widthPct > 0 ? col.widthPct : WIDTH_PRESETS[col.width]
  const childPct = parentPct / hChildren.length

  // Replace the single column with N columns sharing the original footprint
  const newColumns: Column[] = hChildren.map(child =>
    fractionalColumn(child, childPct, col.width),
  )

  const cols = [...strip.columns]
  cols.splice(columnIndex, 1, ...newColumns)

  // Focus the column that contains the currently active panel
  const activeId = stx.data.activePanel.peek()
  let newFocus = columnIndex
  if (activeId) {
    const idx = cols.findIndex(c => getColumnPanelIds(c).includes(activeId))
    if (idx >= 0) newFocus = idx
  }

  stx.data.strip.set({ ...strip, columns: cols, focusedIndex: newFocus })
}

/** Recursively flatten horizontal splits into a list of vertical subtrees */
function flattenHorizontal(node: SplitNode): SplitNode[] {
  if (isLeaf(node)) return [node]
  if (node._tag === 'split' && node.direction === 'horizontal') {
    return [
      ...flattenHorizontal(node.children[0]),
      ...flattenHorizontal(node.children[1]),
    ]
  }
  // Vertical split or other — keep as single subtree
  return [node]
}

/**
 * Structural invariant: normalize ALL columns — promote any horizontal roots.
 * Call after any mutation that could introduce horizontal splits.
 */
export function normalizeStrip(): void {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()
  let changed = false
  let newCols: Column[] = []

  for (const col of strip.columns) {
    if (!isLeaf(col.tree) && col.tree._tag === 'split' && col.tree.direction === 'horizontal') {
      changed = true
      const hChildren = flattenHorizontal(col.tree)
      const parentPct = col.widthPct > 0 ? col.widthPct : WIDTH_PRESETS[col.width]
      const childPct = parentPct / hChildren.length
      for (const child of hChildren) {
        newCols.push(fractionalColumn(child, childPct, col.width))
      }
    } else {
      newCols.push(col)
    }
  }

  if (changed) {
    const activeId = stx.data.activePanel.peek()
    let newFocus = strip.focusedIndex
    if (activeId) {
      const idx = newCols.findIndex(c => getColumnPanelIds(c).includes(activeId))
      if (idx >= 0) newFocus = idx
    }
    stx.data.strip.set({ ...strip, columns: newCols, focusedIndex: newFocus })
  }
}

// =============================================================================
// Column Tree Operations — split/remove within a column's tree
// =============================================================================

/**
 * Split a panel within a column's tree (hsplit or vsplit).
 * The column's tree grows — new panel is inserted via insertBySplit.
 * Returns the new panelId position or false on failure.
 */
export function splitInColumn(
  columnIndex: number,
  targetPanelId: string,
  newPanelId: string,
  direction: 'horizontal' | 'vertical',
  insertBefore = false,
): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (columnIndex < 0 || columnIndex >= strip.columns.length) return false

  const col = strip.columns[columnIndex]
  const newTree = insertBySplit(col.tree, targetPanelId, newPanelId, direction, 0.5, insertBefore)

  const cols = [...strip.columns]
  cols[columnIndex] = { ...col, tree: newTree }

  stx.data.strip.set({ ...strip, columns: cols })

  // Structural invariant: promote any horizontal roots
  normalizeStrip()
  return true
}

/**
 * Remove a panel from a column's tree.
 * If the tree becomes empty (single leaf removed), removes the entire column.
 * If the tree has one remaining leaf after removal, simplifies back to leaf.
 */
export function removeFromColumnTree(
  columnIndex: number,
  panelId: string,
): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (columnIndex < 0 || columnIndex >= strip.columns.length) return false

  const col = strip.columns[columnIndex]

  // If the column is just this one panel, remove the whole column
  if (isLeaf(col.tree) && col.tree.panelId === panelId) {
    removeColumnAt(columnIndex)
    return true
  }

  // Remove from the column's tree
  const newTree = removeFromTree(col.tree, panelId)
  if (!newTree) {
    // Tree is now empty — remove the column
    removeColumnAt(columnIndex)
    return true
  }

  const cols = [...strip.columns]
  cols[columnIndex] = { ...col, tree: newTree }
  stx.data.strip.set({ ...strip, columns: cols })
  return true
}

// =============================================================================
// Collapse — direction-aware
// =============================================================================

/**
 * Toggle collapse on a column at index.
 * Collapsed columns render as 36px thin strips (column-wise in horizontal strip).
 */
export function toggleColumnCollapsed(index: number): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (index < 0 || index >= strip.columns.length) return false

  const col = strip.columns[index]
  const cols = [...strip.columns]
  cols[index] = { ...col, isCollapsed: !col.isCollapsed }

  stx.data.strip.set({ ...strip, columns: cols })
  return true
}

/**
 * Toggle collapse on the focused column.
 */
export function toggleFocusedCollapsed(): boolean {
  const strip = peekStrip()
  if (strip.focusedIndex < 0) return false
  return toggleColumnCollapsed(strip.focusedIndex)
}

/**
 * Set collapse state explicitly.
 */
export function setColumnCollapsed(index: number, collapsed: boolean): boolean {
  const stx = getFloatingStx()
  const strip = stx.data.strip.peek()

  if (index < 0 || index >= strip.columns.length) return false

  const col = strip.columns[index]
  if (col.isCollapsed === collapsed) return true

  const cols = [...strip.columns]
  cols[index] = { ...col, isCollapsed: collapsed }

  stx.data.strip.set({ ...strip, columns: cols })

  // Sync panel-level isCollapsed flags so tree mode stays consistent
  const panelIds = getColumnPanelIds(col)
  for (const pid of panelIds) {
    const panelObs = stx.data.panels.get(pid)
    if (panelObs) {
      panelObs.isCollapsed.set(collapsed)
    }
  }

  return true
}

// =============================================================================
// Scroll offset — persisted for Virtuoso restoreStateFrom
// =============================================================================

/**
 * Update the stored scroll offset.
 */
export function setScrollOffset(offset: number): void {
  getFloatingStx().data.strip.scrollOffset.set(offset)
}

// =============================================================================
// Bulk — replace entire strip (for initialization, restore, etc.)
// =============================================================================

/**
 * Replace the entire strip state.
 */
export function setStrip(strip: Strip): void {
  getFloatingStx().data.strip.set(strip)
}

/**
 * Clear the strip to empty.
 */
export function clearStrip(): void {
  getFloatingStx().data.strip.set(emptyStrip())
}

// =============================================================================
// Internal — resolve insertion index from InsertPosition
// =============================================================================

function resolveInsertIndex(
  length: number,
  focusedIndex: number,
  position?: InsertPosition,
): number {
  if (!position) return length // Default: append

  if ('at' in position) {
    return Math.max(0, Math.min(position.at, length))
  }

  if ('after' in position) {
    const ref = position.after === 'focused' ? focusedIndex : position.after
    if (ref < 0 || ref >= length) return length // Append if invalid
    return ref + 1
  }

  if ('before' in position) {
    const ref = position.before === 'focused' ? focusedIndex : position.before
    if (ref < 0 || ref >= length) return 0 // Prepend if invalid
    return ref
  }

  return length
}
