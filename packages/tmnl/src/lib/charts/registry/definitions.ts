/**
 * Chart Registry Definitions
 *
 * Centralized definitions for 35 Ant Design chart types.
 * Each definition maps a chart type to its schema, category, and metadata.
 *
 * Data-First Classification (Ant Design philosophy):
 * - Categorical comparison: Bar, Column, Radar, Rose, BidirectionalBar
 * - Time-series trends: Line, Area, Stock
 * - Part-to-whole: Pie, Treemap, Sunburst, CirclePacking
 * - Distribution: Histogram, Box, Violin, Scatter
 * - Ranking: Funnel, Bullet, RadialBar
 * - Flow/Process: Sankey, Waterfall
 * - Correlation: Scatter, Heatmap, DualAxes
 * - Progress/KPI: Gauge, Liquid
 * - Text/Frequency: WordCloud, Venn
 * - Hierarchical: OrganizationChart, MindMap, IndentedTree, Dendrogram, Fishbone
 * - Network/Relations: FlowGraph, NetworkGraph, FlowDirectionGraph
 *
 * Note: Tiny charts (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2.
 *
 * @module charts/registry/definitions
 */

import type { Schema } from 'effect';
import type { ChartType } from '../schemas/base';
import type { EntranceAnimation } from '@/lib/json-render/core/animation-schema';
import {
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
} from '../schemas/statistical';
import {
  FlowGraphChartPropsSchema,
  NetworkGraphChartPropsSchema,
  OrganizationChartPropsSchema,
  MindMapChartPropsSchema,
  IndentedTreeChartPropsSchema,
  DendrogramChartPropsSchema,
  FishboneChartPropsSchema,
  FlowDirectionGraphChartPropsSchema,
} from '../schemas/relational';

// =============================================================================
// Chart Categories
// =============================================================================

/**
 * Data-first chart categories for smart selection
 */
export type ChartCategory =
  | 'comparison'      // Categorical comparison
  | 'trend'           // Time-series trends
  | 'part-to-whole'   // Proportions and hierarchy
  | 'distribution'    // Statistical distribution
  | 'ranking'         // Ordered data
  | 'flow'            // Process and flow
  | 'correlation'     // Relationships
  | 'kpi'             // Progress and metrics
  | 'text'            // Text and frequency
  | 'hierarchical'    // Tree structures
  | 'network'         // Graph relations
  | 'sparkline';      // Compact inline charts

/**
 * Data shape hints for chart selection
 */
export type DataShape =
  | 'categorical'     // { category, value }
  | 'time-series'     // { date, value }
  | 'hierarchical'    // { id, parent, value }
  | 'network'         // { nodes, edges }
  | 'distribution'    // Array of numbers
  | 'multi-series'    // { x, y, series }
  | 'range'           // { x, min, max }
  | 'single-value';   // Just a number (0-1)

// =============================================================================
// Chart Definition Type
// =============================================================================

/**
 * Chart definition with all metadata for registry and catalog
 */
export interface ChartDefinition {
  /** Chart type identifier (matches ChartType union) */
  readonly type: ChartType;
  /** Effect Schema for props validation */
  readonly schema: Schema.Schema<any, any, never>;
  /** Human-readable description for AI generation */
  readonly description: string;
  /** Primary category for data-first selection */
  readonly category: ChartCategory;
  /** Supported data shapes */
  readonly dataShapes: readonly DataShape[];
  /** Typical use cases for AI context */
  readonly useCases: readonly string[];
  /** Default entrance animation */
  readonly defaultEntrance: EntranceAnimation;
  /** Whether chart supports hierarchical data */
  readonly hasChildren?: boolean;
  /** Required fields in data */
  readonly requiredFields?: readonly string[];
  /** Optional series grouping field */
  readonly seriesField?: boolean;
}

// =============================================================================
// Default Animations
// =============================================================================

const defaultAnimations = {
  /** Standard chart fade-in */
  chart: {
    property: 'opacity',
    easing: 'out-cubic',
    duration: 'normal',
  } satisfies EntranceAnimation,

  /** Sparkline/tiny chart - faster */
  sparkline: {
    property: 'opacity',
    easing: 'out-quad',
    duration: 'fast',
  } satisfies EntranceAnimation,

  /** Network graph - slower reveal */
  graph: {
    property: 'opacity+scale',
    easing: 'out-back',
    duration: 'slow',
  } satisfies EntranceAnimation,

  /** KPI gauge/liquid - dramatic */
  kpi: {
    property: 'opacity+scale',
    easing: 'out-quart',
    duration: 'normal',
  } satisfies EntranceAnimation,
};

