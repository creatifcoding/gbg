/**
 * @module layout/schemas/alignment
 * @description Alignment schemas shared across Grid, Stack, and Flex
 */

import { Schema } from "effect"

/**
 * Grid/Flex item alignment values
 */
export const AlignItems = Schema.Literal(
  "start",
  "end",
  "center",
  "stretch",
  "baseline"
)
export type AlignItems = typeof AlignItems.Type

/**
 * Grid/Flex content justification values
 */
export const JustifyContent = Schema.Literal(
  "start",
  "end",
  "center",
  "stretch",
  "space-between",
  "space-around",
  "space-evenly"
)
export type JustifyContent = typeof JustifyContent.Type

/**
 * Grid-specific placement values (for items)
 */
export const GridAlignment = Schema.Literal(
  "start",
  "end",
  "center",
  "stretch"
)
export type GridAlignment = typeof GridAlignment.Type

/**
 * Flex wrap values
 */
export const FlexWrap = Schema.Literal("nowrap", "wrap", "wrap-reverse")
export type FlexWrap = typeof FlexWrap.Type

/**
 * Layout direction (row vs column)
 */
export const LayoutDirection = Schema.Literal("row", "column")
export type LayoutDirection = typeof LayoutDirection.Type

/**
 * Extended direction with reverse options (for Flex)
 */
export const FlexDirection = Schema.Literal(
  "row",
  "column",
  "row-reverse",
  "column-reverse"
)
export type FlexDirection = typeof FlexDirection.Type
