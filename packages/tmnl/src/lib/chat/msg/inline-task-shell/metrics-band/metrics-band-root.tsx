import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { MetricCell } from './metric-cell'

export interface MetricsBandProps extends ComponentPropsWithoutRef<'div'> {}

export const MetricsBand = forwardRef<HTMLDivElement, MetricsBandProps>(
  ({ className, ...props }, ref) => {
    const { metrics, expanded } = useInlineTaskShellContext()

    if (!expanded) return null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-inline-task-shell-metrics-band"
        className={cn(
          'flex items-center justify-around py-2 px-3',
          'border-b border-neutral-800/30',
          className,
        )}
        {...props}
      >
        <MetricCell label="total" value={metrics.total} />
        <MetricCell label="running" value={metrics.running} color="text-cyan-400" />
        <MetricCell label="done" value={metrics.completed} color="text-emerald-400" />
        <MetricCell label="failed" value={metrics.failed} color="text-red-400" />
        <MetricCell
          label="rate"
          value={`${Math.round(metrics.successRate)}%`}
          color={metrics.successRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}
        />
      </div>
    )
  },
)

MetricsBand.displayName = 'InlineTaskShell.MetricsBand'
