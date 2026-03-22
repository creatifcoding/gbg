import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskStatus } from '../inline-task-types'

const STATUS_DOT: Record<string, string> = {
  queued: 'bg-neutral-500',
  claimed: 'bg-blue-400',
  running: 'bg-cyan-400',
  paused: 'bg-amber-400',
  blocked: 'bg-red-400',
  failed: 'bg-red-500',
  cancelled: 'bg-neutral-600',
  completed: 'bg-emerald-400',
}

export interface InlineTaskBadgeProps extends ComponentPropsWithoutRef<'button'> {
  taskId: string
  label?: string
  status?: ChatInlineTaskStatus
  onNavigate?: (taskId: string) => void
}

export const InlineTaskBadge = forwardRef<HTMLButtonElement, InlineTaskBadgeProps>(
  ({ taskId, label, status, onNavigate, className, onClick, ...props }, ref) => {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onNavigate?.(taskId)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-inline-task-badge"
        data-task-id={taskId}
        data-status={status}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded',
          'font-mono text-neutral-400 border border-neutral-800',
          'hover:border-neutral-600 hover:text-neutral-200',
          'transition-colors duration-100 cursor-pointer',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title={label ? `${taskId}: ${label}` : taskId}
        onClick={handleClick}
        {...props}
      >
        <span>{taskId}</span>
        {status && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT[status] ?? 'bg-neutral-500')}
            aria-hidden="true"
          />
        )}
      </button>
    )
  },
)

InlineTaskBadge.displayName = 'ChatMessage.InlineTaskBadge'
