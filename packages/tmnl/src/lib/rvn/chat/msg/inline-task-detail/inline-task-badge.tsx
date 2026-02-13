import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import type { RvnChatInlineTaskStatus } from '../inline-task-types'

export interface InlineTaskBadgeProps extends ComponentPropsWithoutRef<'button'> {
  taskId: string
  label?: string
  status?: RvnChatInlineTaskStatus
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
        data-slot="rvn-chat-inline-task-badge"
        data-task-id={taskId}
        data-status={status}
        className={cn('rvn-chat__inline-task-badge', className)}
        title={label ? `${taskId}: ${label}` : taskId}
        onClick={handleClick}
        {...props}
      >
        <span className="rvn-chat__inline-task-badge-id">{taskId}</span>
        {status ? (
          <span
            className="rvn-chat__inline-task-badge-dot"
            data-status={status}
            aria-hidden="true"
          />
        ) : null}
      </button>
    )
  },
)
InlineTaskBadge.displayName = 'RvnChatMessage.InlineTaskBadge'
