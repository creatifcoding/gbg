/**
 * Statistical Chart Schemas
 *
 * Effect Schema definitions for statistical chart types:
 * Line, Bar, Column, Area, Pie, Scatter, Radar, etc.
 *
 * @module charts/schemas/statistical
 */

import { Schema } from 'effect';
import { ExtendedBaseChartPropsSchema } from './base';

// =============================================================================
// Line Chart Schema
// =============================================================================

export const LineChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Line smoothing */
      smooth: Schema.optional(Schema.Boolean),
      /** Step line type */
      stepType: Schema.optional(Schema.Literal('hv', 'vh', 'hvh', 'vhv')),
      /** Connect null values */
      connectNulls: Schema.optional(Schema.Boolean),
      /** Line style */
      lineStyle: Schema.optional(Schema.Unknown),
      /** Point style */
      point: Schema.optional(Schema.Unknown),
      /** Area fill */
      area: Schema.optional(Schema.Unknown),
    })
  )
);

export type LineChartProps = typeof LineChartPropsSchema.Type;

// =============================================================================
// Bar Chart Schema (Horizontal)
// =============================================================================

export const BarChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (values) */
      xField: Schema.String,
      /** Field for Y axis (categories) */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Field for color mapping */
      colorField: Schema.optional(Schema.String),
      /** Grouped bars */
      isGroup: Schema.optional(Schema.Boolean),
      /** Stacked bars */
      isStack: Schema.optional(Schema.Boolean),
      /** Percent stacked */
      isPercent: Schema.optional(Schema.Boolean),
      /** Bar width ratio (0-1) */
      barWidthRatio: Schema.optional(Schema.Number),
      /** Min bar width */
      minBarWidth: Schema.optional(Schema.Number),
      /** Max bar width */
      maxBarWidth: Schema.optional(Schema.Number),
      /** Bar style */
      barStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type BarChartProps = typeof BarChartPropsSchema.Type;

// =============================================================================
// Column Chart Schema (Vertical)
// =============================================================================

export const ColumnChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (categories) */
      xField: Schema.String,
      /** Field for Y axis (values) */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Field for color mapping */
      colorField: Schema.optional(Schema.String),
      /** Grouped columns */
      isGroup: Schema.optional(Schema.Boolean),
      /** Stacked columns */
      isStack: Schema.optional(Schema.Boolean),
      /** Percent stacked */
      isPercent: Schema.optional(Schema.Boolean),
      /** Column width ratio (0-1) */
      columnWidthRatio: Schema.optional(Schema.Number),
      /** Min column width */
      minColumnWidth: Schema.optional(Schema.Number),
      /** Max column width */
      maxColumnWidth: Schema.optional(Schema.Number),
      /** Column style */
      columnStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type ColumnChartProps = typeof ColumnChartPropsSchema.Type;

// =============================================================================
// Area Chart Schema
// =============================================================================

export const AreaChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Line smoothing */
      smooth: Schema.optional(Schema.Boolean),
      /** Stacked areas */
      isStack: Schema.optional(Schema.Boolean),
      /** Percent stacked */
      isPercent: Schema.optional(Schema.Boolean),
      /** Start from zero */
      startOnZero: Schema.optional(Schema.Boolean),
      /** Area style */
      areaStyle: Schema.optional(Schema.Unknown),
      /** Line style */
      line: Schema.optional(Schema.Unknown),
      /** Point style */
      point: Schema.optional(Schema.Unknown),
    })
  )
);

export type AreaChartProps = typeof AreaChartPropsSchema.Type;

// =============================================================================
// Pie Chart Schema
// =============================================================================

export const PieChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for angle (value) */
      angleField: Schema.String,
      /** Field for color grouping */
      colorField: Schema.String,
      /** Inner radius for donut (0-1) */
      innerRadius: Schema.optional(Schema.Number),
      /** Outer radius (0-1) */
      radius: Schema.optional(Schema.Number),
      /** Start angle in degrees */
      startAngle: Schema.optional(Schema.Number),
      /** End angle in degrees */
      endAngle: Schema.optional(Schema.Number),
      /** Pie style */
      pieStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
      /** Statistic content for center */
      statistic: Schema.optional(Schema.Unknown),
    })
  )
);

export type PieChartProps = typeof PieChartPropsSchema.Type;

// =============================================================================
// Scatter Chart Schema
// =============================================================================

