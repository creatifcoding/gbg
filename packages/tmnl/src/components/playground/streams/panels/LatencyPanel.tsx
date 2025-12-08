/**
 * Latency Panel
 *
 * Latency distribution visualization with D3 histogram.
 * Uses latencyDistributionAtom for persistent data across tab switches.
 *
 * @module
 */

import { useMemo } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import {
  latencyAtom,
  latencyDistributionAtom,
  rawLatencyTimeseriesAtom,
  feedModeAtom,
} from '@/lib/streams/playground'
import { D3Histogram } from '../viz'

// =============================================================================
// TYPES
// =============================================================================

interface LatencyPanelProps {
  /** Chart width */
  width?: number
  /** Chart height */
  height?: number
}

// =============================================================================
// LATENCY PANEL
// =============================================================================

/**
 * Latency visualization panel.
 *
 * Shows:
 * - Histogram of latency distribution
 * - Min, max, avg, p50, p95, p99 metrics
 */
export function LatencyPanel({
  width = 600,
  height = 250,
}: LatencyPanelProps) {
  // Atoms return values directly (Atom-as-State pattern)
  const latency = useAtomValue(latencyAtom)
  const feedMode = useAtomValue(feedModeAtom)

  // Select feed based on mode
  const downsampledSamples = useAtomValue(latencyDistributionAtom)
  const rawTimeseries = useAtomValue(rawLatencyTimeseriesAtom)

  // Extract values from raw timeseries for histogram (convert ms → μs)
  const samples = useMemo(() => {
    const msValues = feedMode === 'raw'
      ? rawTimeseries.map((p) => p.value)
      : [...downsampledSamples]
    // Convert to microseconds for display
    return msValues.map(ms => ms * 1000)
  }, [feedMode, rawTimeseries, downsampledSamples])

  // Convert latency metrics to microseconds
  const toMicro = (ms: number) => ms * 1000

  return (
    <div className="p-4 bg-neutral-900/30 rounded-lg border border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="font-mono uppercase tracking-wider text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Latency Distribution
        </h3>
        <div className="flex items-center gap-4">
          <MetricBadge
            label="Avg"
            value={toMicro(latency.avgMs)}
            unit="μs"
            accent="green"
          />
          <MetricBadge
            label="p95"
            value={toMicro(latency.p95Ms)}
            unit="μs"
            accent="amber"
          />
          <MetricBadge
            label="p99"
            value={toMicro(latency.p99Ms)}
            unit="μs"
            accent="rose"
          />
        </div>
      </div>

      {/* Chart */}
      <D3Histogram
        data={samples}
        width={width}
        height={height}
        xLabel="Latency (μs)"
        color={feedMode === 'raw' ? '#22d3ee' : '#f59e0b'}
        bins={25}
      />

      {/* Footer metrics */}
      <div
        className="flex items-center justify-between mt-2 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <div className="flex items-center gap-4">
          <span>Min: <span className="text-green-400">{toMicro(latency.minMs).toFixed(0)}μs</span></span>
          <span>Max: <span className="text-rose-400">{toMicro(latency.maxMs).toFixed(0)}μs</span></span>
          <span>p50: <span className="text-neutral-300">{toMicro(latency.p50Ms).toFixed(0)}μs</span></span>
        </div>
        <span>
          {feedMode === 'raw' ? (
            <span className="text-cyan-400">{samples.length} raw samples</span>
          ) : (
            `Samples: ${latency.sampleCount.toLocaleString()}`
          )}
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// HELPERS
// =============================================================================

interface MetricBadgeProps {
  label: string
  value: number
  unit?: string
  accent?: 'green' | 'amber' | 'rose' | 'neutral'
}

function MetricBadge({ label, value, unit, accent = 'neutral' }: MetricBadgeProps) {
  const accentColors = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    neutral: 'text-neutral-300',
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className="text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}:
      </span>
      <span
        className={`font-mono font-bold ${accentColors[accent]}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {value.toFixed(1)}
        {unit && <span className="text-neutral-600 font-normal">{unit}</span>}
      </span>
    </div>
  )
}

export default LatencyPanel
