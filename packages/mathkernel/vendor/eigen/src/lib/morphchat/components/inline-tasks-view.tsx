/**
 * Inline Tasks Axis View
 *
 * Maps spec.inlineTasks axis → rendered inline task component:
 *   - full: InlineTaskShellRoot from chat/msg/ with transfer v2 wired
 *   - compact: Summary badge with task count + status breakdown
 *   - hidden: nothing
 *
 * Requires adapter.inlineTasks$ to be set. If absent, renders nothing.
 *
 * Transfer coupling:
 *   - spec.enableTransferDrag → InlineTaskShellRoot enableTransfer prop
 *   - adapter.transferConfig?.clusterLabel → transferClusterLabel prop
 *   - InlineTaskShellRoot internally calls useInlineTaskTransfer
 *
 * @module morphchat/components/inline-tasks-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { InlineTaskShell } from '@/lib/chat/msg/inline-task-shell'
import type { ChatInlineTaskItem } from '@/lib/chat/msg/inline-task-types'
import { useBlockDensity } from '@/lib/chat/msg/density-context'

export function InlineTasksView() {
  const { spec, adapter } = useMorphChatContext()

  // No inline tasks atom on the adapter → nothing to render
  if (!adapter.inlineTasks$) return null

  switch (spec.inlineTasks) {
    case 'full':
      return <InlineTasksFull />
    case 'compact':
      return <InlineTasksCompact />
    case 'hidden':
    default:
      return null
  }
}

InlineTasksView.displayName = 'MorphChat.InlineTasksView'

// =============================================================================
// Full: InlineTaskShellRoot with transfer v2
// =============================================================================

function InlineTasksFull() {
  const { spec, adapter } = useMorphChatContext()
  const rawTasks = useAtomValue(adapter.inlineTasks$!)
  const tasks = rawTasks as ReadonlyArray<ChatInlineTaskItem>
  const density = useBlockDensity()

  if (tasks.length === 0) return null

  const enableTransfer = spec.enableTransferDrag ?? false
  const clusterLabel = adapter.transferConfig?.clusterLabel ?? 'Tasks'
  const threadId = adapter.transferConfig?.surfaceId ?? adapter.adapterId

  // ── Pill: badge count only ──
  if (density === 'pill') {
    const running = tasks.filter((t) => t.status === 'running').length
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5">
        <div className={cn('w-1.5 h-1.5 rounded-full', running > 0 ? 'bg-cyan-500 animate-pulse' : 'bg-neutral-600')} />
        <span className="font-mono text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
    )
  }

  // ── Compact: capped height ──
  // ── Full: uncapped ──
  return (
    <div className={cn('border-t border-neutral-800/30', density === 'compact' && 'max-h-48 overflow-y-auto')}>
      <InlineTaskShell
        threadId={threadId}
        tasks={tasks}
        enableTransfer={enableTransfer}
        transferClusterLabel={clusterLabel}
        defaultExpanded={density === 'full'}
      />
    </div>
  )
}

// =============================================================================
// Compact: summary badge
// =============================================================================

function InlineTasksCompact() {
  const { adapter } = useMorphChatContext()
  const rawTasks = useAtomValue(adapter.inlineTasks$!)
  const tasks = rawTasks as ReadonlyArray<ChatInlineTaskItem>
  const count = tasks.length

  if (count === 0) return null

  const running = tasks.filter((t) => t.status === 'running').length
  const completed = tasks.filter((t) => t.status === 'completed').length
  const failed = tasks.filter((t) => t.status === 'failed').length

  return (
    <div className="flex items-center gap-2 px-3 py-1 border-t border-neutral-800/30">
      <span
        className={cn(
          'font-mono px-1.5 py-0.5 rounded',
          'bg-neutral-800/50 text-neutral-400',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {count} task{count !== 1 ? 's' : ''}
      </span>
      {running > 0 && (
        <span
          className="font-mono text-cyan-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {running} running
        </span>
      )}
      {completed > 0 && (
        <span
          className="font-mono text-emerald-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {completed} done
        </span>
      )}
      {failed > 0 && (
        <span
          className="font-mono text-red-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {failed} failed
        </span>
      )}
    </div>
  )
}
