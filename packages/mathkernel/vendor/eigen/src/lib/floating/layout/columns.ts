/**
 * Column Model — top-level horizontal layout queries
 *
 * SM §4.4: Soft-Machine uses a column model for the top-level horizontal layout.
 * In TMNL, columns are derived from the split tree — a horizontal root split
 * naturally creates two columns, nested horizontal splits create more.
 *
 * This module provides column-centric queries over the split tree.
 *
 * @module
 */

import {
  type SplitNode,
  type SplitBranch,
  isLeaf,
  isSplit,
  collectPanelIds,
} from './split-tree'

// =============================================================================
// Types
// =============================================================================

export interface Column {
  /** Index in left-to-right order */
  index: number
  /** Panel IDs in this column (top-to-bottom order) */
  panelIds: string[]
  /** The subtree root for this column */
  node: SplitNode
  /** Relative width (0-1) based on split ratios */
  relativeWidth: number
}

// =============================================================================
// Column Extraction
// =============================================================================

/**
 * Extract top-level columns from the split tree.
 *
 * Walks the tree collecting horizontal splits at the root level.
 * Each horizontal split creates left/right columns.
 * Vertical splits within a column are treated as a single column.
 *
 * Example tree:
 *   horizontal( A, vertical(B, C) )
 *   → 2 columns: [A] and [B, C]
 *
 *   horizontal( horizontal(A, B), C )
 *   → 3 columns: [A], [B], [C]
 */
export function getColumns(tree: SplitNode | null): Column[] {
  if (!tree) return []
  if (isLeaf(tree)) {
    return [{
      index: 0,
      panelIds: [tree.panelId],
      node: tree,
      relativeWidth: 1,
    }]
  }

  const columns: Column[] = []
  flattenHorizontalSplits(tree, 1, columns)

  // Assign indices
  for (let i = 0; i < columns.length; i++) {
    columns[i].index = i
  }

  return columns
}

/**
 * Get the relative widths of all columns (0-1, sum to 1).
 */
export function getColumnWidths(tree: SplitNode | null): number[] {
  return getColumns(tree).map(c => c.relativeWidth)
}

/**
 * Get the number of top-level columns.
 */
export function getColumnCount(tree: SplitNode | null): number {
  return getColumns(tree).length
}

// =============================================================================
// Internal
// =============================================================================

/**
 * Recursively flatten horizontal splits into columns.
 * Vertical splits become single columns (their panels are stacked).
 */
function flattenHorizontalSplits(
  node: SplitNode,
  parentWidth: number,
  out: Column[],
): void {
  if (isLeaf(node)) {
    out.push({
      index: 0,
      panelIds: [node.panelId],
      node,
      relativeWidth: parentWidth,
    })
    return
  }

  const branch = node as SplitBranch

  if (branch.direction === 'horizontal') {
    // Horizontal split → recurse into left/right as separate columns
    const leftWidth = parentWidth * branch.ratio
    const rightWidth = parentWidth * (1 - branch.ratio)
    flattenHorizontalSplits(branch.children[0], leftWidth, out)
    flattenHorizontalSplits(branch.children[1], rightWidth, out)
  } else {
    // Vertical split → single column with all panels
    out.push({
      index: 0,
      panelIds: collectPanelIds(node),
      node,
      relativeWidth: parentWidth,
    })
  }
}
