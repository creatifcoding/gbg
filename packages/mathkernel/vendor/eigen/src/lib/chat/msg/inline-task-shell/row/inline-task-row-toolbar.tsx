import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskItem } from '../../inline-task-types'
import { InlineTaskRowActionBtn, type InlineTaskRowAction } from './inline-task-row-action-btn'

export interface InlineTaskRowToolbarProps extends ComponentPropsWithoutRef<'div'> {
  task: ChatInlineTaskItem
  onAction?: (action: InlineTaskRowAction, taskId: string) => void
}

function getAvailableActions(status: string): InlineTaskRowAction[] {
  switch (status) {
    case 'running': return ['view', 'cancel']
    case 'failed': return ['view', 'retry']
    case 'queued': return ['view', 'claim']
    case 'completed': return ['view']
    case 'blocked': return ['view']
    default: return ['view']
  }
}

export const InlineTaskRowToolbar = forwardRef<HTMLDivElement, InlineTaskRowToolbarProps>(
  ({ task, onAction, className, ...props }, ref) => {
    const actions = getAvailableActions(task.status)

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-inline-task-row-toolbar"
        className={cn(
          'flex items-center gap-1',
          'opacity-0 group-hover/row:opacity-100 transition-opacity duration-150',
          className,
        )}
        {...props}
      >
        {actions.map((action) => (
          <InlineTaskRowActionBtn
            key={action}
            action={action}
            taskId={task.taskId}
            onAction={onAction}
          />
        ))}
      </div>
    )
  },
)

InlineTaskRowToolbar.displayName = 'InlineTaskShell.RowToolbar'
