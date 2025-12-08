/**
 * SubgraphView
 *
 * Multi-chart grid component for displaying correlated signals.
 * Inspired by oscilloscope multi-channel displays.
 *
 * @example
 * ```tsx
 * <SubgraphView
 *   charts={[
 *     { id: "ch1", title: "Channel 1", kind: "line" },
 *     { id: "ch2", title: "Channel 2", kind: "line" },
 *     { id: "ch3", title: "Channel 3", kind: "bar" },
 *   ]}
 *   columns={2}
 *   syncTime={true}
 * />
 * ```
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Chart } from "../Chart"
import { useChart } from "../hooks/useChart"
import { generateSignal, RingBuffer, RealtimeSignalGenerator } from "../streams"
import { CHART_TOKENS } from "../tokens"
import { ChartKind, ChartState, type ChartSeries } from "../types"

// =============================================================================
// TYPES
// =============================================================================

export interface SubgraphChannel {
  /** Unique channel ID */
  id: string
  /** Display title */
  title: string
  /** Chart type */
  kind: "line" | "bar" | "scatter"
  /** Signal frequency for streaming (Hz) */
  frequency?: number
  /** Amplitude multiplier */
  amplitude?: number
  /** Custom color override */
  color?: string
}

export interface SubgraphViewProps {
  /** Channel configurations */
  channels: SubgraphChannel[]
  /** Grid columns (default: auto based on count) */
  columns?: number
  /** Row height in pixels */
  rowHeight?: number
  /** Enable real-time streaming */
  streaming?: boolean
  /** Stream FPS */
  streamFps?: number
  /** Buffer size for streaming */
  bufferSize?: number
  /** Sync time axis across channels */
  syncTime?: boolean
  /** Container className */
  className?: string
}

// =============================================================================
// CHANNEL COMPONENT
// =============================================================================

interface ChannelProps {
  channel: SubgraphChannel
  height: number
  streaming: boolean
  streamFps: number
  bufferSize: number
}

function Channel({ channel, height, streaming, streamFps, bufferSize }: ChannelProps) {
  const kind =
    channel.kind === "line"
      ? Chart.Kind.Line
      : channel.kind === "bar"
        ? Chart.Kind.Bar
        : Chart.Kind.Scatter

  const { containerRef, chart, state, setData } = useChart({
    config: {
      id: `subgraph-${channel.id}`,
      kind,
      renderer: Chart.Renderer.ECharts,
      height: height - 24, // Account for header
      animate: !streaming,
    },
  })

  const [fps, setFps] = useState(0)
  const bufferRef = useRef<RingBuffer | null>(null)
  const generatorRef = useRef<RealtimeSignalGenerator | null>(null)

  // Static data for non-streaming
  useEffect(() => {
    if (state === Chart.State.Ready && !streaming) {
      const data = generateSignal({
        pointCount: 100,
        frequency: channel.frequency ?? 2,
        amplitude: channel.amplitude ?? 1,
        noise: 0.1,
      })
      setData(data)
    }
  }, [state, streaming, channel.frequency, channel.amplitude, setData])

  // Streaming mode
  useEffect(() => {
    if (state !== Chart.State.Ready || !streaming) return

    const buffer = new RingBuffer(bufferSize)
    const generator = new RealtimeSignalGenerator(buffer)
    bufferRef.current = buffer
    generatorRef.current = generator

    generator.start(channel.frequency ?? 2, streamFps)

    let lastTime = performance.now()
    let frameCount = 0
    let frameId: number

    const updateChart = () => {
      const snapshot = buffer.snapshot()
      const data: ChartSeries = Array.from(snapshot.data).map((y, i) => ({
        t: i,
        x: i,
        y: y * (channel.amplitude ?? 1),
      }))
      setData(data)

      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        lastTime = now
      }

      frameId = requestAnimationFrame(updateChart)
    }

    frameId = requestAnimationFrame(updateChart)

    return () => {
      generator.stop()
      cancelAnimationFrame(frameId)
    }
  }, [state, streaming, channel.frequency, channel.amplitude, streamFps, bufferSize, setData])

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        height,
        background: CHART_TOKENS.colors.chartBackground,
        border: `1px solid ${CHART_TOKENS.colors.chartBorder}`,
      }}
    >
      {/* Corner decorations */}
      <div
        className="absolute top-0 left-0 w-1 h-1 border-t border-l"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute top-0 right-0 w-1 h-1 border-t border-r"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute bottom-0 left-0 w-1 h-1 border-b border-l"
        style={{ borderColor: CHART_TOKENS.colors.chartGrid }}
      />
      <div
        className="absolute bottom-0 right-0 w-1 h-1 border-b border-r"
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
        <div
          className="w-1.5 h-1.5 mr-2"
          style={{
            background: channel.color ?? CHART_TOKENS.colors.waveGreen,
            boxShadow: `0 0 4px ${channel.color ?? CHART_TOKENS.colors.waveGreen}`,
          }}
        />
        <span
          className="font-mono uppercase tracking-widest"
          style={{ color: CHART_TOKENS.colors.textSecondary, fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {channel.title}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {streaming && (
            <span
              className="font-mono"
              style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {fps} FPS
            </span>
          )}
          <span
            className="font-mono uppercase"
            style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {channel.kind}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: 0 }} />

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
            {state}
          </span>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SUBGRAPH VIEW COMPONENT
