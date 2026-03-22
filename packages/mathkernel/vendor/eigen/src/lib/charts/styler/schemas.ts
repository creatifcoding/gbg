/**
 * Chart Styler Schemas
 *
 * Effect Schema definitions for chart style state management.
 * Enables runtime validation, type inference, and Effect integration.
 *
 * @module charts/styler/schemas
 */

import * as Schema from 'effect/Schema';

// =============================================================================
// Branded Types
// =============================================================================

/**
 * Branded string type for chart style identifiers.
 * Ensures type safety when referencing per-chart style atoms.
 */
export const ChartStyleId = Schema.String.pipe(Schema.brand('ChartStyleId'));
export type ChartStyleId = typeof ChartStyleId.Type;

/**
 * Create a ChartStyleId from a string.
 */
export function makeChartStyleId(id: string): ChartStyleId {
  return id as ChartStyleId;
}

// =============================================================================
// Theme Variant
// =============================================================================

/**
 * Base theme variant - maps to system theme or explicit override.
 */
export const BaseThemeVariant = Schema.Literal('dark', 'light', 'system');
export type BaseThemeVariant = typeof BaseThemeVariant.Type;

// =============================================================================
// Typography Schema
// =============================================================================

/**
 * Typography configuration for chart text elements.
 */
export const TypographyConfig = Schema.Struct({
  /** Font family */
  family: Schema.String,
  /** Font size in pixels */
  size: Schema.Number,
  /** Font weight (optional) */
  weight: Schema.optional(Schema.Number),
});
export type TypographyConfig = typeof TypographyConfig.Type;

// =============================================================================
// Animation Schema
// =============================================================================

/**
 * Animation configuration for chart transitions.
 */
export const AnimationConfig = Schema.Struct({
  /** Appear animation config */
  appear: Schema.optional(
    Schema.Struct({
      animation: Schema.String,
      duration: Schema.Number,
      easing: Schema.optional(Schema.String),
    })
  ),
  /** Update animation config */
  update: Schema.optional(
    Schema.Struct({
      animation: Schema.String,
      duration: Schema.Number,
    })
  ),
  /** Enter animation config */
  enter: Schema.optional(
    Schema.Struct({
      animation: Schema.String,
      duration: Schema.Number,
    })
  ),
});
export type AnimationConfig = typeof AnimationConfig.Type;

// =============================================================================
// Axis Override Schema
// =============================================================================

/**
 * Partial axis configuration for style overrides.
 */
export const AxisOverride = Schema.Struct({
  /** Label font size */
  labelFontSize: Schema.optional(Schema.Number),
  /** Label font family */
  labelFontFamily: Schema.optional(Schema.String),
  /** Label color */
  labelFill: Schema.optional(Schema.String),
  /** Grid stroke color */
  gridStroke: Schema.optional(Schema.String),
  /** Grid stroke opacity */
  gridStrokeOpacity: Schema.optional(Schema.Number),
});
export type AxisOverride = typeof AxisOverride.Type;

// =============================================================================
// Chart Style State Schema
// =============================================================================

/**
 * Complete style state for a chart.
 * Represents the current styling configuration including any agent-applied overrides.
 */
export const ChartStyleState = Schema.Struct({
  /** Base theme variant */
  baseTheme: BaseThemeVariant,

  /** Custom color palette (overrides theme defaults) */
  colorPalette: Schema.NullOr(Schema.Array(Schema.String)),

  /** Typography overrides */
  typography: Schema.NullOr(TypographyConfig),

  /** Axis styling overrides */
  axis: Schema.NullOr(AxisOverride),

  /** Animation configuration */
  animations: Schema.NullOr(AnimationConfig),

  /** Styling intent (e.g., "emphasize-trend", "cyberpunk") */
  intent: Schema.NullOr(Schema.String),

  /** Confidence score from AI styler (0-1) */
  confidence: Schema.Number,

  /** Whether style is currently being streamed/updated */
  isStreaming: Schema.Boolean,

  /** Timestamp of last update */
  updatedAt: Schema.optional(Schema.Number),
});
export type ChartStyleState = typeof ChartStyleState.Type;

/**
 * Default style state - uses dark theme with no overrides.
 */
export const DEFAULT_STYLE_STATE: ChartStyleState = {
  baseTheme: 'dark',
  colorPalette: null,
  typography: null,
  axis: null,
  animations: null,
  intent: null,
  confidence: 0,
  isStreaming: false,
};

// =============================================================================
// Style Patch Schema
// =============================================================================

/**
 * Partial style update for streaming.
 * Used when style patches arrive incrementally.
 */
export const StylePatch = Schema.Struct({
  /** Partial palette update */
  colorPalette: Schema.optional(Schema.Array(Schema.String)),
  /** Partial typography update */
  typography: Schema.optional(TypographyConfig),
  /** Partial axis update */
  axis: Schema.optional(AxisOverride),
  /** Partial animation update */
  animations: Schema.optional(AnimationConfig),
  /** Intent being applied */
  intent: Schema.optional(Schema.String),
  /** Confidence score */
  confidence: Schema.optional(Schema.Number),
});
export type StylePatch = typeof StylePatch.Type;

// =============================================================================
// Styler Input/Output Schemas
// =============================================================================

/**
 * Input for style generation requests.
 */
export const StylerInput = Schema.Struct({
  /** Chart type being styled */
  chartType: Schema.String,
  /** Styling intent (optional) */
  intent: Schema.optional(Schema.String),
  /** Data context for smart palette selection (optional) */
  dataContext: Schema.optional(
    Schema.Struct({
      /** Field names in the data */
      fields: Schema.Array(Schema.String),
      /** Data shape (e.g., "time-series", "categorical") */
      shape: Schema.optional(Schema.String),
      /** Number of data rows */
      rowCount: Schema.optional(Schema.Number),
    })
  ),
});
export type StylerInput = typeof StylerInput.Type;

/**
 * Output from style generation.
 */
export const StylerOutput = Schema.Struct({
  /** Generated color palette */
  palette: Schema.Array(Schema.String),
  /** Typography configuration */
  typography: TypographyConfig,
  /** Animation configuration */
  animations: AnimationConfig,
  /** Confidence score (0-1) */
  confidence: Schema.Number,
  /** Rationale for the style choices */
  rationale: Schema.String,
});
export type StylerOutput = typeof StylerOutput.Type;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Apply a style patch to an existing state.
 */
export function applyStylePatch(
  state: ChartStyleState,
  patch: StylePatch
): ChartStyleState {
  return {
    ...state,
    colorPalette: patch.colorPalette ?? state.colorPalette,
    typography: patch.typography ?? state.typography,
    axis: patch.axis ?? state.axis,
    animations: patch.animations ?? state.animations,
    intent: patch.intent ?? state.intent,
    confidence: patch.confidence ?? state.confidence,
    updatedAt: Date.now(),
  };
}

/**
 * Reset style state to defaults while preserving base theme.
 */
export function resetStyleState(
  state: ChartStyleState
): ChartStyleState {
  return {
    ...DEFAULT_STYLE_STATE,
    baseTheme: state.baseTheme,
  };
}
