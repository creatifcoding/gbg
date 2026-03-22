/**
 * SplitNode binary tree — comprehensive test suite
 *
 * Gate: ≥20 test cases for split tree operations
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import {
  leaf,
  split,
  isLeaf,
  isSplit,
  collectPanelIds,
  countLeaves,
  findPath,
  getAtPath,
  findParent,
  findAdjacentPanel,
  insertBySplit,
  removePanel,
  replacePanel,
  swapPanels,
  setSplitRatio,
  moveSeparator,
  serialize,
  deserialize,
  flattenSameDirection,
  buildFlatColumns,
  type SplitNode,
  type SplitBranch,
} from '../split-tree'

// =============================================================================
// Fixtures
// =============================================================================

/** Simple 2-panel horizontal split: [A | B] */
const twoPanel = split('horizontal', leaf('A'), leaf('B'), 0.5)

/**
 * Complex 4-panel layout:
 *
 *   ┌─────┬─────────┐
 *   │     │    B     │
 *   │  A  ├─────────┤
 *   │     │    C     │
 *   └─────┴─────────┘
 *   + D floating (not in tree, but as leaf for testing)
 *
 * Tree: horizontal( A, vertical( B, C ) )
 */
const fourPanel = split(
  'horizontal',
  leaf('A'),
  split('vertical', leaf('B'), leaf('C'), 0.6),
  0.3,
)

/**
 * Deep nested tree (5 panels):
 *
 * horizontal(
 *   vertical( A, B ),
 *   horizontal( C, vertical( D, E ) )
 * )
 */
const deepTree = split(
  'horizontal',
  split('vertical', leaf('A'), leaf('B'), 0.5),
  split(
    'horizontal',
    leaf('C'),
    split('vertical', leaf('D'), leaf('E'), 0.5),
    0.4,
  ),
  0.5,
)

// =============================================================================
// Type Guards
// =============================================================================

describe('type guards', () => {
  it('isLeaf identifies leaf nodes', () => {
    expect(isLeaf(leaf('A'))).toBe(true)
    expect(isLeaf(twoPanel)).toBe(false)
  })

  it('isSplit identifies split nodes', () => {
    expect(isSplit(twoPanel)).toBe(true)
    expect(isSplit(leaf('X'))).toBe(false)
  })
})

// =============================================================================
// Constructors
// =============================================================================

describe('constructors', () => {
  it('leaf creates a leaf with _tag and panelId', () => {
    const l = leaf('test-panel')
    expect(l._tag).toBe('leaf')
    expect(l.panelId).toBe('test-panel')
  })

  it('split creates a branch with _tag, direction, children, ratio', () => {
    const s = split('vertical', leaf('X'), leaf('Y'), 0.7)
    expect(s._tag).toBe('split')
    expect(s.direction).toBe('vertical')
    expect(s.ratio).toBe(0.7)
    expect(s.children).toHaveLength(2)
  })

  it('split clamps ratio to [0.1, 0.9]', () => {
    expect(split('horizontal', leaf('A'), leaf('B'), 0).ratio).toBe(0.1)
    expect(split('horizontal', leaf('A'), leaf('B'), 1).ratio).toBe(0.9)
    expect(split('horizontal', leaf('A'), leaf('B'), -5).ratio).toBe(0.1)
    expect(split('horizontal', leaf('A'), leaf('B'), 99).ratio).toBe(0.9)
  })

  it('split defaults ratio to 0.5', () => {
    const s = split('horizontal', leaf('A'), leaf('B'))
    expect(s.ratio).toBe(0.5)
  })
})

// =============================================================================
// Queries
// =============================================================================

