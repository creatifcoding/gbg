/**
 * Grid Variant Schema
 *
 * Complete variant definition combining density, colors, and behavior.
 * Variants are the user-facing configuration surface.
 */

import { Schema } from 'effect'
import { DensityTier, DensityConfig } from './density'
import { ColorSemantics } from './color-semantics'
import { BehaviorConfig } from './behavior'
import { ColumnIntent, ColumnIntentMeta } from './column-intent'

// =============================================================================
// VARIANT ID
// =============================================================================

export const VariantId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('VariantId')
)
export type VariantId = typeof VariantId.Type

// =============================================================================
// TYPOGRAPHY CONFIG
// =============================================================================

export const TypographyConfig = Schema.Struct({
  /** Font family (CSS font-family value) */
  fontFamily: Schema.String,
  /** Letter spacing for headers */
  headerLetterSpacing: Schema.optional(Schema.String),
  /** Letter spacing for body text */
  bodyLetterSpacing: Schema.optional(Schema.String),
  /** Font weight for headers */
  headerFontWeight: Schema.optional(Schema.Number),
  /** Use tabular figures for numbers */
  tabularNums: Schema.optional(Schema.Boolean),
})
export type TypographyConfig = typeof TypographyConfig.Type

// =============================================================================
// INTENT OVERRIDES
// =============================================================================

/**
 * Per-intent styling overrides within a variant.
 */
export const IntentOverrides = Schema.Record({
  key: ColumnIntent,
  value: Schema.partial(ColumnIntentMeta),
})
export type IntentOverrides = typeof IntentOverrides.Type

// =============================================================================
// GRID VARIANT
// =============================================================================

/**
 * Complete grid variant definition.
 *
 * A variant combines:
 * - Density (sizing)
 * - Colors (appearance)
 * - Behavior (interaction)
 * - Typography (fonts)
 * - Intent overrides (per-column-type tweaks)
 */
export const GridVariant = Schema.Struct({
  /** Unique variant identifier */
  id: VariantId,
  /** Human-readable description */
  description: Schema.String,
  /** Density tier name */
  densityTier: DensityTier,
  /** Resolved density configuration (computed from tier) */
  density: DensityConfig,
  /** Color semantics */
  colors: ColorSemantics,
  /** Behavior configuration */
  behavior: BehaviorConfig,
  /** Typography configuration */
  typography: TypographyConfig,
  /** Per-intent overrides */
  intentOverrides: Schema.optional(IntentOverrides),
  /** AG-Grid theme color scheme */
  colorScheme: Schema.Literal('dark', 'light'),
})
export type GridVariant = typeof GridVariant.Type

// =============================================================================
// VARIANT PARTIAL (for user overrides)
// =============================================================================

/**
 * Partial variant for user customization.
 * All fields optional except id.
 */
export const GridVariantPartial = Schema.Struct({
  id: VariantId,
  description: Schema.optional(Schema.String),
  densityTier: Schema.optional(DensityTier),
  density: Schema.optional(Schema.partial(DensityConfig)),
  colors: Schema.optional(Schema.partial(ColorSemantics)),
  behavior: Schema.optional(Schema.partial(BehaviorConfig)),
  typography: Schema.optional(Schema.partial(TypographyConfig)),
  intentOverrides: Schema.optional(IntentOverrides),
  colorScheme: Schema.optional(Schema.Literal('dark', 'light')),
})
export type GridVariantPartial = typeof GridVariantPartial.Type
