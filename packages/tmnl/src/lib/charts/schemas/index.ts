/**
 * Chart Schemas
 *
 * Effect Schema definitions for all Ant Design chart types.
 *
 * @module charts/schemas
 */

// Base schemas
export {
  ChartTypeSchema,
  ChartThemeSchema,
  DataSourceSchema,
  BaseChartPropsSchema,
  ExtendedBaseChartPropsSchema,
  AxisConfigSchema,
  LegendPositionSchema,
  LegendConfigSchema,
  TooltipConfigSchema,
  ColorConfigSchema,
  InteractionTypeSchema,
  InteractionConfigSchema,
  AnnotationTypeSchema,
  AnnotationSchema,
  type ChartType,
  type BaseChartProps,
  type ExtendedBaseChartProps,
} from './base';

// Statistical chart schemas
export {
  LineChartPropsSchema,
  BarChartPropsSchema,
  ColumnChartPropsSchema,
  AreaChartPropsSchema,
  PieChartPropsSchema,
  ScatterChartPropsSchema,
  RadarChartPropsSchema,
  RoseChartPropsSchema,
  FunnelChartPropsSchema,
  GaugeChartPropsSchema,
  LiquidChartPropsSchema,
  HeatmapChartPropsSchema,
  DualAxesChartPropsSchema,
  WaterfallChartPropsSchema,
  TreemapChartPropsSchema,
  SankeyChartPropsSchema,
  WordCloudChartPropsSchema,
  BoxChartPropsSchema,
  BulletChartPropsSchema,
  HistogramChartPropsSchema,
  RadialBarChartPropsSchema,
  StockChartPropsSchema,
  SunburstChartPropsSchema,
  ViolinChartPropsSchema,
  BidirectionalBarChartPropsSchema,
  CirclePackingChartPropsSchema,
  VennChartPropsSchema,
  type LineChartProps,
  type BarChartProps,
  type ColumnChartProps,
  type AreaChartProps,
  type PieChartProps,
  type ScatterChartProps,
  type RadarChartProps,
  type RoseChartProps,
  type FunnelChartProps,
  type GaugeChartProps,
  type LiquidChartProps,
  type HeatmapChartProps,
  type DualAxesChartProps,
  type WaterfallChartProps,
  type TreemapChartProps,
  type SankeyChartProps,
  type WordCloudChartProps,
  type BoxChartProps,
  type BulletChartProps,
  type HistogramChartProps,
  type RadialBarChartProps,
  type StockChartProps,
  type SunburstChartProps,
  type ViolinChartProps,
  type BidirectionalBarChartProps,
  type CirclePackingChartProps,
  type VennChartProps,
} from './statistical';

// Relational chart schemas (graph/network visualizations)
export {
  NodePositionSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  LayoutTypeSchema,
  LayoutConfigSchema,
  FlowGraphChartPropsSchema,
  NetworkGraphChartPropsSchema,
  OrganizationChartPropsSchema,
  MindMapChartPropsSchema,
  IndentedTreeChartPropsSchema,
  DendrogramChartPropsSchema,
  FishboneChartPropsSchema,
  FlowDirectionGraphChartPropsSchema,
  type FlowGraphChartProps,
  type NetworkGraphChartProps,
  type OrganizationChartProps,
  type MindMapChartProps,
  type IndentedTreeChartProps,
  type DendrogramChartProps,
  type FishboneChartProps,
  type FlowDirectionGraphChartProps,
} from './relational';

// Note: Tiny chart schemas (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2.
// Use regular charts with compact height for similar effects.
