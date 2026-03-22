/**
 * Chart Discriminator Schemas
 *
 * Effect Schema definitions for discriminator input/output contracts.
 * These schemas define the interface between user prompts and chart selection.
 *
 * @module charts/discriminator/schemas
 */

import { Schema } from 'effect';
import { ChartTypeSchema, type ChartType } from '../schemas/base';
import type { ChartCategory, DataShape } from '../registry/definitions';

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Data context provided to discriminator for chart selection
 */
export const DataContextSchema = Schema.Struct({
  /** Sample data shape (first few rows) */
  sample: Schema.optional(Schema.Array(Schema.Unknown)),

  /** Field names available in the data */
  fields: Schema.optional(Schema.Array(Schema.String)),

  /** Inferred data shape */
  inferredShape: Schema.optional(
    Schema.Literal(
      'categorical',
      'time-series',
      'hierarchical',
      'network',
      'distribution',
      'multi-series',
      'range',
      'single-value'
    )
  ),

  /** Number of data points */
  rowCount: Schema.optional(Schema.Number),

  /** Field types (e.g., { date: 'datetime', value: 'number' }) */
  fieldTypes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
});

export type DataContext = typeof DataContextSchema.Type;

/**
 * Constraints for chart selection
 */
export const SelectionConstraintsSchema = Schema.Struct({
  /** Preferred categories to consider */
  preferCategories: Schema.optional(
    Schema.Array(
      Schema.Literal(
        'comparison',
        'trend',
        'part-to-whole',
        'distribution',
        'ranking',
        'flow',
        'correlation',
        'kpi',
        'text',
        'hierarchical',
        'network'
      )
    )
  ),

  /** Categories to exclude */
  excludeCategories: Schema.optional(
    Schema.Array(
      Schema.Literal(
        'comparison',
        'trend',
        'part-to-whole',
        'distribution',
        'ranking',
        'flow',
        'correlation',
        'kpi',
        'text',
        'hierarchical',
        'network'
      )
    )
  ),

  /** Specific chart types to consider (whitelist) */
  onlyTypes: Schema.optional(Schema.Array(ChartTypeSchema)),

  /** Chart types to exclude (blacklist) */
  excludeTypes: Schema.optional(Schema.Array(ChartTypeSchema)),

  /** Maximum number of recommendations (default: 3) */
  maxRecommendations: Schema.optional(Schema.Number),

  /** Whether hierarchical/nested data support is required */
  requiresHierarchical: Schema.optional(Schema.Boolean),

  /** Whether series grouping is required */
  requiresSeriesSupport: Schema.optional(Schema.Boolean),
});

export type SelectionConstraints = typeof SelectionConstraintsSchema.Type;

/**
 * Full input to the Chart Discriminator
 */
export const DiscriminatorInputSchema = Schema.Struct({
  /** User's natural language prompt describing what they want to visualize */
  userPrompt: Schema.String,

  /** Optional data context for smarter selection */
  dataContext: Schema.optional(DataContextSchema),

  /** Optional constraints to narrow selection */
  constraints: Schema.optional(SelectionConstraintsSchema),
});

export type DiscriminatorInput = typeof DiscriminatorInputSchema.Type;

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * Single chart recommendation with config
 */
export const ChartRecommendationSchema = Schema.Struct({
  /** Selected chart type */
  chartType: ChartTypeSchema,

  /** Recommended configuration for this chart */
  config: Schema.Struct({
    /** X-axis field (if applicable) */
    xField: Schema.optional(Schema.String),
    /** Y-axis field (if applicable) */
    yField: Schema.optional(Schema.String),
    /** Series/grouping field */
    seriesField: Schema.optional(Schema.String),
    /** Color field */
    colorField: Schema.optional(Schema.String),
    /** Angle field (for pie/rose) */
    angleField: Schema.optional(Schema.String),
    /** Value/weight field */
    valueField: Schema.optional(Schema.String),
    /** Source field (for sankey) */
    sourceField: Schema.optional(Schema.String),
    /** Target field (for sankey) */
    targetField: Schema.optional(Schema.String),
    /** Additional suggested configuration */
    additional: Schema.optional(Schema.Unknown),
  }),

  /** Confidence score (0-1) */
  confidence: Schema.Number,

  /** Why this chart was selected */
  rationale: Schema.String,

  /** What this chart will show */
  expectedInsight: Schema.String,
});

export type ChartRecommendation = typeof ChartRecommendationSchema.Type;

/**
 * Mini-schema for downstream agents (scoped knowledge transfer)
 */
export const MiniSchemaSchema = Schema.Struct({
  /** Chart type name */
  type: ChartTypeSchema,

  /** Brief description */
  description: Schema.String,

  /** Category */
  category: Schema.String,

  /** Supported data shapes */
  dataShapes: Schema.Array(Schema.String),

  /** Required fields */
  requiredFields: Schema.Array(Schema.String),

  /** Supports series grouping */
  supportsSeriesGrouping: Schema.Boolean,

  /** Example usage hint */
  usageHint: Schema.String,
});

export type MiniSchema = typeof MiniSchemaSchema.Type;

/**
 * Full output from the Chart Discriminator
 */
export const DiscriminatorOutputSchema = Schema.Struct({
  /** Primary recommendation (highest confidence) */
  primary: ChartRecommendationSchema,

  /** Alternative recommendations (sorted by confidence descending) */
  alternatives: Schema.Array(ChartRecommendationSchema),

  /** Mini-schemas for recommended charts (for downstream agents) */
  miniSchemas: Schema.Array(MiniSchemaSchema),

  /** Categories that were considered */
  consideredCategories: Schema.Array(Schema.String),

  /** Overall reasoning about the selection */
  reasoning: Schema.String,

  /** Whether user prompt was ambiguous */
  wasAmbiguous: Schema.Boolean,

  /** If ambiguous, clarification questions */
  clarificationQuestions: Schema.optional(Schema.Array(Schema.String)),
});

export type DiscriminatorOutput = typeof DiscriminatorOutputSchema.Type;

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Discriminator error types
 */
export const DiscriminatorErrorSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('NoSuitableChart'),
    message: Schema.String,
    consideredOptions: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidInput'),
    message: Schema.String,
    field: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('AmbiguousRequest'),
    message: Schema.String,
    clarificationNeeded: Schema.Array(Schema.String),
  })
);

export type DiscriminatorError = typeof DiscriminatorErrorSchema.Type;
