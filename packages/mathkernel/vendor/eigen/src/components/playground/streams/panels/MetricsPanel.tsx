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
import { MetricBadge } from '@/components/primitives'

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
      <MetricBadge
        variant="cell"
        label="Events/sec"
        value={throughput.eventsPerSecond}
        accent="cyan"
      />
      <MetricBadge
        variant="cell"
        label="Peak"
        value={throughput.peakEventsPerSecond}
        accent="amber"
      />
      <MetricBadge
        variant="cell"
        label="Total"
        value={throughput.totalEvents}
        accent="neutral"
      />
      <MetricBadge
        variant="cell"
        label="Avg Latency"
        value={latency.avgMs}
        unit="ms"
        accent="green"
        format="fixed"
        decimals={1}
      />
      <MetricBadge
        variant="cell"
        label="p95"
        value={latency.p95Ms}
        unit="ms"
        accent="amber"
        format="fixed"
        decimals={1}
      />
      <MetricBadge
        variant="cell"
        label="p99"
        value={latency.p99Ms}
        unit="ms"
        accent="neutral"
        format="fixed"
        decimals={1}
      />
    </div>
  )
}

export default MetricsPanel
