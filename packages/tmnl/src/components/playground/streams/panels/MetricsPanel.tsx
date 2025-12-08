/**
 * Metrics Panel
 *
 * Live metrics display strip for throughput, latency, and status.
 * Uses effect-atom subscriptions from the playground runtime.
 *
 * @module
 */

import { useAtomValue } from '@effect-atom/atom-react'
import {
  throughputAtom,
  latencyAtom,
} from '@/lib/streams/playground'

// =============================================================================
// METRIC CELL
// =============================================================================

interface MetricCellProps {
  label: string
  value: string | number
  unit?: string
  accent?: 'cyan' | 'amber' | 'green' | 'neutral'
}

function MetricCell({ label, value, unit, accent = 'neutral' }: MetricCellProps) {
  const accentColors = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    green: 'text-green-400',
    neutral: 'text-neutral-100',
  }

  return (
    <div className="flex flex-col items-center px-4 py-2 border-r border-neutral-800 last:border-r-0">
      <span
        className="text-neutral-500 uppercase tracking-wider font-mono mb-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
      <span
        className={`font-mono font-bold ${accentColors[accent]}`}
        style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && (
          <span
            className="text-neutral-600 font-normal ml-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

// =============================================================================
// METRICS PANEL
// =============================================================================

/**
 * Horizontal strip showing live metrics from playground streams.
 *
 * Displays:
 * - Events/sec (current throughput)
 * - Peak events/sec
 * - Total events
 * - Avg latency
 * - p95 latency
 */
export function MetricsPanel() {
  // Atoms now return values directly (Atom-as-State pattern)
  const throughput = useAtomValue(throughputAtom)
  const latency = useAtomValue(latencyAtom)

  return (
    <div className="flex items-center justify-start bg-neutral-900/50 border-b border-neutral-800">
      <MetricCell
        label="Events/sec"
        value={throughput.eventsPerSecond}
        accent="cyan"
      />
      <MetricCell
        label="Peak"
        value={throughput.peakEventsPerSecond}
        accent="amber"
      />
      <MetricCell
        label="Total"
        value={throughput.totalEvents}
        accent="neutral"
      />
      <MetricCell
        label="Avg Latency"
        value={latency.avgMs.toFixed(1)}
        unit="ms"
        accent="green"
      />
      <MetricCell
        label="p95"
        value={latency.p95Ms.toFixed(1)}
        unit="ms"
        accent="amber"
      />
      <MetricCell
        label="p99"
        value={latency.p99Ms.toFixed(1)}
        unit="ms"
        accent="neutral"
      />
    </div>
  )
}

export default MetricsPanel
