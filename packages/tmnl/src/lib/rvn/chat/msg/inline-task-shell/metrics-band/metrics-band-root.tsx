/**
 * MetricsBand — summary metrics row (total, running, completed, success rate).
 *
 * Reads metrics from shell context and renders a 4-column grid of MetricCells.
 * Only visible when the shell is expanded.
 * CSS: `.rvn-chat__inline-task-shell-metrics-band`.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { MetricCell } from './metric-cell'
import { cn } from '@/lib/utils'

export interface MetricsBandProps extends ComponentPropsWithoutRef<'div'> {}

export const MetricsBand = forwardRef<HTMLDivElement, MetricsBandProps>(
  ({ className, ...props }, ref) => {
    const { expanded, metrics } = useInlineTaskShellContext()

    if (!expanded) return null

    return (
      <div
        ref={ref}
        className={cn('rvn-chat__inline-task-shell-metrics-band', className)}
        role="group"
        aria-label="Task metrics"
        {...props}
      >
        <MetricCell label="Total" value={metrics.total} />
        <MetricCell label="Running" value={metrics.running} status="running" />
        <MetricCell label="Done" value={metrics.completed} status="completed" />
        <MetricCell
          label="Rate"
          value={`${metrics.successRate}%`}
          status="rate"
        />
      </div>
    )
  },
)

MetricsBand.displayName = 'InlineTaskShell.MetricsBand'