export const ScatterChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis */
      yField: Schema.String,
      /** Field for color grouping */
      colorField: Schema.optional(Schema.String),
      /** Field for size mapping */
      sizeField: Schema.optional(Schema.String),
      /** Field for shape mapping */
      shapeField: Schema.optional(Schema.String),
      /** Size range [min, max] */
      size: Schema.optional(
        Schema.Union(
          Schema.Number,
          Schema.Tuple(Schema.Number, Schema.Number)
        )
      ),
      /** Point shape */
      shape: Schema.optional(Schema.String),
      /** Point style */
      pointStyle: Schema.optional(Schema.Unknown),
      /** Regression line */
      regressionLine: Schema.optional(Schema.Unknown),
      /** Quadrant configuration */
      quadrant: Schema.optional(Schema.Unknown),
    })
  )
);

export type ScatterChartProps = typeof ScatterChartPropsSchema.Type;

// =============================================================================
// Radar Chart Schema
// =============================================================================

export const RadarChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for angle (category) */
      xField: Schema.String,
      /** Field for radius (value) */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Line smoothing */
      smooth: Schema.optional(Schema.Boolean),
      /** Area fill */
      area: Schema.optional(Schema.Unknown),
      /** Point configuration */
      point: Schema.optional(Schema.Unknown),
      /** Line style */
      lineStyle: Schema.optional(Schema.Unknown),
      /** Radius axis configuration */
      radius: Schema.optional(Schema.Number),
    })
  )
);

export type RadarChartProps = typeof RadarChartPropsSchema.Type;

// =============================================================================
// Rose Chart Schema
// =============================================================================

export const RoseChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (category) */
      xField: Schema.String,
      /** Field for Y axis (value) */
      yField: Schema.String,
      /** Field for series grouping */
      seriesField: Schema.optional(Schema.String),
      /** Inner radius (0-1) */
      innerRadius: Schema.optional(Schema.Number),
      /** Outer radius (0-1) */
      radius: Schema.optional(Schema.Number),
      /** Stacked rose */
      isStack: Schema.optional(Schema.Boolean),
      /** Group rose */
      isGroup: Schema.optional(Schema.Boolean),
      /** Sector style */
      sectorStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type RoseChartProps = typeof RoseChartPropsSchema.Type;

// =============================================================================
// Funnel Chart Schema
// =============================================================================

export const FunnelChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (category) */
      xField: Schema.String,
      /** Field for Y axis (value) */
      yField: Schema.String,
      /** Funnel shape */
      shape: Schema.optional(Schema.Literal('funnel', 'pyramid')),
      /** Dynamic height based on value */
      dynamicHeight: Schema.optional(Schema.Boolean),
      /** Transpose funnel */
      isTransposed: Schema.optional(Schema.Boolean),
      /** Funnel style */
      funnelStyle: Schema.optional(Schema.Unknown),
      /** Conversion tag */
      conversionTag: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type FunnelChartProps = typeof FunnelChartPropsSchema.Type;

// =============================================================================
// Gauge Chart Schema
// =============================================================================

export const GaugeChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Current value (0-1) */
      percent: Schema.Number,
      /** Inner radius (0-1) */
      innerRadius: Schema.optional(Schema.Number),
      /** Outer radius (0-1) */
      radius: Schema.optional(Schema.Number),
      /** Start angle in degrees */
      startAngle: Schema.optional(Schema.Number),
      /** End angle in degrees */
      endAngle: Schema.optional(Schema.Number),
      /** Range configuration */
      range: Schema.optional(Schema.Unknown),
      /** Indicator configuration */
      indicator: Schema.optional(Schema.Unknown),
      /** Statistic content */
      statistic: Schema.optional(Schema.Unknown),
      /** Gauge style */
      gaugeStyle: Schema.optional(Schema.Unknown),
      /** Axis configuration */
      axis: Schema.optional(Schema.Unknown),
    })
  )
);

export type GaugeChartProps = typeof GaugeChartPropsSchema.Type;

// =============================================================================
// Liquid Chart Schema
// =============================================================================

export const LiquidChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Fill percent (0-1) */
      percent: Schema.Number,
      /** Outline shape */
      shape: Schema.optional(Schema.Literal('circle', 'diamond', 'triangle', 'pin', 'rect')),
      /** Outer radius */
      radius: Schema.optional(Schema.Number),
      /** Outline configuration */
      outline: Schema.optional(Schema.Unknown),
      /** Wave configuration */
      wave: Schema.optional(Schema.Unknown),
      /** Statistic content */
      statistic: Schema.optional(Schema.Unknown),
      /** Liquid style */
      liquidStyle: Schema.optional(Schema.Unknown),
    })
  )
);

