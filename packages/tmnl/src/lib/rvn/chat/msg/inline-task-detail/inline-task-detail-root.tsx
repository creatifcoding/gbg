import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import type { HashMap } from 'effect'
import { cn } from '@/lib/utils'
import type { RvnChatInlineTaskItem } from '../inline-task-types'
import { InlineTaskDetailFields, type InlineTaskDetailFieldsProps } from './inline-task-detail-fields'
import { InlineTaskDetailFieldStatus, type InlineTaskDetailFieldStatusProps } from './inline-task-detail-field-status'
import { InlineTaskDetailFieldDeps, type InlineTaskDetailFieldDepsProps } from './inline-task-detail-field-deps'
import { InlineTaskBadge, type InlineTaskBadgeProps } from './inline-task-badge'

export interface InlineTaskDetailRootProps extends ComponentPropsWithoutRef<'section'> {
  task: RvnChatInlineTaskItem
  taskIndex?: HashMap.HashMap<string, RvnChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
}

const Root = forwardRef<HTMLElement, InlineTaskDetailRootProps>(
  ({ task, taskIndex, onNavigateTask, className, children, ...props }, ref) => (
    <section
      ref={ref}
      data-slot="rvn-chat-inline-task-detail"
      data-task-id={task.taskId}
      data-status={task.status}
      className={cn('rvn-chat__inline-task-detail', className)}
      {...props}
    >
      {children ?? (
        <InlineTaskDetailFields
          task={task}
          taskIndex={taskIndex}
          onNavigateTask={onNavigateTask}
        />
      )}
    </section>
  ),
)
Root.displayName = 'InlineTaskDetail.Root'

interface InlineTaskDetailComponent {
  (props: InlineTaskDetailRootProps): React.ReactElement
  displayName?: string
  Root: typeof Root
  Fields: typeof InlineTaskDetailFields
  FieldStatus: typeof InlineTaskDetailFieldStatus
  FieldDeps: typeof InlineTaskDetailFieldDeps
  Badge: typeof InlineTaskBadge
}

const InlineTaskDetail = Root as unknown as InlineTaskDetailComponent
InlineTaskDetail.Root = Root
InlineTaskDetail.Fields = InlineTaskDetailFields
InlineTaskDetail.FieldStatus = InlineTaskDetailFieldStatus
InlineTaskDetail.FieldDeps = InlineTaskDetailFieldDeps
InlineTaskDetail.Badge = InlineTaskBadge

export { InlineTaskDetail }
export type {
  InlineTaskDetailFieldsProps,
  InlineTaskDetailFieldStatusProps,
  InlineTaskDetailFieldDepsProps,
  InlineTaskBadgeProps,
}
