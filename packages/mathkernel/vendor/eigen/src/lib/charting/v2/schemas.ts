import { Schema } from 'effect';

export const ChartKind = Schema.Literal(
  'LINE',
  'AREA',
  'SCATTER',
  'BUBBLE',
  'BAR',
  'COLUMN',
  'CANDLESTICK',
  'BAND',
  'HEATMAP',
  'HISTOGRAM',
  'BOXPLOT',
  'PIE',
  'GAUGE',
  'RADAR'
);
export type ChartKind = typeof ChartKind.Type;

export const ChartRenderer = Schema.Literal('ECHARTS', 'SCICHART');
export type ChartRenderer = typeof ChartRenderer.Type;

export const ChartState = Schema.Literal(
  'UNINITIALIZED',
  'LOADING',
  'READY',
  'STREAMING',
  'PAUSED',
  'ERROR',
  'DISPOSED'
);
export type ChartState = typeof ChartState.Type;

export const ProjectionKind = Schema.Literal('TY', 'XY', 'TX');
export type ProjectionKind = typeof ProjectionKind.Type;

export const ChartDatum = Schema.Struct({
  t: Schema.Number,
  x: Schema.Number,
  y: Schema.Number,
  series: Schema.optional(Schema.String),
  group: Schema.optional(Schema.String),
  highlight: Schema.optional(Schema.Boolean),
  meta: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  ),
});
export type ChartDatum = typeof ChartDatum.Type;

export const ChartSeries = Schema.Array(ChartDatum);
export type ChartSeries = typeof ChartSeries.Type;

const CommonSpecFields = {
  id: Schema.String,
  renderer: Schema.optional(ChartRenderer),
  title: Schema.optional(Schema.String),
  projection: Schema.optional(ProjectionKind),
  animate: Schema.optional(Schema.Boolean),
};

export const LineChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('LINE'),
  smooth: Schema.optional(Schema.Boolean),
  strokeWidth: Schema.optional(Schema.Number),
  showPoints: Schema.optional(Schema.Boolean),
  showArea: Schema.optional(Schema.Boolean),
});
export type LineChartSpec = typeof LineChartSpec.Type;

export const AreaChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('AREA'),
  smooth: Schema.optional(Schema.Boolean),
  strokeWidth: Schema.optional(Schema.Number),
});
export type AreaChartSpec = typeof AreaChartSpec.Type;

export const BarChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('BAR', 'COLUMN'),
  barWidth: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
});
export type BarChartSpec = typeof BarChartSpec.Type;

export const ScatterChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('SCATTER'),
  pointSize: Schema.optional(Schema.Number),
});
export type ScatterChartSpec = typeof ScatterChartSpec.Type;

export const CandlestickChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('CANDLESTICK'),
  windowSize: Schema.Number,
  bullColor: Schema.optional(Schema.String),
  bearColor: Schema.optional(Schema.String),
});
export type CandlestickChartSpec = typeof CandlestickChartSpec.Type;

export const ScopeChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal('LINE'),
  renderer: Schema.Literal('SCICHART'),
  pointCount: Schema.Number,
  updateIntervalMs: Schema.optional(Schema.Number),
  strokeThickness: Schema.optional(Schema.Number),
  hueDiscretization: Schema.optional(Schema.Number),
});
export type ScopeChartSpec = typeof ScopeChartSpec.Type;

export const GenericChartSpec = Schema.Struct({
  ...CommonSpecFields,
  kind: Schema.Literal(
    'BUBBLE',
    'BAND',
    'HEATMAP',
    'HISTOGRAM',
    'BOXPLOT',
    'PIE',
    'GAUGE',
    'RADAR'
  ),
});
export type GenericChartSpec = typeof GenericChartSpec.Type;

export const ChartSpec = Schema.Union(
  LineChartSpec,
  AreaChartSpec,
  BarChartSpec,
  ScatterChartSpec,
  CandlestickChartSpec,
  ScopeChartSpec,
  GenericChartSpec
);
export type ChartSpec = typeof ChartSpec.Type;
