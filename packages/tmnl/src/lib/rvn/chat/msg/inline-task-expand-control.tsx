import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatInlineTaskExpandControlProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  expanded: boolean
  previewCount: number
  totalCount: number
}

export const RvnChatInlineTaskExpandControl = forwardRef<
  HTMLButtonElement,
  RvnChatInlineTaskExpandControlProps
>(({ expanded, previewCount, totalCount, className, ...props }, ref) => {
  const collapsedCount = Math.min(previewCount, totalCount)

  const label = expanded
    ? 'Collapse tasks'
    : previewCount === 0
      ? `Show all tasks (${totalCount})`
      : `Show all tasks (${collapsedCount}/${totalCount})`

  return (
    <button
      ref={ref}
      type="button"
      data-slot="rvn-chat-inline-task-expand-control"
      data-expanded={expanded || undefined}
      className={cn('rvn-chat__inline-task-expand-control', className)}
      {...props}
    >
      {label}
    </button>
  )
})

RvnChatInlineTaskExpandControl.displayName = 'RvnChatMessage.InlineTaskThread.ExpandControl'
