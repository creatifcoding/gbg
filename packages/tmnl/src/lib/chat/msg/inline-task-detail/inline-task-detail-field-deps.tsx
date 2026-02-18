import { HashMap, Option } from 'effect'
import type { ChatInlineTaskItem } from '../inline-task-types'
import { InlineTaskBadge } from './inline-task-badge'

export interface InlineTaskDetailFieldDepsProps {
  dependencies: ReadonlyArray<string>
  taskIndex?: HashMap.HashMap<string, ChatInlineTaskItem>
  onNavigate?: (taskId: string) => void
}

export function InlineTaskDetailFieldDeps({
  dependencies,
  taskIndex,
  onNavigate,
}: InlineTaskDetailFieldDepsProps) {
  if (dependencies.length === 0) {
    return <span className="font-mono text-neutral-600">—</span>
  }

  return (
    <span className="flex flex-wrap gap-1">
      {dependencies.map((depId) => {
        const depTask = taskIndex
          ? Option.getOrUndefined(HashMap.get(taskIndex, depId))
          : undefined
        return (
          <InlineTaskBadge
            key={depId}
            taskId={depId}
            label={depTask?.title}
            status={depTask?.status}
            onNavigate={onNavigate}
          />
        )
      })}
    </span>
  )
}

InlineTaskDetailFieldDeps.displayName = 'InlineTaskDetail.FieldDeps'
