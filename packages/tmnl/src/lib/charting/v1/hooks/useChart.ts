/**
 * TMNL Charting v1 - useChart Hook
 *
 * React hook for mounting and managing Chart instances.
 *
 * @example
 * ```tsx
 * function MyChart() {
 *   const { containerRef, chart, state } = useChart({
 *     id: "my-chart",
 *     kind: Chart.Kind.Line,
 *     renderer: Chart.Renderer.ECharts,
 *   })
 *
 *   useEffect(() => {
 *     chart?.setData(myData)
 *   }, [chart, myData])
 *
 *   return <div ref={containerRef} style={{ width: 800, height: 400 }} />
 * }
 * ```
 *
 * @experimental v1 API may change.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import { Chart, type ChartConfig, type ChartInstance, type ChartSeries } from "../Chart"
import { ChartState } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Hook Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseChartOptions<TConfig extends ChartConfig> {
  /** Chart configuration */
  config: TConfig
  /** Initial data (optional) */
  initialData?: ChartSeries
  /** Auto-mount when container is available */
  autoMount?: boolean
}

export interface UseChartResult<TConfig extends ChartConfig> {
  /** Ref to attach to container element */
  containerRef: React.RefObject<HTMLDivElement>
  /** Chart instance (null until mounted) */
  chart: ChartInstance<TConfig> | null
  /** Current chart state */
  state: ChartState
  /** Error if any */
  error: Error | null
  /** Manual mount function */
  mount: () => Promise<void>
  /** Manual unmount function */
  unmount: () => void
  /** Set chart data */
  setData: (data: ChartSeries) => void
  /** Append to chart data */
  appendData: (data: ChartSeries) => void
  /** Clear chart data */
  clearData: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// useChart Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for Chart instances
 */
export function useChart<TConfig extends ChartConfig>(
  options: UseChartOptions<TConfig>
): UseChartResult<TConfig> {
  const { config, initialData, autoMount = true } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartInstance<TConfig> | null>(null)
  const [state, setState] = useState<ChartState>(ChartState.Uninitialized)
  const [error, setError] = useState<Error | null>(null)

  // Create chart instance (memoized by config.id)
  const chart = useMemo(() => {
    // Dispose previous instance if id changed
    if (chartRef.current && chartRef.current.id !== config.id) {
      chartRef.current.dispose()
    }
    const instance = Chart.make(config)
    chartRef.current = instance
    return instance
  }, [config.id]) // Only recreate if id changes

  // Subscribe to state changes
  useEffect(() => {
    if (!chart) return

    const unsubscribe = chart.onStateChange((newState) => {
      setState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [chart])

  // Mount function
  const mount = useCallback(async () => {
    if (!containerRef.current || !chart) return
    if (chart.state !== ChartState.Uninitialized) return

    try {
      setError(null)
      await chart.mount(containerRef.current)

      // Set initial data if provided
      if (initialData && initialData.length > 0) {
        chart.setData(initialData)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [chart, initialData])

  // Unmount function
  const unmount = useCallback(() => {
    if (!chart) return
    chart.unmount()
  }, [chart])

  // Auto-mount effect
  useEffect(() => {
    if (!autoMount) return
    if (!containerRef.current) return

    // Wait for next frame to ensure container has dimensions
    const frameId = requestAnimationFrame(() => {
      mount()
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [autoMount, mount])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
    }
  }, [])

  // Data operations (proxied to chart instance)
  const setData = useCallback(
    (data: ChartSeries) => {
      chart?.setData(data)
    },
    [chart]
  )

  const appendData = useCallback(
    (data: ChartSeries) => {
      chart?.appendData(data)
    },
    [chart]
  )

  const clearData = useCallback(() => {
    chart?.clearData()
  }, [chart])

  return {
    containerRef,
    chart,
    state,
    error,
    mount,
    unmount,
    setData,
    appendData,
    clearData,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shorthand hook for line charts
 */
export function useLineChart(
  id: string,
  options?: Partial<Omit<ChartConfig, "id" | "kind" | "renderer">>
) {
  return useChart({
    config: {
      id,
      kind: Chart.Kind.Line,
      renderer: Chart.Renderer.ECharts,
      ...options,
    },
  })
}

/**
 * Shorthand hook for bar charts
 */
export function useBarChart(
  id: string,
  options?: Partial<Omit<ChartConfig, "id" | "kind" | "renderer">>
) {
  return useChart({
    config: {
      id,
      kind: Chart.Kind.Bar,
      renderer: Chart.Renderer.ECharts,
      ...options,
    },
  })
}

/**
 * Shorthand hook for scatter charts
 */
export function useScatterChart(
  id: string,
  options?: Partial<Omit<ChartConfig, "id" | "kind" | "renderer">>
) {
  return useChart({
    config: {
      id,
      kind: Chart.Kind.Scatter,
      renderer: Chart.Renderer.ECharts,
      ...options,
    },
  })
}
