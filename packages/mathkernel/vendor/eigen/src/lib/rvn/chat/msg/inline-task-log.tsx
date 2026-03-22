import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatInlineTaskLogEntry {
  readonly at: string
  readonly message: string
  readonly seq?: number
}

export interface RvnChatInlineTaskLogProps extends ComponentPropsWithoutRef<'ul'> {
  entries: ReadonlyArray<RvnChatInlineTaskLogEntry>
}

export const RvnChatInlineTaskLog = forwardRef<HTMLUListElement, RvnChatInlineTaskLogProps>(
  ({ entries, className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="rvn-chat-inline-task-log"
      className={cn('rvn-chat__inline-task-log', className)}
      {...props}
    >
      {entries.map((entry, index) => (
        <li
          key={`${entry.seq ?? index}-${entry.at}`}
          data-slot="rvn-chat-inline-task-log-entry"
          className="rvn-chat__inline-task-log-entry"
        >
          <span className="rvn-chat__inline-task-log-time">{entry.at}</span>
          <span className="rvn-chat__inline-task-log-message">{entry.message}</span>
        </li>
      ))}
    </ul>
  ),
)

RvnChatInlineTaskLog.displayName = 'RvnChatMessage.InlineTaskThread.Log'
