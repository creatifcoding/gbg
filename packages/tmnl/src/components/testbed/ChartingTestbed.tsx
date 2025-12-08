/**
 * TMNL Charting Testbed
 *
 * Demonstrates Chart.make({}) API with multiple chart types.
 *
 * Route: /testbed/charting
 */

import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeft, LineChart, BarChart3, ScatterChart, Activity, Layers } from "lucide-react"
import {
  Chart,
  useChart,
  useLineChart,
  generateSignal,
  generateDualSignal,
  RingBuffer,
  RealtimeSignalGenerator,
  CHART_TOKENS,
  SubgraphView,
  type ChartSeries,
} from "@/lib/charting/v1"
import {
  VantaCard,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
} from "@/components/portal"
import { SectionLabel } from "@/components/testbed/shared"

// ─────────────────────────────────────────────────────────────────────────────
// Case 1: Basic Line Chart with useChart hook
// ─────────────────────────────────────────────────────────────────────────────

function Case1_LineChart() {
  const { containerRef, state, setData } = useChart({
    config: {
      id: "case1-line",
      kind: Chart.Kind.Line,
      renderer: Chart.Renderer.ECharts,
      height: 280,
    },
  })

  useEffect(() => {
    if (state === Chart.State.Ready) {
      const data = generateSignal({
        pointCount: 100,
        frequency: 2,
        amplitude: 1,
        noise: 0.1,
      })
      setData(data)
    }
  }, [state, setData])

  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <LineChart size={14} style={{ color: VANTA_COLORS.accent.cyan }} />
          <VantaCard.Title>LINE CHART</VantaCard.Title>
        </div>
        <VantaCard.Indicator status={state === Chart.State.Ready ? "active" : "pending"} />
      </VantaCard.Header>
      <VantaCard.Subtitle>useChart hook with generateSignal</VantaCard.Subtitle>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          background: CHART_TOKENS.colors.chartBackground,
          marginTop: 12,
        }}
      />
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 2: Shorthand Hook (useLineChart)
// ─────────────────────────────────────────────────────────────────────────────

function Case2_ShorthandHook() {
  const { containerRef, state, setData } = useLineChart("case2-shorthand", {
    height: 280,
  })

  useEffect(() => {
    if (state === Chart.State.Ready) {
      const { wave1 } = generateDualSignal(
        { pointCount: 100, frequency: 3, amplitude: 0.8 },
        { pointCount: 100, frequency: 5, amplitude: 0.5, phase: Math.PI / 4 }
      )
      setData(wave1)
    }
  }, [state, setData])

  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: VANTA_COLORS.accent.emerald }} />
          <VantaCard.Title>SHORTHAND HOOK</VantaCard.Title>
        </div>
        <VantaCard.Indicator status={state === Chart.State.Ready ? "active" : "pending"} />
      </VantaCard.Header>
      <VantaCard.Subtitle>useLineChart convenience wrapper</VantaCard.Subtitle>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          background: CHART_TOKENS.colors.chartBackground,
          marginTop: 12,
        }}
      />
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 3: Real-time Streaming with RingBuffer
// ─────────────────────────────────────────────────────────────────────────────

function Case3_RealtimeStream() {
  const { containerRef, state, setData } = useChart({
    config: {
      id: "case3-realtime",
      kind: Chart.Kind.Line,
      renderer: Chart.Renderer.ECharts,
      height: 280,
      animate: false,
    },
  })

  const [isStreaming, setIsStreaming] = useState(false)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    if (state !== Chart.State.Ready || !isStreaming) return

    const buffer = new RingBuffer(256)
    const generator = new RealtimeSignalGenerator(buffer)

    generator.start(2, 60)

    let lastTime = performance.now()
    let frameCount = 0

    const updateChart = () => {
      if (!isStreaming) return

      const snapshot = buffer.snapshot()
      const data: ChartSeries = Array.from(snapshot.data).map((y, i) => ({
        t: i,
        x: i,
        y,
      }))
      setData(data)

      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        lastTime = now
      }

      requestAnimationFrame(updateChart)
    }

    const frameId = requestAnimationFrame(updateChart)

    return () => {
      generator.stop()
      cancelAnimationFrame(frameId)
    }
  }, [state, isStreaming, setData])

  return (
    <VantaCard variant="elevated" corners glow glowColor={isStreaming ? "emerald" : "neutral"}>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <Activity size={14} style={{ color: isStreaming ? VANTA_COLORS.accent.emerald : VANTA_COLORS.text.muted }} />
          <VantaCard.Title>REALTIME STREAM</VantaCard.Title>
        </div>
        <VantaCard.Indicator status={isStreaming ? "active" : "inactive"} label={isStreaming ? `${fps} FPS` : "IDLE"} />
      </VantaCard.Header>
      <VantaCard.Subtitle>RingBuffer + RealtimeSignalGenerator</VantaCard.Subtitle>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          background: CHART_TOKENS.colors.chartBackground,
          marginTop: 12,
        }}
      />
      <VantaCard.Divider />
      <VantaCard.Actions>
        <VantaCard.Action
          variant={isStreaming ? "ghost" : "primary"}
          onClick={() => setIsStreaming(!isStreaming)}
        >
          {isStreaming ? "STOP" : "START STREAM"}
        </VantaCard.Action>
      </VantaCard.Actions>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 4: Bar Chart
