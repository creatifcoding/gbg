/**
 * ChartStyler Service
 *
 * Layer 3 orchestrator that composes all primitive services.
 * Provides unified API for style generation.
 *
 * @module charts/styler/service
 */

import { Context, Effect, Layer, Schema } from 'effect';
import {
  PaletteService,
  PaletteServiceLive,
  TypographyService,
  TypographyServiceLive,
  AnimationService,
  AnimationServiceLive,
  type DataContext,
  type Typography,
  type AnimationConfig,
} from './services';
import { StylerInputError, NoStyleMatchError, type StylerError } from './errors';
import type { ChartCategory } from '../themes/palettes';

// =============================================================================
// Input/Output Schemas
// =============================================================================

/**
 * Input for style generation requests.
 */
export const StylerInputSchema = Schema.Struct({
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

export type StylerInput = typeof StylerInputSchema.Type;

/**
 * Output from style generation.
 */
export interface StylerOutput {
  readonly palette: string[];
  readonly typography: Typography;
  readonly animations: AnimationConfig;
  readonly confidence: number;
  readonly rationale: string;
}

// =============================================================================
// Chart Category Mapping
// =============================================================================

const TREND_CHARTS = ['Line', 'Area', 'Stock', 'DualAxes'];
const COMPARISON_CHARTS = ['Bar', 'Column', 'Radar', 'Rose', 'BidirectionalBar', 'Bullet'];
const PART_TO_WHOLE_CHARTS = ['Pie', 'Treemap', 'Sunburst', 'Funnel', 'CirclePacking'];
const DISTRIBUTION_CHARTS = ['Scatter', 'Histogram', 'Box', 'Violin', 'Heatmap'];
const FLOW_CHARTS = ['Sankey', 'Waterfall', 'FlowGraph', 'NetworkGraph'];
const KPI_CHARTS = ['Gauge', 'Liquid', 'RadialBar'];

function getChartCategory(chartType: string): ChartCategory {
  if (TREND_CHARTS.includes(chartType)) return 'trend';
  if (COMPARISON_CHARTS.includes(chartType)) return 'comparison';
  if (PART_TO_WHOLE_CHARTS.includes(chartType)) return 'part-to-whole';
  if (DISTRIBUTION_CHARTS.includes(chartType)) return 'distribution';
  if (FLOW_CHARTS.includes(chartType)) return 'flow';
  if (KPI_CHARTS.includes(chartType)) return 'comparison'; // Default for KPIs
  return 'comparison'; // Default fallback
}

// =============================================================================
// Service Interface
// =============================================================================

export interface ChartStyler {
  /**
   * Generate complete style configuration for a chart.
   */
  readonly generateStyle: (input: StylerInput) => Effect.Effect<StylerOutput, StylerError>;

  /**
   * Get palette for specific intent.
   */
  readonly getPaletteForIntent: (intent: string) => Effect.Effect<string[], StylerError>;

  /**
   * Get palette for chart category.
   */
  readonly getPaletteForCategory: (category: ChartCategory) => Effect.Effect<string[]>;

  /**
   * Get animation for chart type.
   */
  readonly getAnimationForChart: (chartType: string) => Effect.Effect<AnimationConfig>;

  /**
   * Get typography for chart type.
   */
  readonly getTypographyForChart: (chartType: string) => Effect.Effect<Typography>;
}

// =============================================================================
// Service Tag
// =============================================================================

export const ChartStyler = Context.GenericTag<ChartStyler>('charts/ChartStyler');

// =============================================================================
// Implementation Factory
// =============================================================================

export const makeChartStyler = Effect.gen(function* () {
  const palette = yield* PaletteService;
  const typography = yield* TypographyService;
  const animation = yield* AnimationService;

  return ChartStyler.of({
    generateStyle: (input) =>
      Effect.gen(function* () {
        // Validate input
        const validated = yield* Schema.decodeUnknown(StylerInputSchema)(input).pipe(
          Effect.mapError((e) => new StylerInputError({ message: String(e) }))
        );

        // Determine category and confidence
        const category = getChartCategory(validated.chartType);
        let confidence = 0.7;
        let rationale = `Style generated for ${validated.chartType}`;

        // Get palette based on intent or category
        let colors: string[];
        if (validated.intent) {
          colors = yield* palette.getPaletteForIntent(validated.intent);
          rationale += ` with intent: ${validated.intent}`;
          confidence = 0.85;
        } else if (validated.dataContext) {
          colors = yield* palette.derivePaletteFromData(validated.dataContext);
          rationale += ' derived from data context';
          confidence = 0.75;
        } else {
          colors = yield* palette.getPaletteForCategory(category);
          rationale += ` using ${category} category palette`;
        }

        // Get typography and animation
        const typo = yield* typography.getTypographyForChartType(validated.chartType);
        const anim = yield* animation.getAnimationForChartType(validated.chartType);

        return {
          palette: colors,
          typography: typo,
          animations: anim,
          confidence,
          rationale,
        } satisfies StylerOutput;
      }),

    getPaletteForIntent: (intent) => palette.getPaletteForIntent(intent),

    getPaletteForCategory: (category) => palette.getPaletteForCategory(category),

    getAnimationForChart: (chartType) => animation.getAnimationForChartType(chartType),

    getTypographyForChart: (chartType) => typography.getTypographyForChartType(chartType),
  });
});

// =============================================================================
// Layer
// =============================================================================

/**
 * Full ChartStyler layer with all dependencies.
 */
export const ChartStylerLive = Layer.effect(ChartStyler, makeChartStyler).pipe(
  Layer.provide(
    Layer.mergeAll(
      PaletteServiceLive,
      TypographyServiceLive,
      AnimationServiceLive,
    )
  )
);

// =============================================================================
// Standalone Runner
// =============================================================================

/**
 * Run a ChartStyler effect with all dependencies provided.
 */
export function runChartStyler<A, E>(
  effect: Effect.Effect<A, E, ChartStyler>
): Effect.Effect<A, E> {
  return effect.pipe(Effect.provide(ChartStylerLive));
}
