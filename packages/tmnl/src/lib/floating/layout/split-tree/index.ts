/**
 * SplitNode — recursive binary split tree for tiled panel layout.
 *
 * Re-export barrel (decomposed from monolithic split-tree.ts).
 *
 * @module floating/layout/split-tree
 */

// ── Types & Constructors ────────────────────────────────────────────────────
export {
  SplitLeaf,
  type SplitBranch,
  type SplitNode,
  leaf,
  split,
  isLeaf,
  isSplit,
  clampRatio,
} from './types'

// ── Queries ─────────────────────────────────────────────────────────────────
export {
  collectPanelIds,
  countLeaves,
  findPath,
  getAtPath,
  findParent,
  findAdjacentPanel,
  getEdgeLeaf,
} from './queries'

// ── Mutations ───────────────────────────────────────────────────────────────
export {
  mapLeaves,
  mapSplits,
  insertBySplit,
  removePanel,
  replacePanel,
  swapPanels,
  setSplitRatio,
  moveSeparator,
  flattenSameDirection,
  buildFlatColumns,
} from './mutations'

// ── Serialization ───────────────────────────────────────────────────────────
export {
  serialize,
  deserialize,
} from './serialize'
