/**
 * @module layout/schemas/grid
 * @description Grid component props schema
 */

import { Schema } from "effect"
import { GridAlignment } from "./alignment"
import { LayoutBreakpoints } from "./breakpoint"
import { SpacingToken, SPACING_VALUES, type SpacingValue } from "./spacing"

/**
 * Grid props schema
 * Supports CSS Grid with responsive breakpoints and optional resize handles
 */
export class GridProps extends Schema.Class<GridProps>("GridProps")({
  /** Unique identifier for this grid instance (required for resize state) */
  id: Schema.String.pipe(Schema.nonEmptyString()),

  /**
   * Default CSS grid-template-columns value
   * Examples: "1fr", "1fr 1fr", "repeat(3, 1fr)", "200px 1fr 200px"
   */
  template: Schema.optionalWith(Schema.String, { default: () => "1fr" }),

  /**
   * Responsive breakpoints - evaluated in order, first match wins
   * If none match, uses default template
   */
  breakpoints: Schema.optionalWith(LayoutBreakpoints, { default: () => [] }),

  /** Gap between grid cells (uses VANTA spacing tokens) */
  gap: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.filter(
        (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n)
      ),
      Schema.brand("SpacingToken")
    ),
    { default: () => 16 as SpacingToken }
  ),

  /** Grid direction - affects template interpretation */
  direction: Schema.optionalWith(Schema.Literal("row", "column"), {
    default: () => "row" as const,
  }),

  /** Align items within their grid area (cross-axis) */
  alignItems: Schema.optional(GridAlignment),

  /** Justify items within their grid area (main-axis) */
  justifyItems: Schema.optional(GridAlignment),

  /** Enable drag-to-resize between cells */
  resizable: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Initial ratios for resizable grid (must match child count) */
  initialRatios: Schema.optional(Schema.Array(Schema.Number)),

  /** Minimum ratio for any cell when resizing */
  minRatio: Schema.optionalWith(Schema.Number, { default: () => 0.1 }),

  /** Callback when ratios change (for persistence) */
  // Note: callbacks not in schema, passed as separate props

  /** Optional CSS class */
  className: Schema.optional(Schema.String),

  /** Optional inline styles */
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * Evaluated grid state after breakpoint resolution
 */
export class GridState extends Schema.Class<GridState>("GridState")({
  /** Active template after breakpoint evaluation */
  activeTemplate: Schema.String,
  /** Active gap (from breakpoint or default) */
  activeGap: Schema.Number,
  /** Current container width */
  containerWidth: Schema.Number,
  /** Cell ratios for resizable grids */
  ratios: Schema.optional(Schema.Array(Schema.Number)),
}) {}

/**
 * Convert ratios to grid-template-columns
 * e.g., [0.5, 0.5] -> "1fr 1fr", [0.33, 0.67] -> "33fr 67fr"
 */
export const ratiosToTemplate = (ratios: number[]): string =>
  ratios.map((r) => `${Math.round(r * 100)}fr`).join(" ")

/**
 * Parse a template string to estimate column count
 * Note: This is a heuristic, not exact parsing
 */
export const estimateColumnCount = (template: string): number => {
  // Handle repeat() notation
  const repeatMatch = template.match(/repeat\((\d+),/)
  if (repeatMatch) return parseInt(repeatMatch[1], 10)

  // Count space-separated values
  return template.split(/\s+/).filter(Boolean).length
}
