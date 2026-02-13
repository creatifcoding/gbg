import { HashMap, Option } from 'effect'
import type { RvnChatInlineTaskItem } from '../inline-task-types'
import { InlineTaskBadge } from './inline-task-badge'

export interface InlineTaskDetailFieldDepsProps {
  dependencies: ReadonlyArray<string>
  /** HashMap lookup for resolving taskId → task (for status dots on badges) */
  taskIndex?: HashMap.HashMap<string, RvnChatInlineTaskItem>
  onNavigate?: (taskId: string) => void
}

export function InlineTaskDetailFieldDeps({
  dependencies,
  taskIndex,
  onNavigate,
}: InlineTaskDetailFieldDepsProps) {
  if (dependencies.length === 0) {
    return <span className="rvn-chat__inline-task-detail-field-value">—</span>
  }

  return (
    <span className="rvn-chat__inline-task-detail-deps">
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
