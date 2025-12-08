/**
 * Chart Overlay
 *
 * Reactive overlay for time-series and trend visualization.
 * Integrates with ECharts for rich charting capabilities.
 *
 * Port convention: chart:{chartId}:data, chart:{chartId}:config
 *
 * @example
 * ```tsx
 * const { traces, addPoint, setTimeRange, clearTrace } = useChart({
 *   containerId,
 *   chartId: "trend-1" as ChartId,
 * })
 *
 * return (
 *   <ReactECharts
 *     option={{
 *       series: traces.map(t => ({ data: t.points, name: t.name }))
 *     }}
 *   />
 * )
 * ```
 */

import * as Effect from "effect/Effect"
import { Overlay, createOverlay } from "../Overlay"
import type { OverlayId, ContainerId } from "../schemas"
import {
  type ChartId,
  type ChartDataPoint,
  type ChartTrace,
  chartPort,
} from "./types"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Chart type for visualization */
export type ChartType = "line" | "area" | "bar" | "scatter" | "sparkline"

/** Chart overlay configuration */
export interface ChartOverlayConfig {
  /** Chart identifier */
  readonly chartId: ChartId
  /** Optional display name */
  readonly name?: string
  /** Chart type (default: "line") */
  readonly chartType?: ChartType
  /** Maximum points to retain per trace (default: 1000) */
  readonly maxPoints?: number
  /** Auto-scroll time window in ms (default: 60000 = 1 minute) */
  readonly timeWindowMs?: number
}

// ─────────────────────────────────────────────────────────────
// Chart State
// ─────────────────────────────────────────────────────────────

/** Chart state published to port */
export interface ChartState {
  readonly chartId: ChartId
  readonly traces: readonly ChartTrace[]
  readonly timeRange: TimeRange
  readonly loading: boolean
  readonly lastUpdated: number
}

/** Time range for chart viewport */
export interface TimeRange {
  readonly start: number
  readonly end: number
}

/** Chart configuration state */
export interface ChartConfig {
  readonly chartId: ChartId
  readonly chartType: ChartType
  readonly maxPoints: number
  readonly timeWindowMs: number
  readonly title?: string
  readonly yAxisLabel?: string
  readonly xAxisLabel?: string
}

// ─────────────────────────────────────────────────────────────
// Trace Utilities
// ─────────────────────────────────────────────────────────────

/** Add a point to a trace, respecting maxPoints */
export const addPointToTrace = (
  trace: ChartTrace,
  point: ChartDataPoint,
  maxPoints: number
): ChartTrace => {
  const newPoints = [...trace.points, point]
  // Trim oldest points if exceeding max
  const trimmedPoints =
    newPoints.length > maxPoints
      ? newPoints.slice(newPoints.length - maxPoints)
      : newPoints

  return {
    ...trace,
    points: trimmedPoints,
  }
}

/** Calculate time range from traces */
export const calculateTimeRange = (
  traces: readonly ChartTrace[],
  windowMs?: number
): TimeRange => {
  const now = Date.now()

  if (windowMs) {
    // Fixed window from now
    return { start: now - windowMs, end: now }
  }

  // Auto-range from data
  let minTime = now
  let maxTime = now

  for (const trace of traces) {
    for (const point of trace.points) {
      if (point.timestamp < minTime) minTime = point.timestamp
      if (point.timestamp > maxTime) maxTime = point.timestamp
    }
  }

  // Add 5% padding
  const range = maxTime - minTime || 1000
  return {
    start: minTime - range * 0.05,
    end: maxTime + range * 0.05,
  }
}

/** Get color for trace by index */
export const getTraceColor = (index: number): string => {
  const colors = [
    "#22d3ee", // cyan-400
    "#f472b6", // pink-400
    "#a78bfa", // violet-400
    "#34d399", // emerald-400
    "#fbbf24", // amber-400
    "#f87171", // red-400
    "#60a5fa", // blue-400
    "#4ade80", // green-400
  ]
  return colors[index % colors.length]
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a Chart overlay for time-series visualization.
 *
 * @param config - Chart configuration
 * @returns Overlay instance
 */
export const createChartOverlay = (config: ChartOverlayConfig): Overlay => {
  const { chartId, name, chartType = "line" } = config
  const overlayId = `chart:${chartId}` as OverlayId
  const dataPort = chartPort.data(chartId)
  const configPort = chartPort.config(chartId)

  return createOverlay({
    id: overlayId,
    name: name ?? `Chart: ${chartId}`,
    visualPriority: 5, // Mid-level priority

    // Chart is reactive — responds to port data
    handlers: {},

    ports: {
      subscriptions: [dataPort, configPort],
      publications: [dataPort],
    },

    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Chart] Enabled chart ${chartId} (${chartType}) in ${containerId}`)
      }),

    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Chart] Disabled chart ${chartId} in ${containerId}`)
      }),
  })
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react"
import { useOverlay, usePort, usePublish } from "../hooks"
import type { UseOverlayResult } from "../hooks/useOverlay"

