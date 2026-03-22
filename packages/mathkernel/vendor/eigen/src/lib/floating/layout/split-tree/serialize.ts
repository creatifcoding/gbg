/**
 * SplitNode serialization — JSON persistence.
 *
 * @module floating/layout/split-tree/serialize
 */

import { isLeaf, leaf, split, type SplitNode, type SplitBranch } from './types'

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