// ─────────────────────────────────────────────────────────────────────────────

function Case4_BarChart() {
  const { containerRef, state, setData } = useChart({
    config: {
      id: "case4-bar",
      kind: Chart.Kind.Bar,
      renderer: Chart.Renderer.ECharts,
      height: 280,
    },
  })

  useEffect(() => {
    if (state === Chart.State.Ready) {
      const data: ChartSeries = [
        { t: 0, x: 0, y: 120, series: "A" },
        { t: 1, x: 1, y: 200, series: "A" },
        { t: 2, x: 2, y: 150, series: "A" },
        { t: 3, x: 3, y: 80, series: "A" },
        { t: 4, x: 4, y: 190, series: "A" },
        { t: 5, x: 5, y: 130, series: "A" },
      ]
      setData(data)
    }
  }, [state, setData])

  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} style={{ color: VANTA_COLORS.accent.amber }} />
          <VantaCard.Title>BAR CHART</VantaCard.Title>
        </div>
        <VantaCard.Indicator status={state === Chart.State.Ready ? "active" : "pending"} />
      </VantaCard.Header>
      <VantaCard.Subtitle>Chart.Kind.Bar with static data</VantaCard.Subtitle>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          background: CHART_TOKENS.colors.chartBackground,
          marginTop: 12,
        }}
      />
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 5: Scatter Chart
// ─────────────────────────────────────────────────────────────────────────────

function Case5_ScatterChart() {
  const { containerRef, state, setData } = useChart({
    config: {
      id: "case5-scatter",
      kind: Chart.Kind.Scatter,
      renderer: Chart.Renderer.ECharts,
      height: 280,
      projection: Chart.Projections.XY,
    },
  })

  useEffect(() => {
    if (state === Chart.State.Ready) {
      const data: ChartSeries = Array.from({ length: 50 }, (_, i) => ({
        t: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
      }))
      setData(data)
    }
  }, [state, setData])

  return (
    <VantaCard variant="default" corners>
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <ScatterChart size={14} style={{ color: VANTA_COLORS.accent.rose }} />
          <VantaCard.Title>SCATTER CHART</VantaCard.Title>
        </div>
        <VantaCard.Indicator status={state === Chart.State.Ready ? "active" : "pending"} />
      </VantaCard.Header>
      <VantaCard.Subtitle>XY projection with random data</VantaCard.Subtitle>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 280,
          background: CHART_TOKENS.colors.chartBackground,
          marginTop: 12,
        }}
      />
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Case 6: SubgraphView (Multi-Chart Grid)
// ─────────────────────────────────────────────────────────────────────────────