// =============================================================================

export function SubgraphView({
  channels,
  columns,
  rowHeight = 180,
  streaming = false,
  streamFps = 30,
  bufferSize = 256,
  syncTime = false,
  className = "",
}: SubgraphViewProps) {
  // Auto-calculate columns if not specified
  const gridColumns = useMemo(() => {
    if (columns) return columns
    if (channels.length <= 2) return channels.length
    if (channels.length <= 4) return 2
    return 3
  }, [columns, channels.length])

  const [isStreaming, setIsStreaming] = useState(streaming)

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div
        className="h-8 flex items-center px-3 border-b"
        style={{
          background: CHART_TOKENS.colors.chartBackground,
          borderColor: CHART_TOKENS.colors.chartBorder,
        }}
      >
        <span
          className="font-mono uppercase tracking-widest"
          style={{ color: CHART_TOKENS.colors.textSecondary, fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          SUBGRAPH VIEW
        </span>
        <span
          className="ml-2 font-mono"
          style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {channels.length} channels
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Stream toggle */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="px-2 py-0.5 font-mono uppercase tracking-wide transition-all"
            style={{
              fontSize: 'var(--tmnl-text-xs, 12px)',
              background: isStreaming ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isStreaming ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.1)"}`,
              color: isStreaming ? CHART_TOKENS.colors.waveGreen : CHART_TOKENS.colors.textMuted,
            }}
          >
            {isStreaming ? "STREAMING" : "STATIC"}
          </button>

          {/* Sync indicator */}
          {syncTime && (
            <div className="flex items-center gap-1">
              <div
                className="w-1 h-1"
                style={{ background: CHART_TOKENS.colors.waveAmber }}
              />
              <span
                className="font-mono uppercase"
                style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                SYNC
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          background: CHART_TOKENS.colors.chartBorder,
        }}
      >
        {channels.map((channel) => (
          <Channel
            key={channel.id}
            channel={channel}
            height={rowHeight}
            streaming={isStreaming}
            streamFps={streamFps}
            bufferSize={bufferSize}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="h-6 flex items-center px-3 border-t"
        style={{
          background: CHART_TOKENS.colors.chartBackground,
          borderColor: CHART_TOKENS.colors.chartBorder,
        }}
      >
        <span
          className="font-mono"
          style={{ color: CHART_TOKENS.colors.textMuted, fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {isStreaming ? `${streamFps} FPS • ${bufferSize} samples` : "Static mode"}
        </span>
      </div>
    </div>
  )
}

export default SubgraphView
