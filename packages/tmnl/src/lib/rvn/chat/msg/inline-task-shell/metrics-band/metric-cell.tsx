/**
 * MetricCell — individual metric display cell (label + value + optional status color).
 *
 * Stateless. Reads nothing from context. CSS: `.rvn-chat__inline-task-shell-metric-cell`.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import type { RvnChatInlineTaskStatus } from '../../inline-task-types'
import { cn } from '@/lib/utils'

export interface MetricCellProps extends ComponentPropsWithoutRef<'div'> {
  label: string
  value: number | string
  /** Optional semantic status for color coding via data-status */
  status?: RvnChatInlineTaskStatus | 'rate'
}

export const MetricCell = forwardRef<HTMLDivElement, MetricCellProps>(
  ({ label, value, status, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rvn-chat__inline-task-shell-metric-cell', className)}
      {...props}
    >
      <div className="rvn-chat__inline-task-shell-metric-label">{label}</div>
      <div
        className="rvn-chat__inline-task-shell-metric-value"
        data-status={status ?? undefined}
      >
        {value}
      </div>
    </div>
  ),
)

MetricCell.displayName = 'InlineTaskShell.MetricCell'
