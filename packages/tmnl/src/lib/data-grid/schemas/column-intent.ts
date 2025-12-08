/**
 * Column Intent Schema
 *
 * Semantic column categorization for GridClass composition.
 * Column intents drive both visual styling and behavioral configuration.
 */

import { Schema } from 'effect'

// =============================================================================
// COLUMN INTENT
// =============================================================================

/**
 * Semantic role of a column in the grid.
 *
 * | Intent       | Description                          | Visual Behavior                  |
 * |--------------|--------------------------------------|----------------------------------|
 * | identifier   | Primary key / tracking ID            | Muted, small, monospace          |
 * | metric       | Numeric value for analysis           | Right-aligned, tabular-nums      |
 * | primaryMetric| Key metric with emphasis             | Right-aligned, heatmap/bar       |
 * | status       | Categorical state indicator          | Colored indicator + label        |
 * | severity     | Alert/warning level                  | Color-coded, flash-on-change     |
 * | action       | Interactive control (button, toggle) | Centered, pointer cursor         |
 * | drag         | Drag handle column                   | Fixed width, grab cursor         |
 * | text         | Generic text content                 | Left-aligned, ellipsis           |
 * | timestamp    | Date/time values                     | Monospace, muted                 |
 * | sparkline    | Inline mini-chart                    | Fixed width, no padding          |
 */
export const ColumnIntent = Schema.Literal(
  'identifier',
  'metric',
  'primaryMetric',
  'status',
  'severity',
  'action',
  'drag',
  'text',
  'timestamp',
  'sparkline'
)
export type ColumnIntent = typeof ColumnIntent.Type

// =============================================================================
// COLUMN INTENT METADATA
// =============================================================================

/**
 * Additional intent-specific configuration.
 */
export const ColumnIntentMeta = Schema.Struct({
  intent: ColumnIntent,
  /** Whether this column should flash on value change */
  flashOnChange: Schema.optional(Schema.Boolean),
  /** Whether values should use heatmap coloring */
  heatmap: Schema.optional(Schema.Boolean),
  /** Whether to show inline progress bar */
  progressBar: Schema.optional(Schema.Boolean),
  /** Custom width override (pixels) */
  width: Schema.optional(Schema.Number),
  /** Flex grow factor (overrides width) */
  flex: Schema.optional(Schema.Number),
  /** Suppress column from fit-to-size calculations */
  suppressSizeToFit: Schema.optional(Schema.Boolean),
})
export type ColumnIntentMeta = typeof ColumnIntentMeta.Type

// =============================================================================
// INTENT DEFAULTS
// =============================================================================

/**
 * Default styling and behavior hints per intent.
 * GridVariant uses these as a baseline, then applies overrides.
 */
export const INTENT_DEFAULTS: Record<ColumnIntent, Partial<ColumnIntentMeta>> = {
  identifier: {
    intent: 'identifier',
    width: 50,
    suppressSizeToFit: true,
    flashOnChange: false,
  },
  metric: {
    intent: 'metric',
    width: 80,
    flashOnChange: true,
  },
  primaryMetric: {
    intent: 'primaryMetric',
    width: 100,
    flashOnChange: true,
    heatmap: true,
    progressBar: true,
  },
  status: {
    intent: 'status',
    width: 90,
    flashOnChange: true,
  },
  severity: {
    intent: 'severity',
    width: 80,
    flashOnChange: true,
    heatmap: true,
  },
  action: {
    intent: 'action',
    width: 40,
    suppressSizeToFit: true,
    flashOnChange: false,
  },
  drag: {
    intent: 'drag',
    width: 28,
    suppressSizeToFit: true,
    flashOnChange: false,
  },
  text: {
    intent: 'text',
    flex: 1,
    flashOnChange: false,
  },
  timestamp: {
    intent: 'timestamp',
    width: 120,
    flashOnChange: false,
  },
  sparkline: {
    intent: 'sparkline',
    width: 80,
    suppressSizeToFit: true,
    flashOnChange: false,
  },
}

/**
 * Get default intent metadata.
 * @param intent - Column intent
 * @returns Default metadata for the intent
 */
export function getIntentDefaults(intent: ColumnIntent): Partial<ColumnIntentMeta> {
  return INTENT_DEFAULTS[intent]
}
