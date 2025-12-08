/**
 * EChartsWidgetShape
 *
 * tldraw shape integration for Chart.make({}) API.
 * Renders ECharts-based charts as resizable canvas objects.
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
  stopEventPropagation,
} from "tldraw"
import { useEffect, useRef, useCallback, useState } from "react"
import { Activity, Play, Square, RefreshCw } from "lucide-react"
import {
  Chart,
  useChart,
  generateSignal,
  RingBuffer,
  RealtimeSignalGenerator,
  CHART_TOKENS,
  type ChartSeries,
} from "@/lib/charting/v1"

// =============================================================================
// SHAPE TYPE
// =============================================================================

export type EChartsWidgetShape = TLBaseShape<
  "echarts-widget",
  {
    w: number
    h: number
    title: string
    chartKind: "line" | "bar" | "scatter"
    isStreaming: boolean
    streamFrequency: number // Hz
    streamFps: number
    bufferSize: number
  }
>

// =============================================================================
// ECHARTS COMPONENT
// =============================================================================

function EChartsComponent({ shape }: { shape: EChartsWidgetShape }) {
  const { title, chartKind, isStreaming, streamFrequency, streamFps, bufferSize, w, h } = shape.props
  const chartHeight = h - 28 // Account for header

  // Map chartKind to Chart.Kind
  const kind =
    chartKind === "line"
      ? Chart.Kind.Line
      : chartKind === "bar"
        ? Chart.Kind.Bar
        : Chart.Kind.Scatter

  // useChart hook for mounting
  const { containerRef, chart, state, setData } = useChart({
    config: {
      id: `tldraw-${shape.id}`,
      kind,
      renderer: Chart.Renderer.ECharts,
      title: undefined, // We render our own header
      height: chartHeight,
      animate: !isStreaming, // Disable animation for streaming
    },
  })

  // Streaming state
  const [fps, setFps] = useState(0)
  const bufferRef = useRef<RingBuffer | null>(null)
  const generatorRef = useRef<RealtimeSignalGenerator | null>(null)
  const frameIdRef = useRef<number | null>(null)

  // Initialize with static data if not streaming
  useEffect(() => {
    if (state === Chart.State.Ready && !isStreaming) {
      const data = generateSignal({
        pointCount: 100,
        frequency: 2,
        amplitude: 1,
        noise: 0.1,
      })
      setData(data)
    }
  }, [state, isStreaming, setData])

  // Streaming effect
  useEffect(() => {
    if (state !== Chart.State.Ready || !isStreaming) return

    // Create buffer and generator
    const buffer = new RingBuffer(bufferSize)
    const generator = new RealtimeSignalGenerator(buffer)
    bufferRef.current = buffer
    generatorRef.current = generator

    generator.start(streamFrequency, streamFps)

    let lastTime = performance.now()
    let frameCount = 0

    const updateChart = () => {
      const snapshot = buffer.snapshot()
      const data: ChartSeries = Array.from(snapshot.data).map((y, i) => ({
        t: i,
        x: i,
        y,
      }))
      setData(data)

      // FPS calculation
      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        lastTime = now
      }

      frameIdRef.current = requestAnimationFrame(updateChart)
    }

    frameIdRef.current = requestAnimationFrame(updateChart)

    return () => {
      generator.stop()
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
    }
  }, [state, isStreaming, streamFrequency, streamFps, bufferSize, setData])

  // Resize handler
  useEffect(() => {
    if (chart && state === Chart.State.Ready) {
      chart.resize?.()
    }
  }, [chart, state, w, h])

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden group relative"
      style={{
        background: CHART_TOKENS.colors.chartBackground,
        border: `1px solid ${CHART_TOKENS.colors.chartBorder}`,
      }}
      onPointerDown={stopEventPropagation}
      onPointerMove={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      onWheel={stopEventPropagation}
    >
      {/* Corner decorations */}
      <div
        className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />

      {/* Header */}
      <div
        className="h-6 flex-shrink-0 flex items-center px-2 border-b"
        style={{
          borderColor: CHART_TOKENS.colors.chartBorder,
          background: "rgba(0, 0, 0, 0.3)",
        }}
      >
        <Activity size={12} className="mr-1.5" style={{ color: CHART_TOKENS.colors.textMuted }} />
        <span
          className="font-mono uppercase tracking-widest transition-colors"
          style={{ color: CHART_TOKENS.colors.textSecondary, fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {title}
        </span>

        {/* Status indicators */}
        <div className="ml-auto flex items-center gap-2">
          {isStreaming && (
            <>
              <span
                className="font-mono uppercase"
                style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {fps} FPS
              </span>
              <div
                className="w-1.5 h-1.5 animate-pulse"
                style={{
                  background: CHART_TOKENS.colors.waveRed,
                  boxShadow: `0 0 4px ${CHART_TOKENS.colors.waveRed}`,
                }}
              />
            </>
          )}
          <span
            className="font-mono uppercase"
            style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {chartKind}
          </span>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{
          width: "100%",
          height: chartHeight,
          minHeight: 100,
        }}
      />

      {/* State overlay */}
      {state !== Chart.State.Ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.7)" }}
        >
          <span
            className="font-mono uppercase tracking-widest"
            style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {state === Chart.State.Mounting ? "INITIALIZING..." : state}
          </span>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SHAPE UTIL
// =============================================================================

export class EChartsWidgetShapeUtil extends BaseBoxShapeUtil<EChartsWidgetShape> {
  static override type = "echarts-widget" as const
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    chartKind: T.string,
    isStreaming: T.boolean,
    streamFrequency: T.number,
    streamFps: T.number,
    bufferSize: T.number,
  }

  override canResize() {
    return true
  }

  override canEdit() {
    return false
  }

  getDefaultProps(): EChartsWidgetShape["props"] {
    return {
      w: 400,
      h: 280,
      title: "SIGNAL_SCOPE",
      chartKind: "line",
      isStreaming: false,
      streamFrequency: 2, // 2Hz signal
      streamFps: 30, // 30 updates per second
      bufferSize: 256,
    }
  }

  override onResize(shape: EChartsWidgetShape, info: TLResizeInfo<EChartsWidgetShape>) {
    return resizeBox(shape, info)
  }

  override component(shape: EChartsWidgetShape) {
    return (
      <HTMLContainer id={shape.id} style={{ width: "100%", height: "100%", pointerEvents: "all" }}>
        <EChartsComponent shape={shape} />
      </HTMLContainer>
    )
  }

  override indicator(shape: EChartsWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}