/** Result of useChart hook */
export interface UseChartResult {
  /** All traces */
  readonly traces: readonly ChartTrace[]
  /** Current time range */
  readonly timeRange: TimeRange
  /** Loading state */
  readonly loading: boolean
  /** Last update timestamp */
  readonly lastUpdated: number
  /** Add a point to a trace (creates trace if needed) */
  readonly addPoint: (traceId: string, point: ChartDataPoint) => void
  /** Add multiple points to a trace */
  readonly addPoints: (traceId: string, points: readonly ChartDataPoint[]) => void
  /** Set entire trace data */
  readonly setTrace: (trace: ChartTrace) => void
  /** Clear a trace */
  readonly clearTrace: (traceId: string) => void
  /** Clear all traces */
  readonly clearAll: () => void
  /** Set time range manually */
  readonly setTimeRange: (range: TimeRange) => void
  /** Set loading state */
  readonly setLoading: (loading: boolean) => void
  /** Get trace color by index */
  readonly getColor: (index: number) => string
  /** Overlay control */
  readonly overlay: UseOverlayResult
}

/** Options for useChart hook */
export interface UseChartOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Chart ID */
  readonly chartId: ChartId
  /** Optional display name */
  readonly name?: string
  /** Chart type */
  readonly chartType?: ChartType
  /** Max points per trace (default: 1000) */
  readonly maxPoints?: number
  /** Auto-scroll time window in ms */
  readonly timeWindowMs?: number
  /** Auto-enable on mount (default: true) */
  readonly autoEnable?: boolean
}

/**
 * Hook for chart data management.
 *
 * @param options - Chart options
 * @returns Chart state and control functions
 */