function Case6_SubgraphView() {
  const channels = [
    { id: "ch1", title: "CHANNEL 1", kind: "line" as const, frequency: 2, color: CHART_TOKENS.colors.waveGreen },
    { id: "ch2", title: "CHANNEL 2", kind: "line" as const, frequency: 3, color: CHART_TOKENS.colors.waveAmber },
    { id: "ch3", title: "CHANNEL 3", kind: "line" as const, frequency: 5, color: CHART_TOKENS.colors.waveCyan },
    { id: "ch4", title: "CHANNEL 4", kind: "bar" as const, frequency: 1, color: CHART_TOKENS.colors.waveRed },
  ]

  return (
    <VantaCard variant="elevated" corners glow glowColor="cyan" className="col-span-2">
      <VantaCard.Header>
        <div className="flex items-center gap-2">
          <Layers size={14} style={{ color: VANTA_COLORS.accent.cyan }} />
          <VantaCard.Title>SUBGRAPH VIEW</VantaCard.Title>
        </div>
        <VantaCard.Indicator status="active" label="4 CH" />
      </VantaCard.Header>
      <VantaCard.Subtitle>Multi-channel oscilloscope display</VantaCard.Subtitle>
      <div style={{ marginTop: 12 }}>
        <SubgraphView
          channels={channels}
          columns={2}
          rowHeight={180}
          streaming={false}
          streamFps={30}
          bufferSize={256}
        />
      </div>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// API Reference Card
// ─────────────────────────────────────────────────────────────────────────────

function APIReferenceCard() {
  return (
    <VantaCard variant="ghost">
      <VantaCard.Header>
        <VantaCard.Title>API REFERENCE</VantaCard.Title>
      </VantaCard.Header>
      <pre
        style={{
          ...VANTA_TYPOGRAPHY.preset.micro,
          color: VANTA_COLORS.text.secondary,
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
        }}
      >
{`// Factory API
const chart = Chart.make({
  id: "my-chart",
  kind: Chart.Kind.Line,
  renderer: Chart.Renderer.ECharts,
})

// Shorthand
const line = Chart.line({ id: "line-1" })
const bar = Chart.bar({ id: "bar-1" })

// React hook
const { containerRef, setData } = useChart({
  config: { id: "chart", ... }
})

// Signal generators
const data = generateSignal({
  pointCount: 512,
  frequency: 2,
})

// Real-time streaming
const buffer = new RingBuffer(256)
const gen = new RealtimeSignalGenerator(buffer)
gen.start(2, 60) // 2Hz @ 60fps`}
      </pre>
    </VantaCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Testbed
// ─────────────────────────────────────────────────────────────────────────────

export function ChartingTestbed() {
  return (
    <div
      className="min-h-screen w-screen"
      style={{ backgroundColor: VANTA_COLORS.surface.void }}
    >
      {/* Header */}
      <header
        className="border-b sticky top-0 z-10"
        style={{
          borderColor: VANTA_COLORS.surface.border,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              style={{ color: VANTA_COLORS.text.muted }}
              className="hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1
                style={{
                  ...VANTA_TYPOGRAPHY.preset.cardTitle,
                  color: VANTA_COLORS.text.primary,
                  fontSize: VANTA_TYPOGRAPHY.size.sm,
                }}
              >
                Charting Testbed
              </h1>
              <p
                style={{
                  ...VANTA_TYPOGRAPHY.preset.micro,
                  color: VANTA_COLORS.text.muted,
                  marginTop: "2px",
                }}
              >
                Chart.make({"{}"}) API • v1 experimental
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/testbed/vanta"
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
              className="hover:text-white transition-colors"
            >
              VANTA
            </Link>
            <Link
              to="/testbed/data-grid"
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
              className="hover:text-white transition-colors"
            >
              GRID
            </Link>
            <Link
              to="/testbed/data-manager"
              style={{
                ...VANTA_TYPOGRAPHY.preset.label,
                color: VANTA_COLORS.text.muted,
              }}
              className="hover:text-white transition-colors"
            >
              DATA
            </Link>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: VANTA_COLORS.accent.cyan }}
              />
              <span
                style={{
                  ...VANTA_TYPOGRAPHY.preset.label,
                  color: VANTA_COLORS.text.muted,
                }}
              >
                CHARTING v1
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-12">
        {/* Basic Charts */}
        <section>
          <SectionLabel variant="gradient">Basic Chart Types</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Case1_LineChart />
            <Case2_ShorthandHook />
            <Case4_BarChart />
            <Case5_ScatterChart />
          </div>
        </section>

        {/* Streaming */}
        <section>
          <SectionLabel variant="gradient">Real-time Streaming</SectionLabel>
          <Case3_RealtimeStream />
        </section>

        {/* Multi-Channel */}
        <section>
          <SectionLabel variant="gradient">Multi-Channel Display</SectionLabel>
          <Case6_SubgraphView />
        </section>

        {/* API Reference */}
        <section>
          <SectionLabel variant="gradient">API Reference</SectionLabel>
          <APIReferenceCard />
        </section>
      </main>
    </div>
  )
}

export default ChartingTestbed