export type LiquidChartProps = typeof LiquidChartPropsSchema.Type;

// =============================================================================
// Heatmap Chart Schema
// =============================================================================

export const HeatmapChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis */
      yField: Schema.String,
      /** Field for color intensity */
      colorField: Schema.String,
      /** Reflect (flip) */
      reflect: Schema.optional(Schema.Literal('x', 'y')),
      /** Heatmap style */
      heatmapStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
      /** Size field */
      sizeField: Schema.optional(Schema.String),
      /** Size range */
      sizeRatio: Schema.optional(Schema.Number),
    })
  )
);

export type HeatmapChartProps = typeof HeatmapChartPropsSchema.Type;

// =============================================================================
// DualAxes Chart Schema
// =============================================================================

export const DualAxesChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Fields for Y axes [left, right] */
      yField: Schema.Tuple(Schema.String, Schema.String),
      /** Geometry types [left, right] */
      geometryOptions: Schema.optional(
        Schema.Tuple(Schema.Unknown, Schema.Unknown)
      ),
    })
  )
);

export type DualAxesChartProps = typeof DualAxesChartPropsSchema.Type;

// =============================================================================
// Waterfall Chart Schema
// =============================================================================

export const WaterfallChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (category) */
      xField: Schema.String,
      /** Field for Y axis (value) */
      yField: Schema.String,
      /** Rising bar style */
      risingFill: Schema.optional(Schema.String),
      /** Falling bar style */
      fallingFill: Schema.optional(Schema.String),
      /** Total bar style */
      total: Schema.optional(Schema.Unknown),
      /** Leader line */
      leaderLine: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type WaterfallChartProps = typeof WaterfallChartPropsSchema.Type;

// =============================================================================
// Treemap Chart Schema
// =============================================================================

export const TreemapChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for color mapping */
      colorField: Schema.String,
      /** Hierarchy path fields */
      hierarchyConfig: Schema.optional(Schema.Unknown),
      /** Rect style */
      rectStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
      /** Drill down configuration */
      drilldown: Schema.optional(Schema.Unknown),
    })
  )
);

export type TreemapChartProps = typeof TreemapChartPropsSchema.Type;

// =============================================================================
// Sankey Chart Schema
// =============================================================================

export const SankeyChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for source node */
      sourceField: Schema.String,
      /** Field for target node */
      targetField: Schema.String,
      /** Field for weight */
      weightField: Schema.String,
      /** Node style */
      nodeStyle: Schema.optional(Schema.Unknown),
      /** Edge style */
      edgeStyle: Schema.optional(Schema.Unknown),
      /** Node width ratio */
      nodeWidthRatio: Schema.optional(Schema.Number),
      /** Node padding ratio */
      nodePaddingRatio: Schema.optional(Schema.Number),
      /** Node draggable */
      nodeDraggable: Schema.optional(Schema.Boolean),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type SankeyChartProps = typeof SankeyChartPropsSchema.Type;

// =============================================================================
// WordCloud Chart Schema
// =============================================================================

export const WordCloudChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for word text */
      wordField: Schema.String,
      /** Field for word weight */
      weightField: Schema.String,
      /** Field for color grouping */
      colorField: Schema.optional(Schema.String),
      /** Word style */
      wordStyle: Schema.optional(Schema.Unknown),
      /** Random placement */
      random: Schema.optional(Schema.Number),
      /** Spiral type */
      spiral: Schema.optional(Schema.Literal('archimedean', 'rectangular')),
      /** Image mask */
      imageMask: Schema.optional(Schema.String),
    })
  )
);

export type WordCloudChartProps = typeof WordCloudChartPropsSchema.Type;

// =============================================================================
// Box (Boxplot) Chart Schema
// =============================================================================

export const BoxChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis (array of values) */
      yField: Schema.String,
      /** Field for grouping */
      groupField: Schema.optional(Schema.String),
      /** Outlier display */
      outliersField: Schema.optional(Schema.String),
      /** Box style */
      boxStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type BoxChartProps = typeof BoxChartPropsSchema.Type;

// =============================================================================
// Bullet Chart Schema
// =============================================================================