// =============================================================================
// Chart Definitions (40 types)
// =============================================================================

/**
 * All chart definitions organized by category.
 *
 * Statistical Charts (27):
 *   Line, Bar, Column, Area, Pie, DualAxes, Scatter, Radar, Rose, Funnel,
 *   Waterfall, Histogram, Heatmap, Box, Sankey, Stock, Gauge, Liquid, Bullet,
 *   WordCloud, Treemap, RadialBar, CirclePacking, Violin, BidirectionalBar, Venn, Sunburst
 *
 * Tiny Charts (5):
 *   TinyLine, TinyArea, TinyColumn, TinyProgress, TinyRing
 *
 * Relational Charts (8):
 *   FlowGraph, NetworkGraph, OrganizationChart, MindMap, IndentedTree,
 *   Dendrogram, Fishbone, FlowDirectionGraph
 */
export const CHART_DEFINITIONS: readonly ChartDefinition[] = [
  // ===========================================================================
  // TREND CHARTS (Time-series)
  // ===========================================================================
  {
    type: 'Line',
    schema: LineChartPropsSchema,
    description: 'Line chart for continuous data and trends. Best for time-series, sequential data, or showing change over time. Supports multiple series, smooth curves, and area fill.',
    category: 'trend',
    dataShapes: ['time-series', 'multi-series'],
    useCases: ['stock prices', 'temperature over time', 'user growth', 'performance metrics'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Area',
    schema: AreaChartPropsSchema,
    description: 'Area chart emphasizing volume or cumulative totals. Like line chart but fills area below, making magnitude more visible. Supports stacked areas.',
    category: 'trend',
    dataShapes: ['time-series', 'multi-series'],
    useCases: ['revenue over time', 'market share trends', 'resource usage', 'cumulative metrics'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Stock',
    schema: StockChartPropsSchema,
    description: 'Financial candlestick/OHLC chart for stock data. Shows open, high, low, close values with volume. Supports technical indicators.',
    category: 'trend',
    dataShapes: ['time-series', 'range'],
    useCases: ['stock trading', 'financial analysis', 'price movements', 'market data'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField'],
  },

  // ===========================================================================
  // COMPARISON CHARTS (Categorical)
  // ===========================================================================
  {
    type: 'Bar',
    schema: BarChartPropsSchema,
    description: 'Horizontal bar chart for comparing categories. Best when category labels are long or when comparing many items. Supports grouped and stacked bars.',
    category: 'comparison',
    dataShapes: ['categorical', 'multi-series'],
    useCases: ['survey results', 'feature comparison', 'ranking items', 'category breakdown'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Column',
    schema: ColumnChartPropsSchema,
    description: 'Vertical bar chart (columns) for comparing categories. Use when categories are time-based or when space allows. Supports grouped and stacked columns.',
    category: 'comparison',
    dataShapes: ['categorical', 'time-series', 'multi-series'],
    useCases: ['monthly sales', 'quarterly reports', 'A/B test results', 'year-over-year comparison'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Radar',
    schema: RadarChartPropsSchema,
    description: 'Radar/spider chart for multi-dimensional comparison. Shows multiple variables on axes radiating from center. Good for comparing profiles.',
    category: 'comparison',
    dataShapes: ['categorical', 'multi-series'],
    useCases: ['skill assessment', 'product comparison', 'performance profiles', 'balanced scorecards'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Rose',
    schema: RoseChartPropsSchema,
    description: 'Rose/Nightingale chart - polar area chart. Each slice has same angle but varying radius. Good for cyclical data with magnitude.',
    category: 'comparison',
    dataShapes: ['categorical'],
    useCases: ['wind direction frequency', 'seasonal patterns', 'time-of-day distribution', 'cyclical comparisons'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'BidirectionalBar',
    schema: BidirectionalBarChartPropsSchema,
    description: 'Bidirectional bar chart showing opposing values from center axis. Perfect for comparing two related metrics (e.g., male vs female, import vs export).',
    category: 'comparison',
    dataShapes: ['categorical', 'multi-series'],
    useCases: ['demographic pyramids', 'trade balance', 'positive vs negative', 'before vs after'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },

  // ===========================================================================
  // PART-TO-WHOLE CHARTS
  // ===========================================================================
  {
    type: 'Pie',
    schema: PieChartPropsSchema,
    description: 'Pie chart for part-to-whole relationships. Best with 3-7 categories. Supports donut style (innerRadius). Labels show percentages.',
    category: 'part-to-whole',
    dataShapes: ['categorical'],
    useCases: ['market share', 'budget breakdown', 'survey responses', 'composition analysis'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['angleField', 'colorField'],
  },
  {
    type: 'Treemap',
    schema: TreemapChartPropsSchema,
    description: 'Treemap for hierarchical part-to-whole. Nested rectangles show hierarchy and proportion. Good for file systems, org structures.',
    category: 'part-to-whole',
    dataShapes: ['hierarchical'],
    useCases: ['disk usage', 'portfolio allocation', 'organizational structure', 'category hierarchy'],
    defaultEntrance: defaultAnimations.chart,
    hasChildren: true,
    requiredFields: ['colorField'],
  },
  {
    type: 'Sunburst',
    schema: SunburstChartPropsSchema,
    description: 'Sunburst chart for hierarchical data in radial form. Concentric rings show hierarchy levels. Interactive drill-down supported.',
    category: 'part-to-whole',
    dataShapes: ['hierarchical'],
    useCases: ['file browser', 'organizational charts', 'category drill-down', 'nested compositions'],
    defaultEntrance: defaultAnimations.chart,
    hasChildren: true,
    requiredFields: ['colorField'],
  },
  {
    type: 'CirclePacking',
    schema: CirclePackingChartPropsSchema,
    description: 'Circle packing for hierarchical data. Nested circles show containment. Size represents value. Good for comparing nested categories.',
    category: 'part-to-whole',
    dataShapes: ['hierarchical'],
    useCases: ['market segments', 'content taxonomy', 'nested categories', 'hierarchical budgets'],
    defaultEntrance: defaultAnimations.chart,
    hasChildren: true,
    requiredFields: ['colorField'],
  },

  // ===========================================================================
  // DISTRIBUTION CHARTS
  // ===========================================================================
  {
    type: 'Scatter',
    schema: ScatterChartPropsSchema,
    description: 'Scatter plot for correlation between two variables. Each point is a data item. Supports bubble size (third variable) and grouping.',
    category: 'distribution',
    dataShapes: ['multi-series', 'distribution'],
    useCases: ['correlation analysis', 'outlier detection', 'clustering visualization', 'regression plots'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
    seriesField: true,
  },
  {
    type: 'Histogram',
    schema: HistogramChartPropsSchema,
    description: 'Histogram for frequency distribution. Shows how data is distributed across bins. Configure binWidth or binNumber for granularity.',
    category: 'distribution',
    dataShapes: ['distribution'],
    useCases: ['age distribution', 'salary ranges', 'test score distribution', 'measurement frequency'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['binField'],
  },
  {
    type: 'Box',
    schema: BoxChartPropsSchema,
    description: 'Box plot (box-and-whisker) for statistical distribution. Shows median, quartiles, and outliers. Good for comparing distributions.',
    category: 'distribution',
    dataShapes: ['distribution', 'categorical'],
    useCases: ['salary comparison', 'A/B test analysis', 'quality control', 'statistical comparison'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },
  {
    type: 'Violin',
    schema: ViolinChartPropsSchema,
    description: 'Violin plot combining box plot with kernel density. Shows distribution shape. Better than box plot for bimodal distributions.',
    category: 'distribution',
    dataShapes: ['distribution', 'categorical'],
    useCases: ['income distribution', 'performance analysis', 'bimodal data', 'detailed distributions'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },
  {
    type: 'Heatmap',
    schema: HeatmapChartPropsSchema,
    description: 'Heatmap for matrix data showing intensity with color. Good for correlation matrices, activity over time, or any 2D grid data.',
    category: 'correlation',
    dataShapes: ['categorical', 'multi-series'],
    useCases: ['correlation matrix', 'activity calendar', 'user behavior grid', 'geographic density'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField', 'colorField'],
  },

  // ===========================================================================
  // RANKING CHARTS
  // ===========================================================================
  {
    type: 'Funnel',
    schema: FunnelChartPropsSchema,
    description: 'Funnel chart for sequential stages with decreasing values. Classic use: conversion funnels. Shows drop-off between stages.',
    category: 'ranking',
    dataShapes: ['categorical'],
    useCases: ['sales funnel', 'conversion rates', 'recruitment pipeline', 'process stages'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },
  {
    type: 'Bullet',
    schema: BulletChartPropsSchema,
    description: 'Bullet chart for comparing actual vs target with qualitative ranges. Compact alternative to gauges. Shows performance against goals.',
    category: 'ranking',
    dataShapes: ['single-value', 'categorical'],
    useCases: ['KPI dashboards', 'goal tracking', 'budget vs actual', 'performance metrics'],
    defaultEntrance: defaultAnimations.kpi,
    requiredFields: ['measureField', 'rangeField'],
  },
  {
    type: 'RadialBar',
    schema: RadialBarChartPropsSchema,
    description: 'Radial bar chart - bars arranged in circular form. Good for comparing categories while saving horizontal space.',
    category: 'ranking',
    dataShapes: ['categorical'],
    useCases: ['leaderboard', 'skill levels', 'progress comparison', 'circular rankings'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },

  // ===========================================================================
  // FLOW CHARTS
  // ===========================================================================
  {
    type: 'Sankey',
    schema: SankeyChartPropsSchema,
    description: 'Sankey diagram for flow between nodes. Width represents flow magnitude. Shows how quantities move through a system.',
    category: 'flow',
    dataShapes: ['network'],
    useCases: ['energy flow', 'user journey', 'budget allocation', 'material flow'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['sourceField', 'targetField', 'weightField'],
  },
  {
    type: 'Waterfall',
    schema: WaterfallChartPropsSchema,
    description: 'Waterfall chart showing cumulative effect of sequential values. Shows how initial value is affected by positive/negative changes.',
    category: 'flow',
    dataShapes: ['categorical'],
    useCases: ['profit and loss', 'inventory changes', 'budget reconciliation', 'incremental changes'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },

  // ===========================================================================
  // CORRELATION CHARTS
  // ===========================================================================
  {
    type: 'DualAxes',
    schema: DualAxesChartPropsSchema,
    description: 'Dual Y-axis chart for comparing two different scales. Combines line/bar/area on shared X-axis with independent Y scales.',
    category: 'correlation',
    dataShapes: ['time-series', 'multi-series'],
    useCases: ['revenue vs units', 'temperature vs humidity', 'price vs volume', 'dual metrics'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['xField', 'yField'],
  },
  {
    type: 'Venn',
    schema: VennChartPropsSchema,
    description: 'Venn diagram showing set intersections. Circles overlap to show shared elements. Good for comparing group memberships.',
    category: 'correlation',
    dataShapes: ['categorical'],
    useCases: ['audience overlap', 'feature comparison', 'skill intersections', 'set relationships'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['setsField'],
  },

  // ===========================================================================
  // KPI CHARTS (Progress/Metrics)
  // ===========================================================================
  {
    type: 'Gauge',
    schema: GaugeChartPropsSchema,
    description: 'Gauge chart for single metric against a range. Shows current value on arc/dial. Good for KPIs with known min/max.',
    category: 'kpi',
    dataShapes: ['single-value'],
    useCases: ['speedometer', 'completion percentage', 'performance score', 'health metrics'],
    defaultEntrance: defaultAnimations.kpi,
    requiredFields: ['percent'],
  },
  {
    type: 'Liquid',
    schema: LiquidChartPropsSchema,
    description: 'Liquid fill gauge showing percentage as liquid level. Animated wave effect. Good for completion/progress metrics.',
    category: 'kpi',
    dataShapes: ['single-value'],
    useCases: ['battery level', 'completion rate', 'capacity usage', 'fill percentage'],
    defaultEntrance: defaultAnimations.kpi,
    requiredFields: ['percent'],
  },

  // ===========================================================================
  // TEXT CHARTS
  // ===========================================================================
  {
    type: 'WordCloud',
    schema: WordCloudChartPropsSchema,
    description: 'Word cloud for text frequency visualization. Word size represents frequency/importance. Good for survey responses, tags, keywords.',
    category: 'text',
    dataShapes: ['categorical'],
    useCases: ['keyword analysis', 'survey responses', 'tag clouds', 'topic frequency'],
    defaultEntrance: defaultAnimations.chart,
    requiredFields: ['wordField', 'weightField'],
  },

  // ===========================================================================
  // HIERARCHICAL CHARTS
  // ===========================================================================
  {
    type: 'OrganizationChart',
    schema: OrganizationChartPropsSchema,
    description: 'Organization chart for hierarchical structures. Shows reporting relationships in tree layout. Supports custom node templates.',
    category: 'hierarchical',
    dataShapes: ['hierarchical'],
    useCases: ['org charts', 'reporting structure', 'family trees', 'hierarchical menus'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'MindMap',
    schema: MindMapChartPropsSchema,
    description: 'Mind map for radial hierarchical visualization. Central topic with branches. Good for brainstorming, note-taking.',
    category: 'hierarchical',
    dataShapes: ['hierarchical'],
    useCases: ['brainstorming', 'concept mapping', 'note organization', 'idea exploration'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'IndentedTree',
    schema: IndentedTreeChartPropsSchema,
    description: 'Indented tree (file browser style). Vertical tree with indentation showing hierarchy. Good for file systems, menus.',
    category: 'hierarchical',
    dataShapes: ['hierarchical'],
    useCases: ['file browser', 'navigation menus', 'category trees', 'document outline'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'Dendrogram',
    schema: DendrogramChartPropsSchema,
    description: 'Dendrogram for clustering hierarchies. Tree diagram showing merge/split points. Common in hierarchical clustering.',
    category: 'hierarchical',
    dataShapes: ['hierarchical'],
    useCases: ['clustering results', 'taxonomy', 'phylogenetic trees', 'hierarchical grouping'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'Fishbone',
    schema: FishboneChartPropsSchema,
    description: 'Fishbone/Ishikawa diagram for cause-and-effect analysis. Main spine with branches for categories of causes.',
    category: 'hierarchical',
    dataShapes: ['hierarchical'],
    useCases: ['root cause analysis', 'problem solving', 'quality improvement', 'cause-effect diagrams'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },

  // ===========================================================================
  // NETWORK CHARTS
  // ===========================================================================
  {
    type: 'FlowGraph',
    schema: FlowGraphChartPropsSchema,
    description: 'Flow graph for directed node-edge diagrams. Nodes connected by arrows showing flow direction. Good for workflows, processes.',
    category: 'network',
    dataShapes: ['network'],
    useCases: ['workflow diagrams', 'process flows', 'state machines', 'decision trees'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'NetworkGraph',
    schema: NetworkGraphChartPropsSchema,
    description: 'Network graph for node-link visualization. Force-directed layout. Good for social networks, knowledge graphs.',
    category: 'network',
    dataShapes: ['network'],
    useCases: ['social networks', 'knowledge graphs', 'dependency graphs', 'relationship mapping'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },
  {
    type: 'FlowDirectionGraph',
    schema: FlowDirectionGraphChartPropsSchema,
    description: 'Directional flow graph with explicit flow direction indicators. Combines network layout with flow arrows.',
    category: 'network',
    dataShapes: ['network'],
    useCases: ['data pipelines', 'message flows', 'system architecture', 'directional relationships'],
    defaultEntrance: defaultAnimations.graph,
    hasChildren: true,
  },

  // Note: Sparkline/Tiny charts (TinyLine, TinyArea, etc.) were removed in @ant-design/charts v2.
  // Use regular charts with compact height for similar effects.
] as const;

// =============================================================================
// Lookup Utilities
// =============================================================================

/**
 * Map for O(1) lookup by chart type
 */
export const CHART_DEFINITIONS_BY_TYPE = new Map<ChartType, ChartDefinition>(
  CHART_DEFINITIONS.map(def => [def.type, def])
);

/**
 * Get definition by chart type
 */
export const getChartDefinition = (type: ChartType): ChartDefinition | undefined =>
  CHART_DEFINITIONS_BY_TYPE.get(type);

/**
 * Get charts by category
 */
export const getChartsByCategory = (category: ChartCategory): readonly ChartDefinition[] =>
  CHART_DEFINITIONS.filter(def => def.category === category);

/**
 * Get charts by data shape
 */
export const getChartsByDataShape = (shape: DataShape): readonly ChartDefinition[] =>
  CHART_DEFINITIONS.filter(def => def.dataShapes.includes(shape));