export function useChart(options: UseChartOptions): UseChartResult {
  const {
    containerId,
    chartId,
    name,
    chartType = "line",
    maxPoints = 1000,
    timeWindowMs,
    autoEnable = true,
  } = options

  // Create overlay instance
  const overlayInstance = useMemo(
    () =>
      createChartOverlay({
        chartId,
        name,
        chartType,
        maxPoints,
        timeWindowMs,
      }),
    [chartId, name, chartType, maxPoints, timeWindowMs]
  )

  // Register overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  })

  // Subscribe to chart state
  const chartState = usePort<ChartState>({
    containerId,
    portId: chartPort.data(chartId),
    initialValue: {
      chartId,
      traces: [],
      timeRange: { start: Date.now() - 60000, end: Date.now() },
      loading: false,
      lastUpdated: Date.now(),
    },
  })

  // Publisher
  const publish = usePublish<ChartState>(containerId, chartPort.data(chartId))

  // Actions
  const addPoint = useCallback(
    (traceId: string, point: ChartDataPoint) => {
      const current = chartState.value
      if (!current) return

      const traceIndex = current.traces.findIndex((t) => t.traceId === traceId)
      let newTraces: ChartTrace[]

      if (traceIndex === -1) {
        // Create new trace
        const newTrace: ChartTrace = {
          traceId,
          name: traceId,
          points: [point],
          color: getTraceColor(current.traces.length),
        }
        newTraces = [...current.traces, newTrace]
      } else {
        // Add to existing trace
        const trace = current.traces[traceIndex]
        const updatedTrace = addPointToTrace(trace, point, maxPoints)
        newTraces = [
          ...current.traces.slice(0, traceIndex),
          updatedTrace,
          ...current.traces.slice(traceIndex + 1),
        ]
      }

      publish({
        ...current,
        traces: newTraces,
        timeRange: calculateTimeRange(newTraces, timeWindowMs),
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, maxPoints, timeWindowMs, publish]
  )

  const addPoints = useCallback(
    (traceId: string, points: readonly ChartDataPoint[]) => {
      const current = chartState.value
      if (!current) return

      const traceIndex = current.traces.findIndex((t) => t.traceId === traceId)
      let newTraces: ChartTrace[]

      if (traceIndex === -1) {
        // Create new trace with all points
        const trimmedPoints =
          points.length > maxPoints ? points.slice(points.length - maxPoints) : [...points]
        const newTrace: ChartTrace = {
          traceId,
          name: traceId,
          points: trimmedPoints,
          color: getTraceColor(current.traces.length),
        }
        newTraces = [...current.traces, newTrace]
      } else {
        // Add to existing trace
        let trace = current.traces[traceIndex]
        for (const point of points) {
          trace = addPointToTrace(trace, point, maxPoints)
        }
        newTraces = [
          ...current.traces.slice(0, traceIndex),
          trace,
          ...current.traces.slice(traceIndex + 1),
        ]
      }

      publish({
        ...current,
        traces: newTraces,
        timeRange: calculateTimeRange(newTraces, timeWindowMs),
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, maxPoints, timeWindowMs, publish]
  )

  const setTrace = useCallback(
    (trace: ChartTrace) => {
      const current = chartState.value
      if (!current) return

      const traceIndex = current.traces.findIndex((t) => t.traceId === trace.traceId)
      let newTraces: ChartTrace[]

      if (traceIndex === -1) {
        newTraces = [...current.traces, trace]
      } else {
        newTraces = [
          ...current.traces.slice(0, traceIndex),
          trace,
          ...current.traces.slice(traceIndex + 1),
        ]
      }

      publish({
        ...current,
        traces: newTraces,
        timeRange: calculateTimeRange(newTraces, timeWindowMs),
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, timeWindowMs, publish]
  )

  const clearTrace = useCallback(
    (traceId: string) => {
      const current = chartState.value
      if (!current) return

      const newTraces = current.traces.filter((t) => t.traceId !== traceId)

      publish({
        ...current,
        traces: newTraces,
        timeRange: calculateTimeRange(newTraces, timeWindowMs),
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, timeWindowMs, publish]
  )

  const clearAll = useCallback(() => {
    const current = chartState.value
    if (!current) return

    publish({
      ...current,
      traces: [],
      timeRange: { start: Date.now() - 60000, end: Date.now() },
      lastUpdated: Date.now(),
    })
  }, [chartState.value, publish])

  const setTimeRange = useCallback(
    (range: TimeRange) => {
      const current = chartState.value
      if (!current) return

      publish({
        ...current,
        timeRange: range,
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, publish]
  )

  const setLoading = useCallback(
    (loading: boolean) => {
      const current = chartState.value
      if (!current) return

      publish({
        ...current,
        loading,
        lastUpdated: Date.now(),
      })
    },
    [chartState.value, publish]
  )

  // Extract values
  const state = chartState.value ?? {
    chartId,
    traces: [],
    timeRange: { start: Date.now() - 60000, end: Date.now() },
    loading: false,
    lastUpdated: Date.now(),
  }

  return {
    traces: state.traces,
    timeRange: state.timeRange,
    loading: state.loading,
    lastUpdated: state.lastUpdated,
    addPoint,
    addPoints,
    setTrace,
    clearTrace,
    clearAll,
    setTimeRange,
    setLoading,
    getColor: getTraceColor,
    overlay,
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Helpers (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create a chart trace for testing.
 */
export const createChartTrace = (
  traceId: string,
  points: readonly ChartDataPoint[],
  name?: string,
  color?: string
): ChartTrace => ({
  traceId,
  name: name ?? traceId,
  points: [...points],
  color,
})

/**
 * Create a data point for testing.
 */
export const createDataPoint = (
  value: number,
  timestamp?: number,
  label?: string
): ChartDataPoint => ({
  timestamp: timestamp ?? Date.now(),
  value,
  label,
})

/**
 * Generate sine wave test data.
 */
export const generateSineWave = (
  points: number,
  frequency: number = 1,
  amplitude: number = 1,
  offset: number = 0
): ChartDataPoint[] => {
  const now = Date.now()
  const interval = 1000 // 1 second between points

  return Array.from({ length: points }, (_, i) => ({
    timestamp: now - (points - i) * interval,
    value: offset + amplitude * Math.sin((2 * Math.PI * frequency * i) / points),
  }))
}
