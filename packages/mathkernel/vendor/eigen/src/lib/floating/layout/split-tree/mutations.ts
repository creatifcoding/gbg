/**
 * SplitNode mutations — immutable tree transforms.
 *
 * @module floating/layout/split-tree/mutations
 */

import {
  isLeaf,
  leaf,
  split,
  type SplitNode,
  type SplitLeaf,
  type SplitBranch,
} from './types'
import { findParent } from './queries'

// =============================================================================
// Internal Helpers
// =============================================================================

/** Map over all leaves in the tree */
export function mapLeaves(
  node: SplitNode,
  fn: (leaf: SplitLeaf) => SplitNode,
): SplitNode {
  if (isLeaf(node)) return fn(node)
  const branch = node as SplitBranch
  const newLeft = mapLeaves(branch.children[0], fn)
  const newRight = mapLeaves(branch.children[1], fn)
  if (newLeft === branch.children[0] && newRight === branch.children[1]) return node
  return split(branch.direction, newLeft, newRight, branch.ratio)
}

/** Map over all splits in the tree */
export function mapSplits(
  node: SplitNode,
  fn: (split: SplitBranch) => SplitBranch,
): SplitNode {
  if (isLeaf(node)) return node
  const branch = fn(node as SplitBranch)
  const newLeft = mapSplits(branch.children[0], fn)
  const newRight = mapSplits(branch.children[1], fn)
  if (newLeft === branch.children[0] && newRight === branch.children[1]) return branch
  return { ...branch, children: [newLeft, newRight] }
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Insert a panel by splitting an existing leaf.
 */
export function insertBySplit(
  root: SplitNode,
  targetPanelId: string,
  newPanelId: string,
  direction: 'horizontal' | 'vertical',
  ratio = 0.5,
  insertBefore = false,
): SplitNode {
  return mapLeaves(root, (l) => {
    if (l.panelId !== targetPanelId) return l
    const existing = leaf(l.panelId)
    const incoming = leaf(newPanelId)
    return split(
      direction,
      insertBefore ? incoming : existing,
      insertBefore ? existing : incoming,
      ratio,
    )
  })
}

/**
 * Remove a panel from the tree.
 * Sibling replaces the parent split.
 */
export function removePanel(root: SplitNode, panelId: string): SplitNode | null {
  if (isLeaf(root)) {
    return root.panelId === panelId ? null : root
  }

  const branch = root as SplitBranch
  const [left, right] = branch.children

  if (isLeaf(left) && left.panelId === panelId) return right
  if (isLeaf(right) && right.panelId === panelId) return left

  const newLeft = removePanel(left, panelId)
  const newRight = removePanel(right, panelId)

  if (newLeft === null) return newRight
  if (newRight === null) return newLeft
  if (newLeft === left && newRight === right) return root

  return split(branch.direction, newLeft, newRight, branch.ratio)
}

/**
 * Replace one panel with another in the tree.
 */
export function replacePanel(
  root: SplitNode,
  oldPanelId: string,
  newPanelId: string,
): SplitNode {
  return mapLeaves(root, (l) =>
    l.panelId === oldPanelId ? leaf(newPanelId) : l,
  )
}

/**
 * Swap two panels in the tree.
 */
export function swapPanels(
  root: SplitNode,
  panelA: string,
  panelB: string,
): SplitNode {
  return mapLeaves(root, (l) => {
    if (l.panelId === panelA) return leaf(panelB)
    if (l.panelId === panelB) return leaf(panelA)
    return l
  })
}

/**
 * Update the ratio of a split containing a given panel.
 */
export function setSplitRatio(
  root: SplitNode,
  panelId: string,
  ratio: number,
): SplitNode {
  const result = findParent(root, panelId)
  if (!result) return root
  return mapSplits(root, (s) => {
    if (s === result.parent) {
      return split(s.direction, s.children[0], s.children[1], ratio)
    }
    return s
  })
}

/**
 * Move a separator by a pixel delta (translated to ratio delta).
 */
export function moveSeparator(
  root: SplitNode,
  panelId: string,
  delta: number,
  totalSize: number,
): SplitNode {
  if (totalSize <= 0) return root
  const result = findParent(root, panelId)
  if (!result) return root
  const ratioDelta = delta / totalSize
  const newRatio = result.parent.ratio + ratioDelta
  return mapSplits(root, (s) => {
    if (s === result.parent) {
      return split(s.direction, s.children[0], s.children[1], newRatio)
    }
    return s
  })
}

// =============================================================================
// Flatten same-direction children (for CSS Grid rendering)
// =============================================================================

/**
 * Flatten consecutive same-direction splits into a flat list of child nodes.
 */
export function flattenSameDirection(branch: SplitBranch): SplitNode[] {
  const result: SplitNode[] = []

  function collect(node: SplitNode): void {
    if (isLeaf(node)) {
      result.push(node)
      return
    }
    const b = node as SplitBranch
    if (b.direction === branch.direction) {
      collect(b.children[0])
      collect(b.children[1])
    } else {
      result.push(node)
    }
  }

  collect(branch.children[0])
  collect(branch.children[1])
  return result
}

/**
 * Build a balanced split tree from a flat list of panel IDs.
 */
export function buildFlatColumns(
  ids: string[],
  direction: 'horizontal' | 'vertical' = 'horizontal',
): SplitNode | null {
  if (ids.length === 0) return null
  if (ids.length === 1) return leaf(ids[0])
  if (ids.length === 2) return split(direction, leaf(ids[0]), leaf(ids[1]), 0.5)

  const mid = Math.ceil(ids.length / 2)
  const leftIds = ids.slice(0, mid)
  const rightIds = ids.slice(mid)
  const leftTree = buildFlatColumns(leftIds, direction)!
  const rightTree = buildFlatColumns(rightIds, direction)!
  const ratio = mid / ids.length
  return split(direction, leftTree, rightTree, ratio)
}
