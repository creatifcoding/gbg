/**
 * Strip types — flat column model where each column holds a SplitNode tree.
 *
 * Top level = horizontal strip of columns (virtualized scroll).
 * Each column = a recursive SplitNode tree (rendered by GridNode).
 *
 * Alt+- = hsplit within the focused column's tree
 * Alt+_ = vsplit within the focused column's tree
 *
 * @module floating/types/strip
 */

import { Schema } from 'effect'
import type { SplitNode } from '../layout/split-tree/types'
import { isLeaf, leaf } from '../layout/split-tree/types'
import { collectPanelIds } from '../layout/split-tree/queries'

// =============================================================================
// Column Width Presets
// =============================================================================

export const ColumnWidth = Schema.Literal('narrow', 'half', 'wide', 'full')
export type ColumnWidth = typeof ColumnWidth.Type

/** Viewport fraction per preset */
export const WIDTH_PRESETS: Record<ColumnWidth, number> = {
  narrow: 0.3,
  half: 0.5,
  wide: 0.7,
  full: 1.0,
}

/** Cycle order for Alt+D */
export const PRESET_CYCLE: readonly ColumnWidth[] = ['narrow', 'half', 'wide', 'full'] as const

// =============================================================================
// SplitNode Schema — recursive via Schema.suspend
// =============================================================================

type SplitNodeSchema = SplitLeafSchema | SplitBranchSchema
interface SplitLeafSchema {
  readonly _tag: 'leaf'
  readonly panelId: string
}
interface SplitBranchSchema {
  readonly _tag: 'split'
  readonly direction: 'horizontal' | 'vertical'
  readonly children: readonly [SplitNodeSchema, SplitNodeSchema]
  readonly ratio: number
}

const SplitLeafSchema = Schema.TaggedStruct('leaf', {
  panelId: Schema.String,
})

const SplitBranchSchema: Schema.Schema<SplitBranchSchema> = Schema.suspend(
  (): Schema.Schema<SplitBranchSchema> =>
    Schema.Struct({
      _tag: Schema.Literal('split'),
      direction: Schema.Literal('horizontal', 'vertical'),
      children: Schema.Tuple(SplitNodeS, SplitNodeS),
      ratio: Schema.Number,
    }) as unknown as Schema.Schema<SplitBranchSchema>
)

const SplitNodeS: Schema.Schema<SplitNodeSchema> = Schema.Union(
  SplitLeafSchema,
  SplitBranchSchema,
)

// =============================================================================
// Column — a slot in the strip, holding a full split tree
// =============================================================================

export const Column = Schema.Struct({
  tree: SplitNodeS as unknown as Schema.Schema<SplitNode>,
  width: ColumnWidth,
  isCollapsed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Override preset width — fraction of viewport (0..1). Set by promotion. */
  widthPct: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type Column = {
  readonly tree: SplitNode
  readonly width: ColumnWidth
  readonly isCollapsed: boolean
  /** When > 0, overrides preset width. Fraction of viewport. */
  readonly widthPct: number
}

// =============================================================================
// Strip — the top-level container
// =============================================================================

export const Strip = Schema.Struct({
  columns: Schema.Array(Column),
  focusedIndex: Schema.Number,
  scrollOffset: Schema.Number,
})
export type Strip = {
  readonly columns: readonly Column[]
  readonly focusedIndex: number
  readonly scrollOffset: number
}

// =============================================================================
// State Preservation Tier
// =============================================================================

export const StateTier = Schema.Literal('full', 'partial', 'stateless')
export type StateTier = typeof StateTier.Type

// =============================================================================
// Helpers
// =============================================================================

/** Get the "primary" panelId — first leaf in the tree */
export function getColumnPanelId(col: Column): string {
  const node = col.tree
  if (isLeaf(node)) return node.panelId
  // Walk to first leaf
  let current: SplitNode = node
  while (!isLeaf(current)) {
    current = (current as any).children[0]
  }
  return current.panelId
}

/** Get ALL panelIds in a column's tree */
export function getColumnPanelIds(col: Column): string[] {
  return collectPanelIds(col.tree)
}

/** Get all panelIds across all columns in a strip */
export function getAllStripPanelIds(strip: Strip): string[] {
  return strip.columns.flatMap(getColumnPanelIds)
}

/** Create a column from a single panelId */
export function singleColumn(panelId: string, width: ColumnWidth = 'half'): Column {
  return { tree: leaf(panelId), width, isCollapsed: false, widthPct: 0 }
}

/** Create a column from an existing tree */
export function treeColumn(tree: SplitNode, width: ColumnWidth = 'half'): Column {
  return { tree, width, isCollapsed: false, widthPct: 0 }
}

/** Create a column with explicit fractional width (for promotion) */
export function fractionalColumn(tree: SplitNode, pct: number, width: ColumnWidth = 'half'): Column {
  return { tree, width, isCollapsed: false, widthPct: pct }
}

/** Collapsed column width in pixels */
export const COLLAPSED_COLUMN_WIDTH = 36

/** Create an empty strip */
export function emptyStrip(): Strip {
  return { columns: [], focusedIndex: -1, scrollOffset: 0 }
}
