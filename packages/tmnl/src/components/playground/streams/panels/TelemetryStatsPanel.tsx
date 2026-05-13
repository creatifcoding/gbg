import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAtomValue } from '@effect-atom/atom-react'
import { FoldablePanel } from '@/lib/foldable-panel'
import { RvnTelemetryBar } from '@/lib/rvn'
import {
  throughputAtom,
  throughputTimeseriesAtom,
  rawThroughputAtom,
  latencyAtom,
  rawLatencyTimeseriesAtom,
  latencyDistributionAtom,
  scenarioConfigAtom,
  feedModeAtom,
} from '@/lib/streams/playground'
import type { TopologyLink, TopologyNode } from '../viz'
import { analyzeTopology } from '../topology/TopologyAnalyzer'

export interface TelemetryStatsPanelProps {
  readonly nodes: ReadonlyArray<TopologyNode>
  readonly links: ReadonlyArray<TopologyLink>
  readonly panelId?: string
}

const sparklineGrid = {
  left: 2,
  right: 2,
  top: 2,
  bottom: 2,
}

export function TelemetryStatsPanel({
  nodes,
  links,
  panelId = 'streams-telemetry-stats',
}: TelemetryStatsPanelProps) {
  const throughput = useAtomValue(throughputAtom)
  const throughputSeries = useAtomValue(throughputTimeseriesAtom)
  const rawThroughput = useAtomValue(rawThroughputAtom)
  const latency = useAtomValue(latencyAtom)
  const rawLatency = useAtomValue(rawLatencyTimeseriesAtom)
  const latencyDistribution = useAtomValue(latencyDistributionAtom)
  const scenario = useAtomValue(scenarioConfigAtom)
  const feedMode = useAtomValue(feedModeAtom)

  const topologyMetrics = useMemo(
    () => analyzeTopology(nodes, links),
    [nodes, links]
  )

  const targetThroughput = Math.max(1, scenario.eventsPerSecond)
  const throughputPct = Math.min(
    100,
    (throughput.eventsPerSecond / targetThroughput) * 100
  )

  const latencyBudgetMs = 5
  const latencyHealthPct = Math.max(
    0,
    100 - (latency.p95Ms / latencyBudgetMs) * 100
  )

  const densityPct = topologyMetrics.edgeDensity * 100

  const throughputSparkline = useMemo(() => {
    const points = feedMode === 'raw'
      ? rawThroughput.slice(-120).map((point) => point.value)
      : throughputSeries.slice(-120).map((point) => point.value)

    return {
      animation: false,
      grid: sparklineGrid,
      xAxis: { type: 'category', show: false, data: points.map((_, i) => i) },
      yAxis