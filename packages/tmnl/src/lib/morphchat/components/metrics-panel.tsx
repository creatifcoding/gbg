/**
 * MetricsPanel — Harness observability panel for Monitor preset.
 *
 * Renders metrics$ atom data (firstDeltaLagMs, toolRoundTripMs, etc.)
 * and provider$ marker as a compact metric grid.
 *
 * @module morphchat/components/metrics-panel
 */

import { memo, type FC } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { morphChatRegistry } from '../atoms/registry'
import {
  harnessMetrics$,
  harnessProvider$,
} from '../hooks/useHarnessAdapter'
import type { MetricEntry, ProviderMarker } from '../schemas/metric-types'
import { Result } from '@effect-atom/atom'

// =============================================================================
// MetricCell — single metric display
// =============================================================================

const MetricCell: FC<{
  label: string
  value: string | number
  unit?: string
  color?: string
}> = memo(({ label, value, unit, color = 'text-cyan-400' }) => (
  <div className="flex flex-col gap-0.5 min-w-[80px]">
    <span
      className="font-mono uppercase tracking-wider text-neutral-600"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {label}
    </span>
    <span className={cn('font-mono tabular-nums', color)} style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
      {typeof value === 'number' ? value.toFixed(0) : value}
      {unit && <span className="text-neutral-600 ml-0.5">{unit}</span>}
    </span>
  </div>
))
MetricCell.displayName = 'MetricCell'

// =============================================================================
// MetricsPanel
// =============================================================================

export interface MetricsPanelProps {
  className?: string
}

export const MetricsPanel: FC<MetricsPanelProps> = memo(({ className }) => {
  const metricsResult = useAtomValue(harnessMetrics$, { registry: morphChatRegistry })
  const providerResult = useAtomValue(harnessProvider$, { registry: morphChatRegistry })

  const metrics: ReadonlyArray<MetricEntry> = Result.isSuccess(metricsResult) ? metricsResult.value : []
  const provider: ProviderMarker | null = Result.isSuccess(providerResult) ? providerResult.value : null

  if (metrics.length === 0 && !provider) return null

  // Aggregate latest values by metric name
  const latest = new Map<string, MetricEntry>()
  for (const m of metrics) {
    latest.set(m.metric, m)
  }

  const firstDeltaLag = latest.get('firstDeltaLagMs')
  const toolRoundTrip = latest.get('toolRoundTripMs')
  const ackLatency = latest.get('ackLatencyMs')
  const retryCount = latest.get('retryCount')

  return (
    <div
      data-slot="tmnl-metrics-panel"
      className={cn(
        'flex flex-wrap gap-4 px-3 py-2',
        'border-t border-neutral-800/50',
        'bg-neutral-950/30',
        className,
      )}
    >
      {provider && (
        <MetricCell
          label="Provider"
          value={`${provider.provider}${provider.model ? ` / ${provider.model}` : ''}`}
          color="text-emerald-400"
        />
      )}
      {firstDeltaLag && (
        <MetricCell label="First Delta" value={firstDeltaLag.value} unit="ms" />
      )}
      {toolRoundTrip && (
        <MetricCell label="Tool RT" value={toolRoundTrip.value} unit="ms" />
      )}
      {ackLatency && (
        <MetricCell label="Ack" value={ackLatency.value} unit="ms" />
      )}
      {retryCount && (
        <MetricCell
          label="Retries"
          value={retryCount.value}
          color={retryCount.value > 0 ? 'text-amber-400' : 'text-neutral-400'}
        />
      )}
      {metrics.length > 0 && (
        <MetricCell
          label="Events"
          value={metrics.length}
          color="text-neutral-400"
        />
      )}
    </div>
  )
})
MetricsPanel.displayName = 'MetricsPanel'
