/**
 * Throughput Panel
 *
 * Real-time throughput visualization with D3 line chart.
 * Uses throughputTimeseriesAtom for persistent data across tab switches.
 *
 * @module
 */

import { useAtomValue } from '@effect-atom/atom-react'
import {
  throughputAtom,
  throughputTimeseriesAtom,
  rawThroughputAtom,
  feedModeAtom,
} from '@/lib/streams/playground'
import { D3LineChart } from '../viz'
import { MetricBadge } from '@/components/primitives'

// =============================================================================
// TYPES
// =============================================================================

interface ThroughputPanelProps {
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
  /** Max points to display */
  maxPoints?: number
}

// =============================================================================
// THROUGHPUT PANEL
// =============================================================================

/**
 * Throughput visualization panel.
 *
 * Shows:
 * - Real-time line chart of events/sec
 * - Current, peak, and average metrics
 *
 * Timeseries data is stored in throughputTimeseriesAtom for persistence
 * across tab switches.
 */
export function ThroughputPanel({
  width = 600,
  height = 250,
  maxPoints = 60,
}: ThroughputPanelProps) {
  // Atoms return values directly (Atom-as-State pattern)
  const throughput = useAtomValue(throughputAtom)
  const feedMode = useAtomValue(feedModeAtom)

  // Select feed based on mode
  const downsampledTimeseries = useAtomValue(throughputTimeseriesAtom)
  const rawTimeseries = useAtomValue(rawThroughputAtom)
  const timeseries = feedMode === 'raw' ? rawTimeseries : downsampledTimeseries

  return (
    <div className="p-4 bg-neutral-900/30 rounded-lg border border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Throughput
        </h3>
        <div className="flex items-center gap-4">
          <MetricBadge
            label="Current"
            value={throughput.eventsPerSecond}
            unit="/s"
            accent="cyan"
          />
          <MetricBadge
            label="Peak"
            value={throughput.peakEventsPerSecond}
            unit="/s"
            accent="amber"
          />
          <MetricBadge
            label="Avg"
            value={Math.round(throughput.avgEventsPerSecond)}
            unit="/s"
            accent="neutral"
          />
        </div>
      </div>

      {/* Chart */}
      <D3LineChart
        data={timeseries}
        width={width}
        height={height}
        yLabel={feedMode === 'raw' ? 'Events' : 'Events/sec'}
        color={feedMode === 'raw' ? '#f59e0b' : '#22d3ee'}
        showArea
      />

      {/* Footer */}
      <div
        className="flex items-center justify-between mt-2 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span>Total: {throughput.totalEvents.toLocaleString()} events</span>
        <span>
          {feedMode === 'raw' ? (
            <span className="text-amber-400">{timeseries.length} samples</span>
          ) : (
            `Window: ${maxPoints}s`
          )}
        </span>
      </div>
    </div>
  )
}

export default ThroughputPanel
