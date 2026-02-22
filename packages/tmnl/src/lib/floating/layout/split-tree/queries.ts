/**
 * SplitNode queries — read-only tree traversal.
 *
 * @module floating/layout/split-tree/queries
 */

import { isLeaf, type SplitNode, type SplitBranch } from './types'

/** Collect all panel IDs in the tree (depth-first, left-to-right) */
export function collectPanelIds(node: SplitNode): string[] {
  if (isLeaf(node)) return [node.panelId]
  return [...collectPanelIds(node.children[0]), ...collectPanelIds(node.children[1])]
}

/** Count total leaves in the tree */
export function countLeaves(node: SplitNode): number {
  if (isLeaf(node)) return 1
  return countLeaves(node.children[0]) + countLeaves(node.children[1])
}

/** Find a leaf by panelId. Returns the path of indices (0 or 1) to reach it. */
export function findPath(node: SplitNode, panelId: string): number[] | null {
  if (isLeaf(node)) {
    return node.panelId === panelId ? [] : null
  }
  const left = findPath(node.children[0], panelId)
  if (left !== null) return [0, ...left]
  const right = findPath(node.children[1], panelId)
  if (right !== null) return [1, ...right]
  return null
}

/** Get the node at a given path */
export function getAtPath(node: SplitNode, path: readonly number[]): SplitNode | null {
  if (path.length === 0) return node
  if (isLeaf(node)) return null
  const [head, ...tail] = path
  if (head !== 0 && head !== 1) return null
  return getAtPath(node.children[head], tail)
}

/** Find the parent split of a panel. Returns [parentSplit, childIndex] or null. */
export function findParent(
  node: SplitNode,
  panelId: string,
): { parent: SplitBranch; index: 0 | 1 } | null {
  if (isLeaf(node)) return null
  for (const i of [0, 1] as const) {
    const child = node.children[i]
    if (isLeaf(child) && child.panelId === panelId) {
      return { parent: node as SplitBranch, index: i }
    }
    const deeper = findParent(child, panelId)
    if (deeper) return deeper
  }
  return null
}

/**
 * Find the adjacent panel in a given direction.
 */
export function findAdjacentPanel(
  root: SplitNode,
  panelId: string,
  direction: 'left' | 'right' | 'up' | 'down',
): string | null {
  const path = findPath(root, panelId)
  if (!path) return null

  const isHorizontal = direction === 'left' || direction === 'right'
  const wantFirst = direction === 'left' || direction === 'up'

  for (let depth = path.length - 1; depth >= 0; depth--) {
    const parentPath = path.slice(0, depth)
    const parent = getAtPath(root, parentPath)
    if (!parent || isLeaf(parent)) continue

    const branch = parent as SplitBranch
    const childIdx = path[depth]

    const splitIsHorizontal = branch.direction === 'horizontal'
    if (splitIsHorizontal !== isHorizontal) continue

    if (wantFirst && childIdx === 1) {
      return getEdgeLeaf(branch.children[0], wantFirst ? 'last' : 'first')
    }
    if (!wantFirst && childIdx === 0) {
      return getEdgeLeaf(branch.children[1], wantFirst ? 'last' : 'first')
    }
  }
  return null
}

/** Get the leftmost/topmost (first) or rightmost/bottommost (last) leaf in a subtree */
export function getEdgeLeaf(node: SplitNode, edge: 'first' | 'last'): string {
  if (isLeaf(node)) return node.panelId
  const idx = edge === 'first' ? 0 : 1
  return getEdgeLeaf(node.children[idx], edge)
}
