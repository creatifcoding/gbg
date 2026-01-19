/**
 * Base Chart Schemas
 *
 * Effect Schema definitions shared across all chart types.
 * Provides common props like data, theme, dimensions, etc.
 *
 * @module charts/schemas/base
 */

import { Schema } from 'effect';

// =============================================================================
// Chart Type Enum
// =============================================================================

/**
 * All supported Ant Design chart types.
 *
 * Categories:
 * - Statistical (27): Standard data visualization
 * - Relational (8): Network and hierarchy visualization
 *
 * Note: Tiny charts (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2.
 * Use regular charts with compact height for similar effects.
 */
export const ChartTypeSchema = Schema.Literal(
  // Statistical Charts (27)
  'Line',
  'Bar',
  'Column',
  'Area',
  'Pie',
  'DualAxes',
  'Scatter',
  'Radar',
  'Rose',
  'Funnel',
  'Waterfall',
  'Histogram',
  'Heatmap',
  'Box',
  'Sankey',
  'Stock',
  'Gauge',
  'Liquid',
  'Bullet',
  'WordCloud',
  'Treemap',
  'RadialBar',
  'CirclePacking',
  'Violin',
  'BidirectionalBar',
  'Venn',
  'Sunburst',
  // Relational Charts (8) - from @ant-design/graphs
  'FlowGraph',
  'NetworkGraph',
  'OrganizationChart',
  'MindMap',
  'IndentedTree',
  'Dendrogram',
  'Fishbone',
  'FlowDirectionGraph'
);

export type ChartType = typeof ChartTypeSchema.Type;

// =============================================================================
// Theme Schema
// =============================================================================

export const ChartThemeSchema = Schema.Literal('light', 'dark', 'academy', 'classic');

// =============================================================================
// Data Source Schema
// =============================================================================

/**
 * Data can be provided inline or via a path reference.
 * - `data`: Inline array of data objects
 * - `dataPath`: Reference to data source (e.g., 'blocks.myDataGrid.selectedRows')
 */
export const DataSourceSchema = Schema.Struct({
  data: Schema.optional(Schema.Array(Schema.Unknown)),
  dataPath: Schema.optional(Schema.String),
});

// =============================================================================
// Base Chart Props Schema
// =============================================================================

/**
 * Base props shared by all chart types.
 *
 * @example
 * ```typescript
 * const config = {
 *   chartType: 'Line',
 *   data: [{ x: 1, y: 10 }, { x: 2, y: 20 }],
 *   autoFit: true,
 *   theme: 'dark',
 *   height: 400,
 * }
 * ```
 */
export const BaseChartPropsSchema = Schema.Struct({
  /** Chart type identifier */
  chartType: ChartTypeSchema,

  /** Inline data array */
  data: Schema.optional(Schema.Array(Schema.Unknown)),

  /** Path reference to data source */
  dataPath: Schema.optional(Schema.String),

  /** Auto-fit container dimensions */
  autoFit: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Chart theme */
  theme: Schema.optional(ChartThemeSchema),

  /** Fixed width in pixels */
  width: Schema.optional(Schema.Number),

  /** Fixed height in pixels */
  height: Schema.optional(Schema.Number),

  /** Chart padding [top, right, bottom, left] or single value */
  padding: Schema.optional(
    Schema.Union(
      Schema.Number,
      Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)
    )
  ),

  /** Animation configuration */
  animation: Schema.optional(Schema.Boolean),

  /** Custom CSS class */
  className: Schema.optional(Schema.String),
});

export type BaseChartProps = typeof BaseChartPropsSchema.Type;

// =============================================================================
// Relational Base Props (for network/graph charts with different data shape)
// =============================================================================

/**
 * Base props for relational charts that use nodes/edges data.
 *
 * Excludes the generic `data` field since relational charts have their own
 * data structure (nodes + edges).
 */
export const RelationalBaseChartPropsSchema = Schema.Struct({
  /** Chart type identifier */
  chartType: ChartTypeSchema,

  /** Path reference to data source */
  dataPath: Schema.optional(Schema.String),

  /** Auto-fit container dimensions */
  autoFit: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Chart theme */
  theme: Schema.optional(ChartThemeSchema),

  /** Fixed width in pixels */
  width: Schema.optional(Schema.Number),

  /** Fixed height in pixels */
  height: Schema.optional(Schema.Number),

  /** Chart padding [top, right, bottom, left] or single value */
  padding: Schema.optional(
    Schema.Union(
      Schema.Number,
      Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)
    )
  ),

  /** Animation configuration */
  animation: Schema.optional(Schema.Boolean),

  /** Custom CSS class */
  className: Schema.optional(Schema.String),
});

