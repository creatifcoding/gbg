/**
 * TMNL Charting v1 - Core Types
 *
 * ChartDatum-based data model with contract system for chart adapters.
 *
 * @experimental v1 API may change.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Chart Kind Enum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exhaustive list of supported chart types
 */
export enum ChartKind {
  Line = "LINE",
  Area = "AREA",
  Scatter = "SCATTER",
  Bubble = "BUBBLE",
  Bar = "BAR",
  Column = "COLUMN",
  Candlestick = "CANDLESTICK",
  Band = "BAND",
  Heatmap = "HEATMAP",
  Histogram = "HISTOGRAM",
  BoxPlot = "BOXPLOT",
  Pie = "PIE",
  Gauge = "GAUGE",
  Radar = "RADAR",
}

/**
 * Renderer backend
 */
export enum ChartRenderer {
  ECharts = "ECHARTS",
  SciChart = "SCICHART",
}

/**
 * Chart state machine states
 */
export enum ChartState {
  Uninitialized = "UNINITIALIZED",
  Loading = "LOADING",
  Ready = "READY",
  Streaming = "STREAMING",
  Paused = "PAUSED",
  Error = "ERROR",
  Disposed = "DISPOSED",
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartDatum - Core Data Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChartDatum - The atomic unit for all chart data
 *
 * Replaces THS (Typed Heterogeneous Signal) with cleaner naming.
 * All fields optional except core coordinates to allow flexible projections.
 */
export interface ChartDatum {
  /** Timestamp or index (domain axis) */
  readonly t: number
  /** X coordinate (range axis) */
  readonly x: number
  /** Y coordinate (range axis) */
  readonly y: number
  /** Series identifier for multi-series charts */
  readonly series?: string
  /** Group key for faceting/categorization */
  readonly group?: string
  /** Highlight flag for markers/annotations */
  readonly highlight?: boolean
  /** Arbitrary metadata for tooltips, etc. */
  readonly meta?: Readonly<Record<string, unknown>>
}

/**
 * ChartSeries - An immutable array of ChartDatum
 */
export type ChartSeries = readonly ChartDatum[]

// ─────────────────────────────────────────────────────────────────────────────
// ChartDatum Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a validated ChartDatum with defaults
 */
export function createDatum(
  t: number,
  x: number,
  y: number,
  options?: Partial<Pick<ChartDatum, "series" | "group" | "highlight" | "meta">>
): ChartDatum {
  return {
    t: Number.isFinite(t) ? t : 0,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    ...options,
  }
}

/**
 * Create an empty ChartSeries
 */
export function createEmptySeries(): ChartSeries {
  return []
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection System
// ─────────────────────────────────────────────────────────────────────────────

/**
 * XY Projection - defines which ChartDatum fields map to chart axes
 */
export interface Projection {
  readonly x: (datum: ChartDatum) => number
  readonly y: (datum: ChartDatum) => number
}

/**
 * Common projections
 */
export const Projections = {
  /** Time/index as X, y as Y (default for time series) */
  TY: { x: (d: ChartDatum) => d.t, y: (d: ChartDatum) => d.y } as Projection,
  /** x as X, y as Y */
  XY: { x: (d: ChartDatum) => d.x, y: (d: ChartDatum) => d.y } as Projection,
  /** Time/index as X, x as Y */
  TX: { x: (d: ChartDatum) => d.t, y: (d: ChartDatum) => d.x } as Projection,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Chart Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base chart configuration
 */
export interface ChartConfig {
  readonly id: string
  readonly kind: ChartKind
  readonly renderer: ChartRenderer
  readonly title?: string
  readonly projection?: Projection
  readonly width?: number
  readonly height?: number
  readonly animate?: boolean
}

/**
 * Line chart specific config
 */
export interface LineChartConfig extends ChartConfig {
  readonly kind: ChartKind.Line
  readonly smooth?: boolean
  readonly strokeWidth?: number
  readonly showPoints?: boolean
  readonly showArea?: boolean
}

/**
 * Scope (oscilloscope) chart config - high-performance streaming
 */
export interface ScopeChartConfig extends ChartConfig {
  readonly kind: ChartKind.Line
  readonly renderer: ChartRenderer.SciChart
  readonly pointCount: number
  readonly updateIntervalMs?: number
  readonly strokeThickness?: number
  readonly hueDiscretization?: number
}

/**
 * Candlestick chart config
 */
export interface CandlestickChartConfig extends ChartConfig {
  readonly kind: ChartKind.Candlestick
  readonly windowSize: number
  readonly bullColor?: string
  readonly bearColor?: string
}

/**
 * Union of all chart configs
 */
export type AnyChartConfig =
  | LineChartConfig
  | ScopeChartConfig
  | CandlestickChartConfig
  | ChartConfig

// ─────────────────────────────────────────────────────────────────────────────
// Chart Instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chart instance returned by Chart.make()
 */
export interface ChartInstance<TConfig extends ChartConfig = ChartConfig> {
  readonly id: string
  readonly config: TConfig
  readonly state: ChartState

  // Data operations
  readonly setData: (data: ChartSeries) => void
  readonly appendData: (data: ChartSeries) => void
  readonly clearData: () => void

  // Lifecycle
  readonly mount: (container: HTMLElement) => Promise<void>
  readonly unmount: () => void
  readonly dispose: () => void

  // State
  readonly pause: () => void
  readonly resume: () => void

  // Subscriptions
  readonly onStateChange: (callback: (state: ChartState) => void) => () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Buffer state
 */
export enum BufferState {
  Empty = 0,
  Partial = 1,
  Full = 2,
}

/**
 * Stream buffer snapshot
 */
export interface BufferSnapshot {
  readonly data: Float32Array
  readonly length: number
  readonly state: BufferState
}

/**
 * Stream status
 */
export type StreamStatus = "idle" | "streaming" | "paused" | "complete" | "error"

/**
 * Stream statistics
 */
export interface StreamStats {
  readonly samplesReceived: number
  readonly samplesDropped: number
  readonly lastUpdateMs: number
  readonly fps: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Manager Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chart manager stats
 */
export interface ChartManagerStats {
  readonly chartsActive: number
  readonly streamsActive: number
  readonly totalDataPoints: number
  readonly avgFps: number
}

/**
 * Wave configuration for multi-wave displays
 */
export interface WaveConfig {
  readonly id: string
  readonly baseHue: number
  readonly frequency: number
  readonly amplitude: number
  readonly phaseOffset: number
  readonly series?: string
}
