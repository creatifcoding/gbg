/**
 * TMNL Charting v1 - Chart Factory
 *
 * `Chart.make({})` API for creating chart instances.
 * Effect-style factory pattern with builder methods.
 *
 * @example
 * ```ts
 * const chart = Chart.make({
 *   id: "my-chart",
 *   kind: ChartKind.Line,
 *   renderer: ChartRenderer.ECharts,
 * })
 *
 * // Mount to DOM
 * await chart.mount(containerElement)
 *
 * // Stream data
 * chart.setData(myData)
 * ```
 *
 * @experimental v1 API may change.
 */

import {
  type ChartConfig,
  type ChartInstance,
  type ChartSeries,
  type LineChartConfig,
  type ScopeChartConfig,
  ChartKind,
  ChartRenderer,
  ChartState,
  Projections,
} from "./types"
import { CHART_TOKENS, echartsTheme, getWaveColor } from "./tokens"

// ─────────────────────────────────────────────────────────────────────────────
// Internal Chart State
// ─────────────────────────────────────────────────────────────────────────────

interface InternalChartState<TConfig extends ChartConfig> {
  config: TConfig
  state: ChartState
  data: ChartSeries
  container: HTMLElement | null
  rendererInstance: unknown | null
  stateListeners: Set<(state: ChartState) => void>
  animationFrameId: number | null
  phase: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Implementation
// ─────────────────────────────────────────────────────────────────────────────

function createChartInstance<TConfig extends ChartConfig>(
  config: TConfig
): ChartInstance<TConfig> {
  // Internal state (mutable for performance in hot paths)
  const internal: InternalChartState<TConfig> = {
    config,
    state: ChartState.Uninitialized,
    data: [],
    container: null,
    rendererInstance: null,
    stateListeners: new Set(),
    animationFrameId: null,
    phase: 0,
  }

  // State transition helper
  const setState = (newState: ChartState): void => {
    if (internal.state === newState) return
    internal.state = newState
    internal.stateListeners.forEach((cb) => cb(newState))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Operations
  // ─────────────────────────────────────────────────────────────────────────

  const setData = (data: ChartSeries): void => {
    internal.data = data
    if (internal.state === ChartState.Ready || internal.state === ChartState.Streaming) {
      updateRenderer()
    }
  }

  const appendData = (data: ChartSeries): void => {
    internal.data = [...internal.data, ...data]
    if (internal.state === ChartState.Ready || internal.state === ChartState.Streaming) {
      updateRenderer()
    }
  }

  const clearData = (): void => {
    internal.data = []
    if (internal.state === ChartState.Ready || internal.state === ChartState.Streaming) {
      updateRenderer()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Renderer Update (dispatch to appropriate backend)
  // ─────────────────────────────────────────────────────────────────────────

  const updateRenderer = (): void => {
    if (!internal.rendererInstance) return

    switch (config.renderer) {
      case ChartRenderer.ECharts:
        updateEChartsRenderer()
        break
      case ChartRenderer.SciChart:
        updateSciChartRenderer()
        break
    }
  }

  const updateEChartsRenderer = (): void => {
    const chart = internal.rendererInstance as {
      setOption: (option: unknown, opts?: unknown) => void
    }
    if (!chart) return

    const projection = config.projection ?? Projections.TY

    // Scatter charts need [x, y] pairs, not separate arrays
    if (config.kind === ChartKind.Scatter) {
      const scatterData = internal.data.map((d) => [projection.x(d), projection.y(d)])
      chart.setOption(
        {
          series: [{ data: scatterData }],
        },
        { notMerge: false, lazyUpdate: true }
      )
    } else {
      // Category-based charts (line, bar) use separate x labels and y values
      const xData = internal.data.map((d) => {
        const x = projection.x(d)
        // Format x-axis labels for better readability
        return typeof x === "number" ? x.toFixed(0) : x
      })
      const yData = internal.data.map((d) => projection.y(d))

      chart.setOption(
        {
          xAxis: { data: xData },
          series: [{ data: yData }],
        },
        { notMerge: false, lazyUpdate: true }
      )
    }
  }

  const updateSciChartRenderer = (): void => {
    // SciChart update logic will be implemented with SciChart integration
    // For now, placeholder
    console.debug("[Chart] SciChart update not yet implemented")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  const mount = async (container: HTMLElement): Promise<void> => {
    if (internal.state !== ChartState.Uninitialized) {
      throw new Error(`Cannot mount chart in state: ${internal.state}`)
    }

    internal.container = container
    setState(ChartState.Loading)

    try {
      switch (config.renderer) {
        case ChartRenderer.ECharts:
          await mountECharts(container)
          break
        case ChartRenderer.SciChart:
          await mountSciChart(container)
          break
        default:
          throw new Error(`Unsupported renderer: ${config.renderer}`)
      }

      setState(ChartState.Ready)
    } catch (error) {
      setState(ChartState.Error)
      throw error
    }
  }

  const mountECharts = async (container: HTMLElement): Promise<void> => {
    // Dynamic import for tree-shaking
    const echarts = await import("echarts")

    // Register TMNL theme
    echarts.registerTheme("tmnl", echartsTheme)

    // Initialize chart - let ECharts auto-size to container bounds
    // Do NOT pass explicit width/height; use container's actual dimensions
    const chart = echarts.init(container, "tmnl", {
      renderer: "canvas",
      // width/height omitted = auto-size to container
    })

    // Build initial option based on chart kind
    const option = buildEChartsOption(config)
    chart.setOption(option)

    internal.rendererInstance = chart

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(container)

    // Store cleanup reference
    ;(internal as unknown as { resizeObserver: ResizeObserver }).resizeObserver =
      resizeObserver
  }

  const mountSciChart = async (_container: HTMLElement): Promise<void> => {
    // SciChart mount logic will be implemented with SciChart integration
    // Requires license key and WASM loading
    throw new Error("SciChart renderer not yet implemented - use ECharts for now")
  }

  const unmount = (): void => {
    if (internal.animationFrameId) {
      cancelAnimationFrame(internal.animationFrameId)
      internal.animationFrameId = null
    }

    if (internal.rendererInstance) {
      switch (config.renderer) {
        case ChartRenderer.ECharts: {
          const chart = internal.rendererInstance as { dispose: () => void }
          chart.dispose()
          break
        }
        case ChartRenderer.SciChart: {
          const surface = internal.rendererInstance as { delete: () => void }
          surface.delete()
          break
        }
      }
      internal.rendererInstance = null
    }

    // Cleanup resize observer
    const obs = (internal as unknown as { resizeObserver?: ResizeObserver }).resizeObserver
    if (obs) {
      obs.disconnect()
    }

    internal.container = null
    setState(ChartState.Uninitialized)
  }

  const dispose = (): void => {
    unmount()
    internal.stateListeners.clear()
    setState(ChartState.Disposed)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Streaming Control
  // ─────────────────────────────────────────────────────────────────────────

  const pause = (): void => {
    if (internal.state === ChartState.Streaming) {
      if (internal.animationFrameId) {
        cancelAnimationFrame(internal.animationFrameId)
        internal.animationFrameId = null
      }
      setState(ChartState.Paused)
    }
  }

  const resume = (): void => {
    if (internal.state === ChartState.Paused) {
      setState(ChartState.Streaming)
      // Resume animation loop if applicable
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  const onStateChange = (callback: (state: ChartState) => void): (() => void) => {
    internal.stateListeners.add(callback)
    return () => internal.stateListeners.delete(callback)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Return Instance
  // ─────────────────────────────────────────────────────────────────────────

  return {
    get id() {
      return config.id
    },
    get config() {
      return internal.config
    },
    get state() {
      return internal.state
    },

    setData,
    appendData,
    clearData,

    mount,
    unmount,
    dispose,

    pause,
    resume,

    onStateChange,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ECharts Option Builder
// ─────────────────────────────────────────────────────────────────────────────

function buildEChartsOption(config: ChartConfig): Record<string, unknown> {
  const baseOption = {
    animation: config.animate ?? true,
    grid: {
      top: config.title ? 48 : 24,
      right: 24,
      bottom: 32,
      left: 16,
      containLabel: true, // Prevents label truncation
    },
    title: config.title
      ? {
          text: config.title,
          left: "center",
          top: 8,
          textStyle: {
            fontSize: 12,
            fontWeight: 500,
            fontFamily: CHART_TOKENS.typography.fontFamily,
            color: CHART_TOKENS.colors.textPrimary,
            letterSpacing: 1,
          },
        }
      : undefined,
    textStyle: {
      fontFamily: CHART_TOKENS.typography.fontFamily,
    },
  }

  switch (config.kind) {
    case ChartKind.Line:
      return buildLineChartOption(config as LineChartConfig, baseOption)
    case ChartKind.Area:
      return buildAreaChartOption(config, baseOption)
    case ChartKind.Bar:
    case ChartKind.Column:
      return buildBarChartOption(config, baseOption)
    case ChartKind.Scatter:
      return buildScatterChartOption(config, baseOption)
    case ChartKind.Candlestick:
      return buildCandlestickChartOption(config, baseOption)
    default:
      return {
        ...baseOption,
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [{ type: "line", data: [] }],
      }
  }
}

function buildLineChartOption(
  config: LineChartConfig,
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    xAxis: {
      type: "category",
      data: [],
      axisLine: { show: true, lineStyle: { color: CHART_TOKENS.colors.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TOKENS.colors.axisLabel,
        fontSize: 12,
        margin: 8,
        interval: "auto",
        hideOverlap: true,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TOKENS.colors.axisLabel,
        fontSize: 12,
        margin: 8,
        formatter: (value: number) => value.toFixed(value % 1 === 0 ? 0 : 1),
      },
      splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: "dashed" } },
      splitNumber: 4,
    },
    series: [
      {
        type: "line",
        data: [],
        smooth: config.smooth ?? false,
        symbol: config.showPoints ? "circle" : "none",
        symbolSize: 4,
        lineStyle: {
          width: config.strokeWidth ?? CHART_TOKENS.dimensions.strokeThicknessDefault,
          color: CHART_TOKENS.colors.waveGreen,
        },
        itemStyle: {
          color: CHART_TOKENS.colors.waveGreen,
        },
        areaStyle: config.showArea ? { opacity: 0.2, color: CHART_TOKENS.colors.waveGreen } : undefined,
      },
    ],
  }
}

function buildAreaChartOption(
  config: ChartConfig,
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    xAxis: {
      type: "category",
      data: [],
      axisLine: { show: true, lineStyle: { color: CHART_TOKENS.colors.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
      splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: "dashed" } },
      splitNumber: 4,
    },
    series: [
      {
        type: "line",
        data: [],
        areaStyle: { opacity: 0.3, color: CHART_TOKENS.colors.waveCyan },
        lineStyle: { color: CHART_TOKENS.colors.waveCyan, width: 2 },
        itemStyle: { color: CHART_TOKENS.colors.waveCyan },
        symbol: "none",
      },
    ],
  }
}

function buildBarChartOption(
  config: ChartConfig,
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    xAxis: {
      type: "category",
      data: [],
      axisLine: { show: true, lineStyle: { color: CHART_TOKENS.colors.axisLine } },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TOKENS.colors.axisLabel,
        fontSize: 12,
        margin: 8,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: CHART_TOKENS.colors.axisLabel,
        fontSize: 12,
        margin: 8,
      },
      splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: "dashed" } },
      splitNumber: 4,
    },
    series: [
      {
        type: "bar",
        data: [],
        barWidth: "60%",
        itemStyle: {
          color: CHART_TOKENS.colors.waveAmber,
          borderRadius: [2, 2, 0, 0],
        },
      },
    ],
  }
}

function buildScatterChartOption(
  config: ChartConfig,
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    xAxis: {
      type: "value",
      axisLine: { show: true, lineStyle: { color: CHART_TOKENS.colors.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: CHART_TOKENS.colors.axisLabel, fontSize: 12 },
      splitLine: { lineStyle: { color: CHART_TOKENS.colors.gridMajor, type: "dashed" } },
      splitNumber: 4,
    },
    series: [
      {
        type: "scatter",
        data: [],
        symbolSize: 8,
        itemStyle: {
          color: CHART_TOKENS.colors.waveRed,
          opacity: 0.8,
        },
      },
    ],
  }
}

function buildCandlestickChartOption(
  config: ChartConfig,
  base: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...base,
    xAxis: { type: "category", data: [] },
    yAxis: { type: "value", scale: true },
    series: [
      {
        type: "candlestick",
        data: [],
        itemStyle: {
          color: CHART_TOKENS.colors.statusActive, // bull
          color0: CHART_TOKENS.colors.statusError, // bear
          borderColor: CHART_TOKENS.colors.statusActive,
          borderColor0: CHART_TOKENS.colors.statusError,
        },
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart Namespace (Effect-style API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chart factory namespace
 *
 * @example
 * ```ts
 * const lineChart = Chart.make({
 *   id: "my-line",
 *   kind: ChartKind.Line,
 *   renderer: ChartRenderer.ECharts,
 *   smooth: true,
 * })
 *
 * const scopeChart = Chart.scope({
 *   id: "oscilloscope",
 *   pointCount: 512,
 * })
 * ```
 */
export const Chart = {
  /**
   * Create a chart instance with configuration
   */
  make: <TConfig extends ChartConfig>(config: TConfig): ChartInstance<TConfig> => {
    return createChartInstance(config)
  },

  /**
   * Shorthand for line chart
   */
  line: (
    config: Omit<LineChartConfig, "kind" | "renderer"> & { id: string }
  ): ChartInstance<LineChartConfig> => {
    return createChartInstance({
      ...config,
      kind: ChartKind.Line,
      renderer: ChartRenderer.ECharts,
    })
  },

  /**
   * Shorthand for oscilloscope-style chart (high-performance streaming)
   */
  scope: (
    config: Omit<ScopeChartConfig, "kind" | "renderer"> & { id: string }
  ): ChartInstance<ScopeChartConfig> => {
    return createChartInstance({
      ...config,
      kind: ChartKind.Line,
      renderer: ChartRenderer.SciChart,
      pointCount: config.pointCount ?? CHART_TOKENS.scope.defaultPointCount,
    })
  },

  /**
   * Shorthand for bar/column chart
   */
  bar: (
    config: Omit<ChartConfig, "kind" | "renderer"> & { id: string }
  ): ChartInstance<ChartConfig> => {
    return createChartInstance({
      ...config,
      kind: ChartKind.Bar,
      renderer: ChartRenderer.ECharts,
    })
  },

  /**
   * Shorthand for scatter chart
   */
  scatter: (
    config: Omit<ChartConfig, "kind" | "renderer"> & { id: string }
  ): ChartInstance<ChartConfig> => {
    return createChartInstance({
      ...config,
      kind: ChartKind.Scatter,
      renderer: ChartRenderer.ECharts,
    })
  },

  /**
   * Shorthand for candlestick chart
   */
  candlestick: (
    config: Omit<ChartConfig, "kind" | "renderer"> & { id: string }
  ): ChartInstance<ChartConfig> => {
    return createChartInstance({
      ...config,
      kind: ChartKind.Candlestick,
      renderer: ChartRenderer.ECharts,
    })
  },

  // Re-export types for convenience
  Kind: ChartKind,
  Renderer: ChartRenderer,
  State: ChartState,
  Projections,
} as const

export type { ChartInstance, ChartConfig, ChartSeries }
