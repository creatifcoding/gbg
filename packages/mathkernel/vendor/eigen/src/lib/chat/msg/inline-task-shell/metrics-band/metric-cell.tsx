import { cn } from '@/lib/utils'

export interface MetricCellProps {
  label: string
  value: number | string
  color?: string
  className?: string
}

export function MetricCell({ label, value, color, className }: MetricCellProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-0.5 px-2', className)}
      data-slot="tmnl-chat-inline-task-metric-cell"
    >
      <span
        className={cn('font-mono tabular-nums', color ?? 'text-neutral-300')}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {value}
      </span>
      <span
        className="font-mono uppercase tracking-wider text-neutral-600"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
    </div>
  )
}

MetricCell.displayName = 'InlineTaskShell.MetricCell'
