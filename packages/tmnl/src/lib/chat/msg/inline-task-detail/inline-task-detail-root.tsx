import { forwardRef, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import type { HashMap } from 'effect'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskItem } from '../inline-task-types'
import { InlineTaskDetailFields, type InlineTaskDetailFieldsProps } from './inline-task-detail-fields'
import { InlineTaskDetailFieldStatus, type InlineTaskDetailFieldStatusProps } from './inline-task-detail-field-status'
import { InlineTaskDetailFieldDeps, type InlineTaskDetailFieldDepsProps } from './inline-task-detail-field-deps'
import { InlineTaskBadge, type InlineTaskBadgeProps } from './inline-task-badge'

export interface InlineTaskDetailRootProps extends ComponentPropsWithoutRef<'section'> {
  task: ChatInlineTaskItem
  taskIndex?: HashMap.HashMap<string, ChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  copyable?: boolean
}

const Root = forwardRef<HTMLElement, InlineTaskDetailRootProps>(
  ({ task, taskIndex, onNavigateTask, copyable, className, children, ...props }, ref) => (
    <section
      ref={ref}
      data-slot="tmnl-chat-inline-task-detail"
      data-task-id={task.taskId}
      data-status={task.status}
      className={cn(
        'p-3 rounded-lg border border-neutral-800/50',
        'bg-neutral-900/30',
        className,
      )}
      {...props}
    >
      {children ?? (
        <InlineTaskDetailFields
          task={task}
          taskIndex={taskIndex}
          onNavigateTask={onNavigateTask}
          copyable={copyable}
        />
      )}
    </section>
  ),
)
Root.displayName = 'InlineTaskDetail.Root'

interface InlineTaskDetailComponent {
  (props: InlineTaskDetailRootProps): ReactElement
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
