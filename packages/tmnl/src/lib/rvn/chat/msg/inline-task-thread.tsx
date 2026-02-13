import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { cn } from '@/lib/utils'
import { RvnChatInlineTaskRow, type RvnChatInlineTaskRowProps } from './inline-task-row'
import {
  RvnChatInlineTaskLog,
  type RvnChatInlineTaskLogProps,
  type RvnChatInlineTaskLogEntry,
} from './inline-task-log'
import {
  RvnChatInlineTaskExpandControl,
  type RvnChatInlineTaskExpandControlProps,
} from './inline-task-expand-control'
import {
  RvnChatInlineTaskVirtualizedList,
  type RvnChatInlineTaskVirtualizedListProps,
} from './inline-task-virtualized-list'
import {
  InlineTaskDetail,
  type InlineTaskDetailRootProps,
  type InlineTaskDetailFieldsProps,
  type InlineTaskBadgeProps,
} from './inline-task-detail'
import type {
  RvnChatInlineTaskItem,
  RvnChatInlineTaskMetadata,
  RvnChatInlineTaskPhase,
  RvnChatInlineTaskStatus,
} from './inline-task-types'

export interface RvnChatInlineTaskThreadProps extends ComponentPropsWithoutRef<'section'> {
  threadId: string
  expanded?: boolean
}

const Root = forwardRef<HTMLElement, RvnChatInlineTaskThreadProps>(
  ({ threadId, expanded = false, className, ...props }, ref) => (
    <section
      ref={ref}
      data-slot="rvn-chat-inline-task-thread"
      data-thread-id={threadId}
      data-expanded={expanded || undefined}
      className={cn('rvn-chat__inline-task-thread', className)}
      {...props}
    />
  ),
)
Root.displayName = 'RvnChatMessage.InlineTaskThread.Root'

interface RvnChatInlineTaskThreadComponent {
  (props: RvnChatInlineTaskThreadProps): ReactElement
  displayName?: string
  Root: typeof Root
  Row: typeof RvnChatInlineTaskRow
  Detail: typeof InlineTaskDetail
  Log: typeof RvnChatInlineTaskLog
  ExpandControl: typeof RvnChatInlineTaskExpandControl
  VirtualizedList: typeof RvnChatInlineTaskVirtualizedList
}

const InlineTaskThread = Root as RvnChatInlineTaskThreadComponent
InlineTaskThread.Root = Root
InlineTaskThread.Row = RvnChatInlineTaskRow
InlineTaskThread.Detail = InlineTaskDetail
InlineTaskThread.Log = RvnChatInlineTaskLog
InlineTaskThread.ExpandControl = RvnChatInlineTaskExpandControl
InlineTaskThread.VirtualizedList = RvnChatInlineTaskVirtualizedList

export { InlineTaskThread as RvnChatInlineTaskThread }
export type {
  RvnChatInlineTaskThreadProps,
  RvnChatInlineTaskRowProps,
  RvnChatInlineTaskLogProps,
  RvnChatInlineTaskLogEntry,
  RvnChatInlineTaskExpandControlProps,
  RvnChatInlineTaskVirtualizedListProps,
  RvnChatInlineTaskItem,
  RvnChatInlineTaskMetadata,
  RvnChatInlineTaskPhase,
  RvnChatInlineTaskStatus,
  InlineTaskDetailRootProps,
  InlineTaskDetailFieldsProps,
  InlineTaskBadgeProps,
}
