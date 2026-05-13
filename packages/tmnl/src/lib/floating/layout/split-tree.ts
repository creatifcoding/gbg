/**
 * SplitNode — recursive binary split tree for tiled panel layout
 *
 * Port of Soft-Machine's panel tree (§4.1):
 *   PanelTree = PanelLeaf | PanelSplit
 *
 * The tree is a pure data structure. All mutations return new trees
 * (structural sharing via spread). Legend-State observes the root
 * and React re-renders only changed branches.
 *
 * Invariants:
 *   - Every split has exactly 2 children
 *   - Leaves hold a panelId (string)
 *   - ratio ∈ (0, 1) — separator position
 *   - direction: 'horizontal' → side-by-side, 'vertical' → stacked
 *
 * @module
 */

import { Schema } from 'effect'
import { SplitDirection } from '../types'

// =============================================================================
// Schema Definitions
// =============================================================================

/** Leaf node — holds a single panel */
export const SplitLeaf = Schema.TaggedStruct('leaf', {
  panelId: Schema.String,
})
export type SplitLeaf = typeof SplitLeaf.Type

/**
 * Split node — binary split with ratio.
 *
 * NOTE: Effect Schema doesn't support direct recursive types,
 * so we define the runtime type separately and use the Schema
 * for leaf validation + serialization boundaries.
 */
export interface SplitBranch {
  readonly _tag: 'split'
  readonly direction: 'horizontal' | 'vertical'
  readonly children: readonly [SplitNode, SplitNode]
  readonly ratio: number
}

/** Union: a node in the split tree is either a leaf or a branch */
export type SplitNode = SplitLeaf | SplitBranch

// =============================================================================
// Constructors
// =============================================================================

/** Create a leaf node */
export function leaf(panelId: string): SplitLeaf {
  return { _tag: 'leaf', panelId }
}

/** Create a split node */
export function split(
  direction: 'horizontal' | 'vertical',
  first: SplitNode,
  second: SplitNode,
  ratio = 0.5,
): SplitBranch {
  return { _tag: 'split', direction, children: [first, second], ratio: clampRatio(ratio) }
}

// =============================================================================
// Queries
// =============================================================================

/** Check if node is a leaf */
export function isLeaf(node: SplitNode): node is SplitLeaf {
  return node._tag === 'leaf'
}

/** Check if node is a split */
export function isSplit(node: SplitNode): node is SplitBranch {
  return node._tag === 'split'
}

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
 * Returns the panelId of the neighbor, or null if at edge.
 */
export function findAdjacentPanel(
  root: SplitNode,
  panelId: string,
  direction: 'left' | 'right' | 'up' | 'down',
): string | null {
  const path = findPath(root, panelId)
  if (!path) return null

  // Walk up the path looking for a split that matches direction
  const isHorizontal = direction === 'left' || direction === 'right'
  const wantFirst = direction === 'left' || direction === 'up'

  for (let depth = path.length - 1; depth >= 0; depth--) {
    const parentPath = path.slice(0, depth)
    const parent = getAtPath(root, parentPath)
    if (!parent || isLeaf(parent)) continue

    const branch = parent as SplitBranch
    const childIdx = path[depth]

    // Does this split's direction match what we're looking for?
    const splitIsHorizontal = branch.direction === 'horizontal'
    if (splitIsHorizontal !== isHorizontal) continue

    // Are we on the side that can move in the desired direction?
    if (wantFirst && childIdx === 1) {
      // We're on the right/bottom, want to go left/up → take first child's rightmost/bottommost leaf
      return getEdgeLeaf(branch.children[0], wantFirst ? 'last' : 'first')
    }
    if (!wantFirst && childIdx === 0) {
      // We're on the left/top, want to go right/down → take second child's leftmost/topmost leaf
      return getEdgeLeaf(branch.children[1], wantFirst ? 'last' : 'first')
    }
  }
  return null
}

/** Get the leftmost/topmost (first) or rightmost/bottommost (last) leaf in a subtree */
function getEdgeLeaf(node: SplitNode, edge: 'first' | 'last'): string {
  if (isLeaf(node)) return node.panelId
  const idx = edge === 'first' ? 0 : 1
  return getEdgeLeaf(node.children[idx], edge)
}

// =============================================================================
// Mutations (immutable — return new trees)
// =============================================================================

/**
 * Insert a panel by splitting an existing leaf.
 *
 * The target leaf becomes a split with:
 *   - The original panel on one side
 *   - The new panel on the other
 *
 * @param direction - 'horizontal' or 'vertical' split
 * @param insertBefore - if true, new panel goes first (left/top)
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
 *
 * When a leaf is removed from a split, the sibling replaces the split.
 * If the root itself is the target leaf, returns null (empty tree).
 */
export function removePanel(root: SplitNode, panelId: string): SplitNode | null {
  if (isLeaf(root)) {
    return root.panelId === panelId ? null : root
  }

  const branch = root as SplitBranch
  const [left, right] = branch.children

  // Check if either direct child is the target leaf
  if (isLeaf(left) && left.panelId === panelId) return right
  if (isLeaf(right) && right.panelId === panelId) return left

  // Recurse into children
  const newLeft = removePanel(left, panelId)
  const newRight = removePanel(right, panelId)

  // If a child was removed entirely (shouldn't happen in well-formed trees), collapse
  if (newLeft === null) return newRight
  if (newRight === null) return newLeft

  // If nothing changed, return same reference (structural sharing)
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
 * Finds the parent split and sets its ratio.
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
 *
 * @param totalSize - total size in the split's direction (px)
 * @param delta - pixel delta to move
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
// Serialization (for persistence)
// =============================================================================

/** Serialize tree to JSON-safe object */
export function serialize(node: SplitNode): unknown {
  if (isLeaf(node)) {
    return { _tag: 'leaf' as const, panelId: node.panelId }
  }
  const branch = node as SplitBranch
  return {
    _tag: 'split' as const,
    direction: branch.direction,
    ratio: branch.ratio,
    children: [serialize(branch.children[0]), serialize(branch.children[1])],
  }
}

/** Deserialize from JSON. Returns null on invalid input. */
export function deserialize(data: unknown): SplitNode | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>

  if (obj._tag === 'leaf') {
    if (typeof obj.panelId !== 'string') return null
    return leaf(obj.panelId)
  }

  if (obj._tag === 'split') {
    const dir = obj.direction
    if (dir !== 'horizontal' && dir !== 'vertical') return null
    const ratio = typeof obj.ratio === 'number' ? obj.ratio : 0.5
    const children = obj.children
    if (!Array.isArray(children) || children.length !== 2) return null
    const left = deserialize(children[0])
    const right = deserialize(children[1])
    if (!left || !right) return null
    return split(dir, left, right, ratio)
  }

  return null
}

// =============================================================================
// Internal Helpers
// =============================================================================

/** Clamp ratio to valid range (0.1 .. 0.9) — prevents zero-size panels */
function clampRatio(ratio: number): number {
  return Math.max(0.1, Math.min(0.9, ratio))
}

/** Map over all leaves in the tree */
function mapLeaves(
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
function mapSplits(
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