export type RelationalBaseChartProps = typeof RelationalBaseChartPropsSchema.Type;

// =============================================================================
// Axis Configuration Schema
// =============================================================================

export const AxisConfigSchema = Schema.Struct({
  title: Schema.optional(Schema.String),
  label: Schema.optional(
    Schema.Struct({
      formatter: Schema.optional(Schema.String),
      style: Schema.optional(Schema.Unknown),
    })
  ),
  grid: Schema.optional(
    Schema.Struct({
      line: Schema.optional(Schema.Unknown),
    })
  ),
  line: Schema.optional(Schema.Unknown),
  tickLine: Schema.optional(Schema.Unknown),
});

// =============================================================================
// Legend Configuration Schema
// =============================================================================

export const LegendPositionSchema = Schema.Literal(
  'top',
  'top-left',
  'top-right',
  'bottom',
  'bottom-left',
  'bottom-right',
  'left',
  'left-top',
  'left-bottom',
  'right',
  'right-top',
  'right-bottom'
);

export const LegendConfigSchema = Schema.Struct({
  position: Schema.optional(LegendPositionSchema),
  layout: Schema.optional(Schema.Literal('horizontal', 'vertical')),
  title: Schema.optional(Schema.String),
  itemName: Schema.optional(Schema.Unknown),
  marker: Schema.optional(Schema.Unknown),
  flipPage: Schema.optional(Schema.Boolean),
});

// =============================================================================
// Tooltip Configuration Schema
// =============================================================================

export const TooltipConfigSchema = Schema.Struct({
  showTitle: Schema.optional(Schema.Boolean),
  showMarkers: Schema.optional(Schema.Boolean),
  shared: Schema.optional(Schema.Boolean),
  showCrosshairs: Schema.optional(Schema.Boolean),
  crosshairs: Schema.optional(Schema.Unknown),
  formatter: Schema.optional(Schema.String),
});

// =============================================================================
// Color Configuration Schema
// =============================================================================

/**
 * Colors can be a single color, array of colors, or callback string.
 */
export const ColorConfigSchema = Schema.Union(
  Schema.String,
  Schema.Array(Schema.String)
);

// =============================================================================
// Interaction Configuration Schema
// =============================================================================

export const InteractionTypeSchema = Schema.Literal(
  'element-active',
  'element-selected',
  'element-highlight',
  'legend-filter',
  'legend-active',
  'legend-highlight',
  'axis-label-highlight',
  'tooltip',
  'brush',
  'brush-x',
  'brush-y'
);

export const InteractionConfigSchema = Schema.Struct({
  type: InteractionTypeSchema,
  enable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  cfg: Schema.optional(Schema.Unknown),
});

// =============================================================================
// Annotations Schema
// =============================================================================

export const AnnotationTypeSchema = Schema.Literal(
  'text',
  'line',
  'region',
  'regionFilter',
  'image',
  'dataMarker',
  'shape'
);

export const AnnotationSchema = Schema.Struct({
  type: AnnotationTypeSchema,
  position: Schema.optional(Schema.Unknown),
  content: Schema.optional(Schema.String),
  style: Schema.optional(Schema.Unknown),
  start: Schema.optional(Schema.Unknown),
  end: Schema.optional(Schema.Unknown),
});

// =============================================================================
// Extended Base Props (with common configurations)
// =============================================================================

/**
 * Extended base props including axis, legend, tooltip, etc.
 */
export const ExtendedBaseChartPropsSchema = BaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** X-axis configuration */
      xAxis: Schema.optional(Schema.Union(Schema.Boolean, AxisConfigSchema)),

      /** Y-axis configuration */
      yAxis: Schema.optional(Schema.Union(Schema.Boolean, AxisConfigSchema)),

      /** Legend configuration */
      legend: Schema.optional(Schema.Union(Schema.Boolean, LegendConfigSchema)),

      /** Tooltip configuration */
      tooltip: Schema.optional(Schema.Union(Schema.Boolean, TooltipConfigSchema)),

      /** Color palette or color mapping */
      color: Schema.optional(ColorConfigSchema),

      /** Interactions */
      interactions: Schema.optional(Schema.Array(InteractionConfigSchema)),

      /** Annotations */
      annotations: Schema.optional(Schema.Array(AnnotationSchema)),

      /** Meta configuration for fields */
      meta: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
    })
  )
);

export type ExtendedBaseChartProps = typeof ExtendedBaseChartPropsSchema.Type;
