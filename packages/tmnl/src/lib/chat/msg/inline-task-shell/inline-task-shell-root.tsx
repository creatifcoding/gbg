/**
 * InlineTaskShell.Root — manages all shell state, provides via context.
 *
 * Accepts transfer v2 handle and taskLogAtomSurfaceAtom as optional DI props.
 * When transfer is provided, selection state delegates to the transfer handle.
 */
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import type { Atom } from '@effect-atom/atom'
import { HashMap } from 'effect'
import { cn } from '@/lib/utils'
import type { ChatInlineTaskItem } from '../inline-task-types'
import type { AgentTaskLogAtomSurfaceAtoms } from '@/lib/agents/tasks/atoms'
import {
  useInlineTaskTransfer,
  type InlineTaskTransferHandle,
  type InlineTaskTransferConfig,
} from '@/lib/transfer/v2/hooks'
import {
  InlineTaskShellContext,
  type InlineTaskShellContextValue,
  type InlineTaskShellMetrics,
} from './inline-task-shell-context'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineTaskShellRootProps extends ComponentPropsWithoutRef<'div'> {
  threadId: string
  tasks: ReadonlyArray<ChatInlineTaskItem>
  defaultExpanded?: boolean

  /** Enable the transfer v2 system for drag/copy. Default: true. */
  enableTransfer?: boolean
  /** Label for cluster drags. */
  transferClusterLabel?: string

  /** Optional DI atom surface for inline task log view. */
  taskLogAtomSurfaceAtom?: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>

  children?: ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeMetrics(tasks: ReadonlyArray<ChatInlineTaskItem>): InlineTaskShellMetrics {
  let running = 0, completed = 0, failed = 0, queued = 0, blocked = 0
  for (const t of tasks) {
    switch (t.status) {
      case 'running': running++; break
      case 'completed': completed++; break
      case 'failed': failed++; break
      case 'queued': queued++; break
      case 'blocked': blocked++; break
    }
  }
  const denom = completed + failed
  return {
    total: tasks.length,
    running, completed, failed, queued, blocked,
    successRate: denom > 0 ? (completed / denom) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InlineTaskShellRoot = forwardRef<HTMLDivElement, InlineTaskShellRootProps>(
  (
    {
      threadId,
      tasks,
      defaultExpanded = false,
      enableTransfer = true,
      transferClusterLabel,
      taskLogAtomSurfaceAtom,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const shellRef = useRef<HTMLDivElement | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [expanded, setExpanded] = useState(defaultExpanded)
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(new Set())

    const filteredTasks = useMemo(() => {
      if (!searchTerm.trim()) return tasks
      const q = searchTerm.toLowerCase()
      return tasks.filter(
        (t) => t.taskId.toLowerCase().includes(q) || t.title.toLowerCase().includes(q),
      )
    }, [tasks, searchTerm])

    const taskLookup = useMemo(
      () => HashMap.fromIterable(tasks.map((t) => [t.taskId, t] as const)),
      [tasks],
    )

    const metrics = useMemo(() => computeMetrics(tasks), [tasks])

    // ── Transfer v2 ──────────────────────────────────────────
    const transferConfig = useMemo<InlineTaskTransferConfig>(
      () => ({
        threadId,
        tasks: tasks.map((t) => ({ id: t.taskId, label: t.title, status: t.status })),
        clusterLabel: transferClusterLabel,
        shellRef,
      }),
      [threadId, tasks, transferClusterLabel],
    )

    const transfer: InlineTaskTransferHandle | null = enableTransfer
      ? useInlineTaskTransfer(transferConfig)
      : null

    // ── Selection (delegates to transfer when available) ─────
    const toggleSelection = useCallback(
      (taskId: string, additive: boolean) => {
        if (transfer) {
          transfer.toggleSelect(taskId)
          return
        }
        setSelectedTaskIds((prev) => {
          const next = new Set(additive ? prev : [])
          if (next.has(taskId)) next.delete(taskId)
          else next.add(taskId)
          return next
        })
      },
      [transfer],
    )

    const clearSelection = useCallback(() => {
      if (transfer) {
        transfer.clearSelection()
        return
      }
      setSelectedTaskIds(new Set())
    }, [transfer])

    const effectiveSelectedIds = transfer ? transfer.selectedIds : selectedTaskIds

    // ── Context value ────────────────────────────────────────
    const contextValue: InlineTaskShellContextValue = useMemo(() => ({
      threadId, tasks, filteredTasks, searchTerm, setSearchTerm,
      expanded, setExpanded, expandedTaskId, setExpandedTaskId,
      selectedTaskIds: effectiveSelectedIds, toggleSelection, clearSelection,
      taskLookup, metrics,
      transfer,
      taskLogAtomSurfaceAtom,
    }), [
      threadId, tasks, filteredTasks, searchTerm,
      expanded, expandedTaskId, effectiveSelectedIds,
      toggleSelection, clearSelection, taskLookup, metrics,
      transfer, taskLogAtomSurfaceAtom,
    ])

    return (
      <InlineTaskShellContext.Provider value={contextValue}>
        <div
          ref={(node) => {
            shellRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          data-slot="tmnl-chat-inline-task-shell"
          data-thread-id={threadId}
          data-expanded={expanded || undefined}
          className={cn(
            'rounded-lg border border-neutral-800/50 overflow-hidden',
            'bg-neutral-900/20',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </InlineTaskShellContext.Provider>
    )
  },
)

InlineTaskShellRoot.displayName = 'InlineTaskShell.Root'