describe('collectPanelIds', () => {
  it('single leaf returns its id', () => {
    expect(collectPanelIds(leaf('solo'))).toEqual(['solo'])
  })

  it('two-panel split returns both ids left-to-right', () => {
    expect(collectPanelIds(twoPanel)).toEqual(['A', 'B'])
  })

  it('complex tree returns all ids depth-first', () => {
    expect(collectPanelIds(fourPanel)).toEqual(['A', 'B', 'C'])
  })

  it('deep tree returns all 5 ids', () => {
    expect(collectPanelIds(deepTree)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

describe('countLeaves', () => {
  it('leaf returns 1', () => {
    expect(countLeaves(leaf('X'))).toBe(1)
  })

  it('two-panel returns 2', () => {
    expect(countLeaves(twoPanel)).toBe(2)
  })

  it('deep tree returns 5', () => {
    expect(countLeaves(deepTree)).toBe(5)
  })
})

describe('findPath', () => {
  it('returns [] for root leaf', () => {
    expect(findPath(leaf('X'), 'X')).toEqual([])
  })

  it('returns null for missing panel', () => {
    expect(findPath(twoPanel, 'Z')).toBeNull()
  })

  it('finds left child at [0]', () => {
    expect(findPath(twoPanel, 'A')).toEqual([0])
  })

  it('finds right child at [1]', () => {
    expect(findPath(twoPanel, 'B')).toEqual([1])
  })

  it('finds deep nested panel', () => {
    // In deepTree: D is at right → right → left
    // horizontal( vertical(A,B), horizontal(C, vertical(D,E)) )
    // D path: [1, 1, 0]
    expect(findPath(deepTree, 'D')).toEqual([1, 1, 0])
  })
})

describe('getAtPath', () => {
  it('empty path returns root', () => {
    expect(getAtPath(deepTree, [])).toBe(deepTree)
  })

  it('returns leaf at valid path', () => {
    const node = getAtPath(deepTree, [0, 0])
    expect(node).not.toBeNull()
    expect(isLeaf(node!)).toBe(true)
    expect((node as any).panelId).toBe('A')
  })

  it('returns null for invalid path', () => {
    expect(getAtPath(leaf('X'), [0])).toBeNull()
    expect(getAtPath(deepTree, [2])).toBeNull()
  })
})

describe('findParent', () => {
  it('returns null for root leaf', () => {
    expect(findParent(leaf('X'), 'X')).toBeNull()
  })

  it('finds parent of direct child', () => {
    const result = findParent(twoPanel, 'A')
    expect(result).not.toBeNull()
    expect(result!.index).toBe(0)
    expect(result!.parent).toBe(twoPanel)
  })

  it('finds parent of nested child', () => {
    const result = findParent(fourPanel, 'C')
    expect(result).not.toBeNull()
    expect(result!.index).toBe(1)
    // Parent should be the vertical split (B, C)
    expect(result!.parent.direction).toBe('vertical')
  })

  it('returns null for missing panel', () => {
    expect(findParent(deepTree, 'MISSING')).toBeNull()
  })
})

describe('findAdjacentPanel', () => {
  it('finds right neighbor in horizontal split', () => {
    expect(findAdjacentPanel(twoPanel, 'A', 'right')).toBe('B')
  })

  it('finds left neighbor in horizontal split', () => {
    expect(findAdjacentPanel(twoPanel, 'B', 'left')).toBe('A')
  })

  it('returns null at edge (leftmost going left)', () => {
    expect(findAdjacentPanel(twoPanel, 'A', 'left')).toBeNull()
  })

  it('returns null at edge (rightmost going right)', () => {
    expect(findAdjacentPanel(twoPanel, 'B', 'right')).toBeNull()
  })

  it('finds vertical neighbor (down)', () => {
    // fourPanel: horizontal( A, vertical(B, C) )
    expect(findAdjacentPanel(fourPanel, 'B', 'down')).toBe('C')
  })

  it('finds vertical neighbor (up)', () => {
    expect(findAdjacentPanel(fourPanel, 'C', 'up')).toBe('B')
  })

  it('crosses from nested to sibling', () => {
    // B is in the right branch of horizontal split
    // Going left from B should reach A
    expect(findAdjacentPanel(fourPanel, 'B', 'left')).toBe('A')
  })
})

// =============================================================================
// Mutations
// =============================================================================

describe('insertBySplit', () => {
  it('splits a leaf into two panels', () => {
    const result = insertBySplit(leaf('A'), 'A', 'B', 'horizontal')
    expect(isSplit(result)).toBe(true)
    const s = result as SplitBranch
    expect(s.direction).toBe('horizontal')
    expect(collectPanelIds(result)).toEqual(['A', 'B'])
  })

  it('insertBefore puts new panel first', () => {
    const result = insertBySplit(leaf('A'), 'A', 'B', 'horizontal', 0.5, true)
    expect(collectPanelIds(result)).toEqual(['B', 'A'])
  })

  it('preserves the rest of the tree', () => {
    const result = insertBySplit(twoPanel, 'B', 'C', 'vertical')
    expect(collectPanelIds(result)).toEqual(['A', 'B', 'C'])
    // A should still be a leaf
    const root = result as SplitBranch
    expect(isLeaf(root.children[0])).toBe(true)
  })

  it('does nothing when target not found', () => {
    const result = insertBySplit(twoPanel, 'MISSING', 'C', 'horizontal')
    expect(result).toBe(twoPanel) // same reference — structural sharing
  })
})

describe('removePanel', () => {
  it('returns null when removing root leaf', () => {
    expect(removePanel(leaf('A'), 'A')).toBeNull()
  })

  it('returns sibling when removing from two-panel split', () => {
    const result = removePanel(twoPanel, 'A')
    expect(result).not.toBeNull()
    expect(isLeaf(result!)).toBe(true)
    expect((result as any).panelId).toBe('B')
  })

  it('collapses parent split when removing nested panel', () => {
    // fourPanel: horizontal( A, vertical(B, C) )
    // Remove B → horizontal( A, C )
    const result = removePanel(fourPanel, 'B')
    expect(result).not.toBeNull()
    expect(collectPanelIds(result!)).toEqual(['A', 'C'])
  })

  it('returns same reference when panel not found', () => {
    const result = removePanel(twoPanel, 'MISSING')
    expect(result).toBe(twoPanel)
  })
})

describe('replacePanel', () => {
  it('replaces a leaf panelId', () => {
    const result = replacePanel(twoPanel, 'A', 'X')
    expect(collectPanelIds(result)).toEqual(['X', 'B'])
  })

  it('returns same reference when panel not found', () => {
    const result = replacePanel(twoPanel, 'MISSING', 'X')
    expect(result).toBe(twoPanel)
  })
})

describe('swapPanels', () => {
  it('swaps two panel positions', () => {
    const result = swapPanels(twoPanel, 'A', 'B')
    expect(collectPanelIds(result)).toEqual(['B', 'A'])
  })

  it('works in deep trees', () => {
    const result = swapPanels(deepTree, 'A', 'E')
    const ids = collectPanelIds(result)
    expect(ids[0]).toBe('E') // was A
    expect(ids[4]).toBe('A') // was E
  })
})

describe('setSplitRatio', () => {
  it('updates the parent ratio of a panel', () => {
    const result = setSplitRatio(twoPanel, 'A', 0.3) as SplitBranch
    expect(result.ratio).toBe(0.3)
  })

  it('clamps ratio to valid range', () => {
    const result = setSplitRatio(twoPanel, 'A', 0.0) as SplitBranch
    expect(result.ratio).toBe(0.1)
  })

  it('returns same reference when panel not found', () => {
    expect(setSplitRatio(twoPanel, 'MISSING', 0.3)).toBe(twoPanel)
  })
})

describe('moveSeparator', () => {
  it('adjusts ratio by pixel delta', () => {
    // 50% ratio, total 1000px, move +100px → 60%
    const result = moveSeparator(twoPanel, 'A', 100, 1000) as SplitBranch
    expect(result.ratio).toBeCloseTo(0.6)
  })

  it('clamps to valid range on extreme delta', () => {
    const result = moveSeparator(twoPanel, 'A', 5000, 1000) as SplitBranch
    expect(result.ratio).toBe(0.9)
  })

  it('handles zero totalSize gracefully', () => {
    const result = moveSeparator(twoPanel, 'A', 100, 0)
    expect(result).toBe(twoPanel)
  })
})

// =============================================================================
// Serialization
// =============================================================================

describe('serialize / deserialize', () => {
  it('round-trips a leaf', () => {
    const l = leaf('test')
    const json = serialize(l)
    const restored = deserialize(json)
    expect(restored).toEqual(l)
  })

  it('round-trips a simple split', () => {
    const json = serialize(twoPanel)
    const restored = deserialize(json) as SplitBranch
    expect(restored._tag).toBe('split')
    expect(restored.direction).toBe('horizontal')
    expect(restored.ratio).toBe(0.5)
    expect(collectPanelIds(restored)).toEqual(['A', 'B'])
  })

  it('round-trips a deep tree', () => {
    const json = serialize(deepTree)
    const restored = deserialize(json)!
    expect(collectPanelIds(restored)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('deserialize returns null for invalid input', () => {
    expect(deserialize(null)).toBeNull()
    expect(deserialize(42)).toBeNull()
    expect(deserialize({})).toBeNull()
    expect(deserialize({ _tag: 'split', direction: 'invalid' })).toBeNull()
    expect(deserialize({ _tag: 'leaf' })).toBeNull() // missing panelId
  })

  it('serialized form is JSON-stringifiable', () => {
    const json = serialize(deepTree)
    const str = JSON.stringify(json)
    const parsed = JSON.parse(str)
    const restored = deserialize(parsed)!
    expect(collectPanelIds(restored)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

// =============================================================================
// Structural Sharing
// =============================================================================

describe('structural sharing', () => {
  it('unchanged branches return same references', () => {
    // Insert at B, A's subtree should be === same
    const result = insertBySplit(deepTree, 'E', 'F', 'horizontal') as SplitBranch
    // Left branch (vertical(A,B)) should be same reference
    expect(result.children[0]).toBe((deepTree as SplitBranch).children[0])
  })

  it('replacePanel preserves unrelated branches', () => {
    const result = replacePanel(deepTree, 'E', 'X') as SplitBranch
    // Left branch should be same reference
    expect(result.children[0]).toBe((deepTree as SplitBranch).children[0])
  })
})

// =============================================================================
// flattenSameDirection
// =============================================================================

describe('flattenSameDirection', () => {
  it('flattens consecutive horizontal splits', () => {
    // split(h, split(h, A, B), C) → [A, B, C]
    const tree = split('horizontal', split('horizontal', leaf('A'), leaf('B')), leaf('C'))
    const flat = flattenSameDirection(tree as SplitBranch)
    expect(flat).toHaveLength(3)
    expect(flat[0]).toEqual(leaf('A'))
    expect(flat[1]).toEqual(leaf('B'))
    expect(flat[2]).toEqual(leaf('C'))
  })

  it('stops at direction change', () => {
    // split(h, A, split(v, B, C)) → [A, split(v, B, C)]
    const vSplit = split('vertical', leaf('B'), leaf('C'))
    const tree = split('horizontal', leaf('A'), vSplit)
    const flat = flattenSameDirection(tree as SplitBranch)
    expect(flat).toHaveLength(2)
    expect(flat[0]).toEqual(leaf('A'))
    expect(flat[1]).toEqual(vSplit)
  })

  it('flattens deeply nested same direction', () => {
    // split(h, split(h, split(h, A, B), C), split(h, D, E))
    const tree = split('horizontal',
      split('horizontal', split('horizontal', leaf('A'), leaf('B')), leaf('C')),
      split('horizontal', leaf('D'), leaf('E'))
    )
    const flat = flattenSameDirection(tree as SplitBranch)
    expect(flat).toHaveLength(5)
    expect(flat.map((n: any) => n.panelId)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})

describe('buildFlatColumns', () => {
  it('returns null for empty', () => {
    expect(buildFlatColumns([])).toBeNull()
  })

  it('single panel → leaf', () => {
    const result = buildFlatColumns(['A'])
    expect(result).toEqual(leaf('A'))
  })

  it('two panels → balanced split', () => {
    const result = buildFlatColumns(['A', 'B'])!
    expect(isSplit(result)).toBe(true)
    const b = result as SplitBranch
    expect(b.ratio).toBe(0.5)
    expect(collectPanelIds(result)).toEqual(['A', 'B'])
  })

  it('five panels → all present, balanced', () => {
    const result = buildFlatColumns(['A', 'B', 'C', 'D', 'E'])!
    const ids = collectPanelIds(result)
    expect(ids).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('vertical direction', () => {
    const result = buildFlatColumns(['A', 'B'], 'vertical')!
    expect(isSplit(result)).toBe(true)
    expect((result as SplitBranch).direction).toBe('vertical')
  })
})
