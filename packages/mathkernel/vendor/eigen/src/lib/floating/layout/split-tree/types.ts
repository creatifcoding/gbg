/**
 * SplitNode type definitions and constructors.
 *
 * @module floating/layout/split-tree/types
 */

import { Schema } from 'effect'

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
 * so we define the runtime type separately.
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

/** Clamp ratio to valid range (0.1 .. 0.9) — prevents zero-size panels */
export function clampRatio(ratio: number): number {
  return Math.max(0.1, Math.min(0.9, ratio))
}

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
// Type Guards
// =============================================================================

/** Check if node is a leaf */
export function isLeaf(node: SplitNode): node is SplitLeaf {
  return node._tag === 'leaf'
}

/** Check if node is a split */
export function isSplit(node: SplitNode): node is SplitBranch {
  return node._tag === 'split'
}
