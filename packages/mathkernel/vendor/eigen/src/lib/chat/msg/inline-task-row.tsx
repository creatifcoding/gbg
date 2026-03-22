/**
 * ChatInlineTaskRow — full-fidelity task row with status indicators,
 * transfer draggable, animated expand/collapse, and view navigator DI.
 *
 * Ports the RVN 395-line monolith to TMNL Tailwind styling while
 * preserving transfer coupling, motion animations, and DI slots.
 */
import {
  forwardRef,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { Atom } from '@effect-atom/atom'
import type { HashMap } from 'effect'
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  GripVertical,
  LoaderCircle,
  Pause,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { ChatInlineTaskItem, ChatInlineTaskStatus } from './inline-task-types'
import { InlineTaskDetail } from './inline-task-detail'
import {
  InlineTaskRowToolbar,
  InlineTaskRowProgress,
  type InlineTaskRowAction,
} from './inline-task-shell/row'
import {
  InlineTaskViewNavigator,
  InlineTaskLogView,
  InlineTaskSemanticSummary,
} from '@/lib/agents/tasks/views'
import type { AgentTaskLogAtomSurfaceAtoms } from '@/lib/agents/tasks/atoms'
import { useTransferDraggable, type TransferReferenceToken } from '@/lib/transfer'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ICON_SIZE = 14
const ICON_STROKE = 1.75

// ---------------------------------------------------------------------------
// Status color map (TMNL palette)
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<ChatInlineTaskStatus, string> = {
  queued: 'text-neutral-500',
  claimed: 'text-blue-400',
  running: 'text-cyan-400',
  paused: 'text-amber-400',
  blocked: 'text-red-400',
  failed: 'text-red-500',
  cancelled: 'text-neutral-600',
  completed: 'text-emerald-400',
}

const STATUS_BAR: Record<string, string> = {
  running: 'bg-cyan-400',
  completed: 'bg-emerald-400',
  failed: 'bg-red-400',
}

// ---------------------------------------------------------------------------
// StatusIndicator — animated icon per status
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: ChatInlineTaskStatus }) {
  const prefersReducedMotion = useReducedMotion()

  if (status === 'running') {
    return (
      <motion.span
        data-slot="tmnl-chat-inline-task-row-indicator"
        data-status={status}
        className={cn('inline-flex', STATUS_COLOR[status])}
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { rotate: 360 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12, ease: 'linear' }
            : { duration: 0.9, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
        }
      >
        <LoaderCircle size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </motion.span>
    )
  }

  if (status === 'queued') {
    return (
      <motion.span
        data-slot="tmnl-chat-inline-task-row-indicator"
        data-status={status}
        className={cn('inline-flex', STATUS_COLOR[status])}
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12, ease: 'linear' }
            : { duration: 1.1, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
        }
      >
        <Timer size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </motion.span>
    )
  }

  const iconMap: Partial<Record<ChatInlineTaskStatus, ReactNode>> = {
    paused: <Pause size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    blocked: <ShieldAlert size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    failed: <AlertTriangle size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    cancelled: <Ban size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    completed: <Check size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  }

  const icon = iconMap[status]
  if (!icon) return null

  return (
    <span
      data-slot="tmnl-chat-inline-task-row-indicator"
      data-status={status}
      className={cn('inline-flex', STATUS_COLOR[status])}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatInlineTaskRowProps extends ComponentPropsWithoutRef<'article'> {
  task: ChatInlineTaskItem
  expanded?: boolean
  selected?: boolean
  /** Sibling task lookup for dependency badge resolution (Effect HashMap) */
  taskIndex?: HashMap.HashMap<string, ChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  transferToken?: TransferReferenceToken
  transferTokens?: ReadonlyArray<TransferReferenceToken>
  transferSelectionIds?: ReadonlyArray<string>
  onExpandedChange?: (expanded: boolean) => void
  onSelectionToggle?: (taskId: string, additive: boolean) => void
  /** Toolbar actions to render in expanded panel. Omit to hide toolbar. */
  actions?: ReadonlyArray<InlineTaskRowAction>
  onAction?: (actionId: string, task: ChatInlineTaskItem) => void
  /** Show standalone progress bar in expanded panel. Default: true when progress exists. */
  showStandaloneProgress?: boolean
  /** Enable copy-to-clipboard per detail field. Default: false. */
  copyable?: boolean
  /** Optional DI atom surface for log view. */
  taskLogAtomSurfaceAtom?: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatInlineTaskRow = forwardRef<HTMLElement, ChatInlineTaskRowProps>(
  (
    {
      task,
      expanded = false,
      selected = false,
      taskIndex,
      onNavigateTask,
      transferToken,
      transferSelectionIds,
      transferTokens,
      onExpandedChange,
      onSelectionToggle,
      actions,
      onAction,
      showStandaloneProgress,
      copyable = false,
      taskLogAtomSurfaceAtom,
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()

    const { taskId, title, status, progress, metadata } = task

    const normalizedProgress =
      typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null

    const showProgress = normalizedProgress !== null || status === 'running' || status === 'queued'
    const progressWidth =
      normalizedProgress !== null
        ? normalizedProgress
        : status === 'completed'
          ? 100
          : 56

    const animateStripe = !prefersReducedMotion && (status === 'running' || status === 'queued')
    const [transferState, setTransferState] = useState<'idle' | 'dragging'>('idle')

    const { draggableProps } = useTransferDraggable({
      token:
        transferToken ?? {
          tokenId: `task:${taskId}`,
          version: '1',
          createdAt: 0,
          origin: {
            surfaceId: 'tmnl-chat',
            sourceId: `inline-task:${taskId}`,
            sourceLabel: 'Inline Task',
          },
          reference: {
            _tag: 'TransferTaskReference',
            kind: 'task',
            referenceId: `task:${taskId}`,
            taskId,
            label: title,
            status,
          },
        },
      tokens: transferTokens,
      enabled: Boolean(transferToken),
      sourceSelectionIds: transferSelectionIds ?? [taskId],
      onDragStateChange: (dragging) => {
        setTransferState(dragging ? 'dragging' : 'idle')
      },
    })

    const handleToggle = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        if ((event.shiftKey || event.metaKey || event.ctrlKey) && onSelectionToggle) {
          event.preventDefault()
          onSelectionToggle(taskId, true)
          return
        }
        onExpandedChange?.(!expanded)
      },
      [expanded, onExpandedChange, onSelectionToggle, taskId],
    )

    return (
      <article
        ref={ref}
        data-slot="tmnl-chat-inline-task-row"
        data-task-id={taskId}
        data-status={status}
        data-expanded={expanded || undefined}
        data-selected={selected || undefined}
        data-transfer-state={transferToken ? transferState : undefined}
        className={cn(
          'group/row relative',
          'border-b border-neutral-800/20',
          selected && 'bg-cyan-500/[0.05] border-l-2 border-l-cyan-500/40',
          transferState === 'dragging' && 'opacity-50',
          className,
        )}
        {...draggableProps}
        {...props}
      >
        {/* ── Toggle row ── */}
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-left',
            'hover:bg-neutral-800/20 transition-colors duration-100',
          )}
          aria-expanded={expanded}
          onClick={handleToggle}
        >
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {/* Grip handle */}
            <span
              className="text-neutral-700 shrink-0 cursor-grab opacity-0 group-hover/row:opacity-100 transition-opacity"
              aria-hidden="true"
            >
              <GripVertical size={ICON_SIZE} strokeWidth={ICON_STROKE} />
            </span>

            {/* Title */}
            <span
              className="font-mono text-neutral-300 truncate flex-1"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {title}
            </span>

            {/* Status indicator + label */}
            <span className="flex items-center gap-1 shrink-0" aria-live="polite">
              <StatusIndicator status={status} />
              <span
                className={cn('font-mono uppercase tracking-wider', STATUS_COLOR[status])}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {status}
              </span>
            </span>
          </span>

          {/* Chevron */}
          <span
            className={cn(
              'text-neutral-600 transition-transform duration-150 shrink-0',
              expanded && 'rotate-180',
            )}
            aria-hidden="true"
          >
            <ChevronDown size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </span>
        </button>

        {/* ── Bottom bar: running = animated stripe, completed = green line ── */}
        {status === 'running' && normalizedProgress !== null ? (
          <div className="h-0.5 bg-neutral-800/50" aria-hidden="true">
            <motion.div
              className={cn('h-full', STATUS_BAR.running)}
              initial={false}
              animate={
                animateStripe
                  ? { backgroundPositionX: ['0px', '16px'] }
                  : undefined
              }
              transition={
                animateStripe
                  ? { duration: 1, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
                  : undefined
              }
              style={{
                width: `${normalizedProgress}%`,
                ...(animateStripe
                  ? {
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)',
                      backgroundSize: '16px 16px',
                    }
                  : {}),
              }}
            />
          </div>
        ) : status === 'completed' ? (
          <div className="h-0.5 bg-emerald-400/60" aria-hidden="true" />
        ) : null}

        {/* ── Expanded detail panel ── */}
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="inline-task-details"
              className="px-3 pb-3 pt-1"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.12, ease: 'easeOut' }}
            >
              <InlineTaskViewNavigator
                taskId={taskId}
                renderDetail={() => (
                  <InlineTaskDetail
                    task={task}
                    taskIndex={taskIndex}
                    onNavigateTask={onNavigateTask}
                    copyable={copyable}
                  />
                )}
                renderLogs={() => (
                  <InlineTaskLogView
                    taskId={taskId}
                    compact
                    atomSurfaceAtom={taskLogAtomSurfaceAtom}
                  />
                )}
                renderSummary={() => (
                  <InlineTaskSemanticSummary
                    task={{
                      id: taskId,
                      status,
                      title,
                      progress: normalizedProgress ?? undefined,
                      dependencies: Array.isArray(task.dependencies)
                        ? task.dependencies
                        : undefined,
                      metadata: task.metadata as Record<string, unknown> | undefined,
                      assignmentMode: task.assignmentMode,
                      claimedBy: task.claimedBy,
                    }}
                  />
                )}
              />

              {actions && actions.length > 0 ? (
                <InlineTaskRowToolbar task={task} actions={actions} onAction={onAction} />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    )
  },
)

ChatInlineTaskRow.displayName = 'ChatMessage.InlineTaskThread.Row'
