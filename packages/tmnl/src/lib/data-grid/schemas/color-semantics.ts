/**
 * Color Semantics Schema
 *
 * Semantic color definitions for GridVariant.
 * Maps abstract roles to concrete colors.
 */

import { Schema } from 'effect'

// =============================================================================
// HEX COLOR
// =============================================================================

/**
 * Hex color string with validation.
 */
export const HexColor = Schema.String.pipe(
  Schema.pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/),
  Schema.brand('HexColor')
)
export type HexColor = typeof HexColor.Type

/**
 * RGBA color string.
 */
export const RgbaColor = Schema.String.pipe(
  Schema.pattern(/^rgba?\([^)]+\)$/),
  Schema.brand('RgbaColor')
)
export type RgbaColor = typeof RgbaColor.Type

/**
 * Any valid CSS color.
 */
export const CssColor = Schema.Union(HexColor, RgbaColor, Schema.String)
export type CssColor = typeof CssColor.Type

// =============================================================================
// BACKGROUND COLORS
// =============================================================================

export const BackgroundColors = Schema.Struct({
  /** Primary grid background */
  base: CssColor,
  /** Alternate row background (zebra striping) */
  alternateRow: Schema.optional(CssColor),
  /** Header row background */
  header: CssColor,
  /** Hover state background */
  hover: CssColor,
  /** Selected row background */
  selected: CssColor,
  /** Active/focused background */
  active: Schema.optional(CssColor),
})
export type BackgroundColors = typeof BackgroundColors.Type

// =============================================================================
// TEXT COLORS
// =============================================================================

export const TextColors = Schema.Struct({
  /** Primary text color */
  primary: CssColor,
  /** Secondary/muted text */
  secondary: CssColor,
  /** Muted/disabled text */
  muted: CssColor,
  /** Disabled text */
  disabled: Schema.optional(CssColor),
  /** Numeric emphasis (tabular figures) */
  numericEmphasis: Schema.optional(CssColor),
  /** Header text */
  header: CssColor,
})
export type TextColors = typeof TextColors.Type

// =============================================================================
// SIGNAL COLORS
// =============================================================================

export const SignalColors = Schema.Struct({
  /** Positive value / success / active */
  positive: CssColor,
  /** Negative value / error / inactive */
  negative: CssColor,
  /** Alert / critical */
  alert: CssColor,
  /** Warning / pending */
  warning: Schema.optional(CssColor),
  /** Neutral / default */
  neutral: Schema.optional(CssColor),
  /** Accent color (focus, selection border) */
  accent: CssColor,
})
export type SignalColors = typeof SignalColors.Type

// =============================================================================
// BORDER COLORS
// =============================================================================

export const BorderColors = Schema.Struct({
  /** Primary border */
  primary: CssColor,
  /** Subtle/muted border */
  muted: CssColor,
  /** Row separator */
  row: Schema.optional(CssColor),
  /** Column separator */
  column: Schema.optional(CssColor),
  /** Focus border */
  focus: Schema.optional(CssColor),
})
export type BorderColors = typeof BorderColors.Type

// =============================================================================
// FLASH COLORS
// =============================================================================

export const FlashColors = Schema.Struct({
  /** Flash color for value increase (positive) */
  up: CssColor,
  /** Flash color for value decrease (negative) */
  down: CssColor,
  /** Flash color for any change (neutral) */
  change: Schema.optional(CssColor),
  /** Flash duration in milliseconds */
  durationMs: Schema.Number.pipe(Schema.positive()),
})
export type FlashColors = typeof FlashColors.Type

// =============================================================================
// COMPLETE COLOR SEMANTICS
// =============================================================================

export const ColorSemantics = Schema.Struct({
  background: BackgroundColors,
  text: TextColors,
  signal: SignalColors,
  border: BorderColors,
  flash: Schema.optional(FlashColors),
})
export type ColorSemantics = typeof ColorSemantics.Type
