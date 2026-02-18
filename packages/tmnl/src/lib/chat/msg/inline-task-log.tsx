import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatInlineTaskLogEntry {
  readonly at: string
  readonly message: string
  readonly seq?: number
}

export interface ChatInlineTaskLogProps extends ComponentPropsWithoutRef<'ul'> {
  entries: ReadonlyArray<ChatInlineTaskLogEntry>
}

export const ChatInlineTaskLog = forwardRef<HTMLUListElement, ChatInlineTaskLogProps>(
  ({ entries, className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="tmnl-chat-inline-task-log"
      className={cn('flex flex-col gap-0.5 font-mono', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      {entries.map((entry, index) => (
        <li
          key={`${entry.seq ?? index}-${entry.at}`}
          className="flex items-baseline gap-2 px-3 py-0.5"
        >
          <span className="text-neutral-600 shrink-0 tabular-nums">{entry.at}</span>
          <span className="text-neutral-400">{entry.message}</span>
        </li>
      ))}
    </ul>
  ),
)

ChatInlineTaskLog.displayName = 'ChatMessage.InlineTaskThread.Log'
