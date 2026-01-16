/**
 * @module layout/schemas/breakpoint
 * @description Breakpoint conditions and layout breakpoint definitions
 */

import { Schema } from "effect"

/**
 * Minimum width condition - applies when container >= minWidth
 */
export class MinWidthCondition extends Schema.TaggedClass<MinWidthCondition>()(
  "MinWidthCondition",
  {
    minWidth: Schema.Number.pipe(
      Schema.positive({ message: () => "minWidth must be positive" })
    ),
  }
) {}

/**
 * Maximum width condition - applies when container <= maxWidth
 */
export class MaxWidthCondition extends Schema.TaggedClass<MaxWidthCondition>()(
  "MaxWidthCondition",
  {
    maxWidth: Schema.Number.pipe(
      Schema.positive({ message: () => "maxWidth must be positive" })
    ),
  }
) {}

/**
 * Range width condition - applies when minWidth <= container <= maxWidth
 */
export class RangeWidthCondition extends Schema.TaggedClass<RangeWidthCondition>()(
  "RangeWidthCondition",
  {
    minWidth: Schema.Number.pipe(Schema.positive()),
    maxWidth: Schema.Number.pipe(Schema.positive()),
  }
) {}

/**
 * Union of all breakpoint conditions
 */
export const BreakpointCondition = Schema.Union(
  MinWidthCondition,
  MaxWidthCondition,
  RangeWidthCondition
)

export type BreakpointCondition = typeof BreakpointCondition.Type

/**
 * Layout breakpoint definition
 * Specifies condition, grid template, and optional gap override
 */
export class LayoutBreakpoint extends Schema.Class<LayoutBreakpoint>(
  "LayoutBreakpoint"
)({
  /** Condition that determines when this breakpoint applies */
  condition: BreakpointCondition,
  /** CSS grid-template-columns value (e.g., "1fr 1fr", "repeat(3, 1fr)") */
  template: Schema.String.pipe(Schema.nonEmptyString()),
  /** Optional gap override for this breakpoint (in pixels) */
  gap: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
}) {}

/**
 * Array of layout breakpoints
 * Evaluated in order - first matching condition wins
 */
export const LayoutBreakpoints = Schema.Array(LayoutBreakpoint)

export type LayoutBreakpoints = typeof LayoutBreakpoints.Type

/**
 * Helper: Create a min-width breakpoint
 */
export const minWidth = (
  minWidth: number,
  template: string,
  gap?: number
): LayoutBreakpoint =>
  new LayoutBreakpoint({
    condition: new MinWidthCondition({ minWidth }),
    template,
    gap,
  })

/**
 * Helper: Create a max-width breakpoint
 */
export const maxWidth = (
  maxWidth: number,
  template: string,
  gap?: number
): LayoutBreakpoint =>
  new LayoutBreakpoint({
    condition: new MaxWidthCondition({ maxWidth }),
    template,
    gap,
  })

/**
 * Helper: Create a range breakpoint
 */
export const range = (
  minWidth: number,
  maxWidth: number,
  template: string,
  gap?: number
): LayoutBreakpoint =>
  new LayoutBreakpoint({
    condition: new RangeWidthCondition({ minWidth, maxWidth }),
    template,
    gap,
  })

/**
 * Common responsive breakpoint presets
 */
export const BREAKPOINT_PRESETS = {
  /** Mobile-first: single column until 768px, then 2 columns */
  twoColumn: [minWidth(768, "1fr 1fr")],
  /** Mobile-first: single column, 2 at 768px, 3 at 1024px */
  threeColumn: [minWidth(768, "1fr 1fr"), minWidth(1024, "repeat(3, 1fr)")],
  /** Desktop-first: 3 columns until 1024px, 2 until 768px, then 1 */
  desktopFirst: [
    maxWidth(768, "1fr"),
    maxWidth(1024, "1fr 1fr"),
  ],
} as const
