/**
 * TMNL Charting v1
 *
 * Chart.make({}) API for creating chart instances with ECharts/SciChart backends.
 *
 * @example
 * ```ts
 * import { Chart, useChart, generateSignal } from "@/lib/charting/v1"
 *
 * // Factory API
 * const chart = Chart.make({
 *   id: "my-chart",
 *   kind: Chart.Kind.Line,
 *   renderer: Chart.Renderer.ECharts,
 * })
 *
 * // Shorthand
 * const lineChart = Chart.line({ id: "line-1", smooth: true })
 *
 * // React hook
 * const { containerRef, setData } = useChart({ config: { id: "chart", ... } })
 *
 * // Generate test data
 * const data = generateSignal({ pointCount: 512, frequency: 2 })
 * ```
 *
 * @experimental v1 API may change.
 */

// Core factory
export { Chart, type ChartInstance, type ChartConfig, type ChartSeries } from "./Chart"

// Types
export {
  ChartKind,
  ChartRenderer,
  ChartState,
  BufferState,
  Projections,
  createDatum,
  createEmptySeries,
  type ChartDatum,
  type LineChartConfig,
  type ScopeChartConfig,
  type CandlestickChartConfig,
  type AnyChartConfig,
  type Projection,
  type BufferSnapshot,
  type StreamStatus,
  type StreamStats,
  type WaveConfig,
} from "./types"

// Tokens
export {
  CHART_TOKENS,
  echartsTheme,
  sciChartTheme,
  hslToHex,
  discretizeHue,
  getWaveColor,
} from "./tokens"

// Streams
export {
  RingBuffer,
  RealtimeSignalGenerator,
  generateSignal,
  generateDualSignal,
  sineWave,
  noiseSignal,
  stepSignal,
  type GeneratorFunction,
  type SignalConfig,
} from "./streams"

// Hooks
export {
  useChart,
  useLineChart,
  useBarChart,
  useScatterChart,
  type UseChartOptions,
  type UseChartResult,
} from "./hooks"

// Components
export {
  SubgraphView,
  type SubgraphViewProps,
  type SubgraphChannel,
} from "./components"
