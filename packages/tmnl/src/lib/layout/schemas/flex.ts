/**
 * @module layout/schemas/flex
 * @description Flex component props schema - full flexbox control
 */

import { Schema } from "effect"
import {
  AlignItems,
  FlexDirection,
  FlexWrap,
  JustifyContent,
} from "./alignment"
import { SpacingToken, SPACING_VALUES, type SpacingValue } from "./spacing"

/**
 * Flex props schema
 * Full flexbox control for advanced layouts
 */
export class FlexProps extends Schema.Class<FlexProps>("FlexProps")({
  /** Flex direction (with reverse options) */
  direction: Schema.optionalWith(FlexDirection, {
    default: () => "row" as const,
  }),

  /** Flex wrap behavior */
  wrap: Schema.optionalWith(FlexWrap, { default: () => "nowrap" as const }),

  /** Gap between items (uses VANTA spacing tokens) */
  gap: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.filter(
        (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n)
      ),
      Schema.brand("SpacingToken")
    ),
    { default: () => 0 as SpacingToken }
  ),

  /** Row gap (overrides gap for rows when wrap is enabled) */
  rowGap: Schema.optional(
    Schema.Number.pipe(
      Schema.filter(
        (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n)
      ),
      Schema.brand("SpacingToken")
    )
  ),

  /** Column gap (overrides gap for columns when wrap is enabled) */
  columnGap: Schema.optional(
    Schema.Number.pipe(
      Schema.filter(
        (n): n is SpacingValue => (SPACING_VALUES as readonly number[]).includes(n)
      ),
      Schema.brand("SpacingToken")
    )
  ),

  /** Align items on cross-axis */
  alignItems: Schema.optional(AlignItems),

  /** Align content (for multi-line flex containers) */
  alignContent: Schema.optional(JustifyContent),

  /** Justify content on main-axis */
  justifyContent: Schema.optional(JustifyContent),

  /** Whether flex should fill available space (flex: 1) */
  fill: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Whether to render as inline-flex */
  inline: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Optional CSS class */
  className: Schema.optional(Schema.String),

  /** Optional inline styles */
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * Flex item props (for children that need flex-specific properties)
 */
export class FlexItemProps extends Schema.Class<FlexItemProps>("FlexItemProps")({
  /** Flex grow factor */
  grow: Schema.optionalWith(Schema.Number, { default: () => 0 }),

  /** Flex shrink factor */
  shrink: Schema.optionalWith(Schema.Number, { default: () => 1 }),

  /** Flex basis */
  basis: Schema.optionalWith(Schema.String, { default: () => "auto" }),

  /** Align self (override parent's alignItems) */
  alignSelf: Schema.optional(AlignItems),

  /** Order (for reordering without changing DOM) */
  order: Schema.optional(Schema.Number.pipe(Schema.int())),

  /** Optional CSS class */
  className: Schema.optional(Schema.String),

  /** Optional inline styles */
  style: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}
