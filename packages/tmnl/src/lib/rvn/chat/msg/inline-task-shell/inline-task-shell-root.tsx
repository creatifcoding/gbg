/**
 * InlineTaskShell root — context provider and layout frame.
 *
 * Owns all mutable state (expanded, searchTerm, expandedTaskId, selectedTaskIds)
 * and derived values (filteredTasks, taskLookup, metrics). Provides everything
 * via InlineTaskShellContext. Children are the band components.
 *
 * CSS: `.rvn-chat__inline-task-shell`.
 */
import {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import { HashMap } from 'effect'
import type { RvnChatInlineTaskItem } from '../inline-task-types'
import {
  InlineTaskShellContext,
  type InlineTaskShellContextValue,
  type InlineTaskShellMetrics,
} from './inline-task-shell-context'
import { cn } from '@/lib/utils'
import { useInlineTaskTransfer } from '@/lib/transfer/v2/hooks'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineTaskShellRootProps extends ComponentPropsWithoutRef<'div'> {
  threadId: string
  tasks: ReadonlyArray<RvnChatInlineTaskItem>

  /** Controlled expanded state */
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

// ---------------------------------------------------------------------------
// Metrics derivation
// ---------------------------------------------------------------------------

function deriveMetrics(tasks: ReadonlyArray<RvnChatInlineTaskItem>): InlineTaskShellMetrics {
  let running = 0
  let completed = 0
  let failed = 0
  let queued = 0
  let blocked = 0

  for (const task of tasks) {
    switch (task.status) {
      case 'running': running++; break
      case 'completed': completed++; break
      case 'failed': failed++; break
      case 'queued': queued++; break
      case 'blocked': blocked++; break
    }
  }

  const denom = completed + failed
  const successRate = denom > 0 ? Math.round((completed / denom) * 100) : 0

  return {
    total: tasks.length,
    running,
    completed,
    failed,
    queued,
    blocked,
    successRate,
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
      expanded: expandedProp,
      defaultExpanded = false,
      onExpandedChange,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    // ── Refs ───────────────────────────────────────────────────────
    const shellRef = useRef<HTMLDivElement>(null)

    // ── State ──────────────────────────────────────────────────────
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(new Set())

    const expanded = expandedProp ?? internalExpanded

    const setExpanded = useCallback(
      (next: boolean) => {
        if (expandedProp === undefined) {
          setInternalExpanded(next)
        }
        onExpandedChange?.(next)
        if (!next) {
          setExpandedTaskId(null)
          setSelectedTaskIds(new Set())
        }
      },
      [expandedProp, onExpandedChange],
    )

    // ── Derived state ──────────────────────────────────────────────
    const filteredTasks = useMemo(() => {
      if (!searchTerm) return tasks
      const lower = searchTerm.toLowerCase()
      return tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(lower) ||
          t.taskId.toLowerCase().includes(lower),
      )
    }, [tasks, searchTerm])

    const taskLookup = useMemo(
      () => HashMap.fromIterable(tasks.map((t) => [t.taskId, t] as const)),
      [tasks],
    )

    const metrics = useMemo(() => deriveMetrics(tasks), [tasks])

    // ── Selection handlers ─────────────────────────────────────────
    const toggleSelection = useCallback((taskId: string, additive: boolean) => {
      setSelectedTaskIds((prev) => {
        const next = additive ? new Set(prev) : new Set<string>()
        if (next.has(taskId)) {
          next.delete(taskId)
        } else {
          next.add(taskId)
        }
        return next
      })
    }, [])

    const clearSelection = useCallback(() => setSelectedTaskIds(new Set()), [])

    // ── Transfer v2 ────────────────────────────────────────────────
    const transfer = useInlineTaskTransfer({
      threadId,
      tasks: tasks.map((t) => ({ id: t.taskId, label: t.title, status: t.status })),
      clusterLabel: `${tasks.length} tasks`,
      shellRef,
    })

    // ── Context value ──────────────────────────────────────────────
    const ctxValue = useMemo<InlineTaskShellContextValue>(
      () => ({
        threadId,
        tasks,
        filteredTasks,
        searchTerm,
        setSearchTerm,
        expanded,
        setExpanded,
        expandedTaskId,
        setExpandedTaskId,
        selectedTaskIds,
        toggleSelection,
        clearSelection,
        taskLookup,
        metrics,
        transfer,
      }),
      [
        threadId,
        tasks,
        filteredTasks,
        searchTerm,
        expanded,
        setExpanded,
        expandedTaskId,
        selectedTaskIds,
        toggleSelection,
        clearSelection,
        taskLookup,
        metrics,
        transfer,
      ],
    )

    return (
      <InlineTaskShellContext.Provider value={ctxValue}>
        <div
          ref={(node) => {
            // Merge forwarded ref + local shell ref
            ;(shellRef as React.MutableRefObject<HTMLDivElement | null>).current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
          }}
          data-slot="rvn-chat-inline-task-shell"
          data-thread-id={threadId}
          data-expanded={expanded || undefined}
          className={cn('rvn-chat__inline-task-shell', className)}
          {...props}
        >
          {children}
        </div>
      </InlineTaskShellContext.Provider>
    )
  },
)

InlineTaskShellRoot.displayName = 'InlineTaskShell.Root'
