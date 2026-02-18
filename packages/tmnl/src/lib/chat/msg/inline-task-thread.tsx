import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { ChatInlineTaskLog, type ChatInlineTaskLogProps, type ChatInlineTaskLogEntry } from './inline-task-log'
import { ChatInlineTaskExpandControl, type ChatInlineTaskExpandControlProps } from './inline-task-expand-control'
import { ChatInlineTaskVirtualizedList, type ChatInlineTaskVirtualizedListProps } from './inline-task-virtualized-list'
import { ChatInlineTaskRow, type ChatInlineTaskRowProps } from './inline-task-row'
import { InlineTaskDetail, type InlineTaskDetailRootProps, type InlineTaskDetailFieldsProps, type InlineTaskBadgeProps } from './inline-task-detail'
import { InlineTaskShell, type InlineTaskShellRootProps } from './inline-task-shell'
import type { ChatInlineTaskItem, ChatInlineTaskMetadata, ChatInlineTaskPhase, ChatInlineTaskStatus } from './inline-task-types'

export interface ChatInlineTaskThreadProps extends ComponentPropsWithoutRef<'section'> {
  threadId: string
  expanded?: boolean
}

const Root = forwardRef<HTMLElement, ChatInlineTaskThreadProps>(
  ({ threadId, expanded = false, className, ...props }, ref) => (
    <section
      ref={ref}
      data-slot="tmnl-chat-inline-task-thread"
      data-thread-id={threadId}
      data-expanded={expanded || undefined}
      className={cn('flex flex-col', className)}
      {...props}
    />
  ),
)
Root.displayName = 'ChatMessage.InlineTaskThread.Root'

interface ChatInlineTaskThreadComponent {
  (props: ChatInlineTaskThreadProps): ReactElement
  displayName?: string
  Root: typeof Root
  Detail: typeof InlineTaskDetail
  Log: typeof ChatInlineTaskLog
  ExpandControl: typeof ChatInlineTaskExpandControl
  VirtualizedList: typeof ChatInlineTaskVirtualizedList
  Row: typeof ChatInlineTaskRow
  Shell: typeof InlineTaskShell
}

const InlineTaskThread = Root as unknown as ChatInlineTaskThreadComponent
InlineTaskThread.Root = Root
InlineTaskThread.Detail = InlineTaskDetail
InlineTaskThread.Log = ChatInlineTaskLog
InlineTaskThread.ExpandControl = ChatInlineTaskExpandControl
InlineTaskThread.VirtualizedList = ChatInlineTaskVirtualizedList
InlineTaskThread.Row = ChatInlineTaskRow
InlineTaskThread.Shell = InlineTaskShell

export { InlineTaskThread as ChatInlineTaskThread }
export type {
  ChatInlineTaskThreadProps,
  ChatInlineTaskLogProps,
  ChatInlineTaskLogEntry,
  ChatInlineTaskExpandControlProps,
  ChatInlineTaskVirtualizedListProps,
  ChatInlineTaskRowProps,
  InlineTaskShellRootProps,
  ChatInlineTaskItem,
  ChatInlineTaskMetadata,
  ChatInlineTaskPhase,
  ChatInlineTaskStatus,
  InlineTaskDetailRootProps,
  InlineTaskDetailFieldsProps,
  InlineTaskBadgeProps,
}
