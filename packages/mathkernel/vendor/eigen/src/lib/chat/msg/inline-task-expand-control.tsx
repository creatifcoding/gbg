import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatInlineTaskExpandControlProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children'> {
  expanded: boolean
  previewCount: number
  totalCount: number
}

export const ChatInlineTaskExpandControl = forwardRef<
  HTMLButtonElement,
  ChatInlineTaskExpandControlProps
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
      data-slot="tmnl-chat-inline-task-expand-control"
      data-expanded={expanded || undefined}
      className={cn(
        'w-full py-1.5 px-3 font-mono uppercase tracking-wider',
        'text-neutral-500 hover:text-neutral-300',
        'transition-colors duration-100',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      {label}
    </button>
  )
})

ChatInlineTaskExpandControl.displayName = 'ChatMessage.InlineTaskThread.ExpandControl'
