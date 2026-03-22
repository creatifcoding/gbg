/**
 * @module layout/schemas/stack
 * @description Stack component props schema - linear flex layout
 */

import { Schema } from "effect"
import { AlignItems, JustifyContent, LayoutDirection } from "./alignment"
import { SpacingToken, SPACING_VALUES, type SpacingValue } from "./spacing"

/**
 * Stack props schema
 * A simple linear layout (vertical or horizontal) using flexbox
 */
export class StackProps extends Schema.Class<StackProps>("StackProps")({
  /** Layout direction */
  direction: Schema.optionalWith(LayoutDirection, {
    default: () => "column" as const,
  }),

  /** Gap between items (uses VANTA spacing tokens) */
  gap: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.filter(
        (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n)
      ),
      Schema.brand("SpacingToken")
    ),
    { default: () => 16 as SpacingToken }
  ),

  /** Align items on cross-axis */
  align: Schema.optionalWith(AlignItems, { default: () => "stretch" as const }),

  /** Justify content on main-axis */
  justify: Schema.optional(JustifyContent),

  /** Whether stack should fill available space */
  fill: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Optional CSS class */
  className: Schema.optional(Schema.String),

  /** Optional inline styles */
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * Shorthand: Vertical stack (column direction)
 */
export const VStackProps = Schema.Struct({
  gap: Schema.optional(SpacingToken),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

/**
 * Shorthand: Horizontal stack (row direction)
 */
export const HStackProps = Schema.Struct({
  gap: Schema.optional(SpacingToken),
  align: Schema.optional(AlignItems),
  justify: Schema.optional(JustifyContent),
  fill: Schema.optional(Schema.Boolean),
  className: Schema.optional(Schema.String),
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export type VStackProps = typeof VStackProps.Type
export type HStackProps = typeof HStackProps.Type
