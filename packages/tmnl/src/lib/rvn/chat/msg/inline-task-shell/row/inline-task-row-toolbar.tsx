/**
 * InlineTaskRowToolbar — action strip rendered at the bottom of an expanded task row.
 *
 * Renders a declarative array of actions. The `onAction` callback receives
 * the action ID — actual atom operations will be wired in a future pass.
 * CSS: `.rvn-chat__inline-task-row-toolbar`.
 */
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import type { RvnChatInlineTaskItem } from '../../inline-task-types'
import { InlineTaskRowActionBtn } from './inline-task-row-action-btn'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Action definition
// ---------------------------------------------------------------------------

export interface InlineTaskRowAction {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  readonly variant?: 'default' | 'danger'
  readonly disabled?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface InlineTaskRowToolbarProps extends ComponentPropsWithoutRef<'div'> {
  task: RvnChatInlineTaskItem
  actions?: ReadonlyArray<InlineTaskRowAction>
  onAction?: (actionId: string, task: RvnChatInlineTaskItem) => void
}

export const InlineTaskRowToolbar = forwardRef<HTMLDivElement, InlineTaskRowToolbarProps>(
  ({ task, actions, onAction, className, ...props }, ref) => {
    if (!actions || actions.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn('rvn-chat__inline-task-row-toolbar', className)}
        role="toolbar"
        aria-label="Task actions"
        {...props}
      >
        {actions.map((action) => (
          <InlineTaskRowActionBtn
            key={action.id}
            icon={action.icon}
            label={action.label}
            variant={action.variant}
            disabled={action.disabled}
            onClick={() => onAction?.(action.id, task)}
          />
        ))}
      </div>
    )
  },
)

InlineTaskRowToolbar.displayName = 'InlineTaskShell.RowToolbar'
