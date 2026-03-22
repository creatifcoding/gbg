import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type InlineTaskRowAction = 'view' | 'cancel' | 'retry' | 'claim'

export interface InlineTaskRowActionBtnProps extends ComponentPropsWithoutRef<'button'> {
  action: InlineTaskRowAction
  taskId: string
  onAction?: (action: InlineTaskRowAction, taskId: string) => void
}

const ACTION_COLOR: Record<InlineTaskRowAction, string> = {
  view: 'text-neutral-400 hover:text-neutral-200',
  cancel: 'text-red-400/70 hover:text-red-400',
  retry: 'text-amber-400/70 hover:text-amber-400',
  claim: 'text-cyan-400/70 hover:text-cyan-400',
}

export const InlineTaskRowActionBtn = forwardRef<HTMLButtonElement, InlineTaskRowActionBtnProps>(
  ({ action, taskId, onAction, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="tmnl-chat-inline-task-row-action"
      data-action={action}
      className={cn(
        'px-1.5 py-0.5 rounded font-mono uppercase tracking-wider',
        'transition-colors duration-100',
        ACTION_COLOR[action],
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      onClick={() => onAction?.(action, taskId)}
      {...props}
    >
      {children ?? action}
    </button>
  ),
)

InlineTaskRowActionBtn.displayName = 'InlineTaskShell.RowActionBtn'