export const BulletChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for measure (actual) */
      measureField: Schema.String,
      /** Field for range (background) */
      rangeField: Schema.String,
      /** Field for target */
      targetField: Schema.String,
      /** Field for X axis */
      xField: Schema.String,
      /** Measure size */
      size: Schema.optional(Schema.Unknown),
      /** Bullet style */
      bulletStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type BulletChartProps = typeof BulletChartPropsSchema.Type;

// =============================================================================
// Histogram Chart Schema
// =============================================================================

export const HistogramChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for bin values */
      binField: Schema.String,
      /** Number of bins */
      binNumber: Schema.optional(Schema.Number),
      /** Bin width */
      binWidth: Schema.optional(Schema.Number),
      /** Stack field */
      stackField: Schema.optional(Schema.String),
      /** Histogram style */
      columnStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type HistogramChartProps = typeof HistogramChartPropsSchema.Type;

// =============================================================================
// RadialBar Chart Schema
// =============================================================================

export const RadialBarChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (category) */
      xField: Schema.String,
      /** Field for Y axis (value) */
      yField: Schema.String,
      /** Field for color */
      colorField: Schema.optional(Schema.String),
      /** Inner radius (0-1) */
      innerRadius: Schema.optional(Schema.Number),
      /** Max angle in radians */
      maxAngle: Schema.optional(Schema.Number),
      /** Bar style */
      barStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type RadialBarChartProps = typeof RadialBarChartPropsSchema.Type;

// =============================================================================
// Stock Chart Schema
// =============================================================================

export const StockChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (date) */
      xField: Schema.String,
      /** Fields for OHLC [open, close, high, low] */
      yField: Schema.Tuple(
        Schema.String,
        Schema.String,
        Schema.String,
        Schema.String
      ),
      /** Rising fill color */
      risingFill: Schema.optional(Schema.String),
      /** Falling fill color */
      fallingFill: Schema.optional(Schema.String),
      /** Stock style */
      stockStyle: Schema.optional(Schema.Unknown),
    })
  )
);

export type StockChartProps = typeof StockChartPropsSchema.Type;

// =============================================================================
// Sunburst Chart Schema
// =============================================================================

export const SunburstChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for color mapping */
      colorField: Schema.String,
      /** Hierarchy config */
      hierarchyConfig: Schema.optional(Schema.Unknown),
      /** Inner radius (0-1) */
      innerRadius: Schema.optional(Schema.Number),
      /** Outer radius (0-1) */
      radius: Schema.optional(Schema.Number),
      /** Sunburst style */
      sunburstStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
      /** Drill down */
      drilldown: Schema.optional(Schema.Unknown),
    })
  )
);

export type SunburstChartProps = typeof SunburstChartPropsSchema.Type;

// =============================================================================
// Violin Chart Schema
// =============================================================================

export const ViolinChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis */
      xField: Schema.String,
      /** Field for Y axis */
      yField: Schema.String,
      /** Field for series */
      seriesField: Schema.optional(Schema.String),
      /** Violin style */
      violinStyle: Schema.optional(Schema.Unknown),
      /** Box display */
      box: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type ViolinChartProps = typeof ViolinChartPropsSchema.Type;

// =============================================================================
// BidirectionalBar Chart Schema
// =============================================================================

export const BidirectionalBarChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for X axis (category) */
      xField: Schema.String,
      /** Fields for bidirectional values */
      yField: Schema.Tuple(Schema.String, Schema.String),
      /** Bar style */
      barStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type BidirectionalBarChartProps = typeof BidirectionalBarChartPropsSchema.Type;

// =============================================================================
// CirclePacking Chart Schema
// =============================================================================

export const CirclePackingChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for color */
      colorField: Schema.String,
      /** Hierarchy config */
      hierarchyConfig: Schema.optional(Schema.Unknown),
      /** Circle style */
      pointStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
      /** Drill down */
      drilldown: Schema.optional(Schema.Unknown),
    })
  )
);

export type CirclePackingChartProps = typeof CirclePackingChartPropsSchema.Type;

// =============================================================================
// Venn Chart Schema
// =============================================================================

export const VennChartPropsSchema = ExtendedBaseChartPropsSchema.pipe(
  Schema.extend(
    Schema.Struct({
      /** Field for sets */
      setsField: Schema.String,
      /** Field for size */
      sizeField: Schema.String,
      /** Venn style */
      pointStyle: Schema.optional(Schema.Unknown),
      /** Label configuration */
      label: Schema.optional(Schema.Unknown),
    })
  )
);

export type VennChartProps = typeof VennChartPropsSchema.Type;
