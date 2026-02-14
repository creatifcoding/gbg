import {
  forwardRef,
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react'
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
import type { RvnChatInlineTaskItem, RvnChatInlineTaskStatus } from './inline-task-types'
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
} from '@/lib/agent-task/views'
import { useTransferDraggable, type TransferReferenceToken } from '@/lib/transfer'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_UTILITY_ICON_SIZE,
} from './iconography'

export interface RvnChatInlineTaskRowProps extends ComponentPropsWithoutRef<'article'> {
  task: RvnChatInlineTaskItem
  expanded?: boolean
  selected?: boolean
  /** Sibling task lookup for dependency badge resolution (Effect HashMap) */
  taskIndex?: HashMap.HashMap<string, RvnChatInlineTaskItem>
  onNavigateTask?: (taskId: string) => void
  transferToken?: TransferReferenceToken
  transferTokens?: ReadonlyArray<TransferReferenceToken>
  transferSelectionIds?: ReadonlyArray<string>
  onExpandedChange?: (expanded: boolean) => void
  onSelectionToggle?: (taskId: string, additive: boolean) => void
  /** Toolbar actions to render in expanded panel. Omit to hide toolbar. */
  actions?: ReadonlyArray<InlineTaskRowAction>
  onAction?: (actionId: string, task: RvnChatInlineTaskItem) => void
  /** Show standalone progress bar in expanded panel. Default: true when progress exists. */
  showStandaloneProgress?: boolean
  /** Enable copy-to-clipboard per detail field. Default: false. */
  copyable?: boolean
}

function StatusIndicator({ status }: { status: RvnChatInlineTaskStatus }) {
  const prefersReducedMotion = useReducedMotion()

  if (status === 'running') {
    return (
      <motion.span
        data-slot="rvn-chat-inline-task-row-indicator"
        data-status={status}
        className="rvn-chat__inline-task-row-indicator rvn-chat__inline-task-row-indicator--running"
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { rotate: 360 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12, ease: 'linear' }
            : { duration: 0.9, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
        }
      >
        <LoaderCircle
          size={RVN_CHAT_UTILITY_ICON_SIZE}
          strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
        />
      </motion.span>
    )
  }

  if (status === 'queued') {
    return (
      <motion.span
        data-slot="rvn-chat-inline-task-row-indicator"
        data-status={status}
        className="rvn-chat__inline-task-row-indicator rvn-chat__inline-task-row-indicator--queued"
        aria-hidden="true"
        initial={false}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
        transition={
          prefersReducedMotion
            ? { duration: 0.12, ease: 'linear' }
            : { duration: 1.1, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }
        }
      >
        <Timer
          size={RVN_CHAT_UTILITY_ICON_SIZE}
          strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
        />
      </motion.span>
    )
  }

  switch (status) {
    case 'paused':
      return (
        <span
          data-slot="rvn-chat-inline-task-row-indicator"
          data-status={status}
          className="rvn-chat__inline-task-row-indicator"
          aria-hidden="true"
        >
          <Pause
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      )

    case 'blocked':
      return (
        <span
          data-slot="rvn-chat-inline-task-row-indicator"
          data-status={status}
          className="rvn-chat__inline-task-row-indicator"
          aria-hidden="true"
        >
          <ShieldAlert
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      )

    case 'failed':
      return (
        <span
          data-slot="rvn-chat-inline-task-row-indicator"
          data-status={status}
          className="rvn-chat__inline-task-row-indicator"
          aria-hidden="true"
        >
          <AlertTriangle
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      )

    case 'cancelled':
      return (
        <span
          data-slot="rvn-chat-inline-task-row-indicator"
          data-status={status}
          className="rvn-chat__inline-task-row-indicator"
          aria-hidden="true"
        >
          <Ban
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      )

    case 'completed':
      return (
        <span
          data-slot="rvn-chat-inline-task-row-indicator"
          data-status={status}
          className="rvn-chat__inline-task-row-indicator"
          aria-hidden="true"
        >
          <Check
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      )
  }
}

export const RvnChatInlineTaskRow = forwardRef<HTMLElement, RvnChatInlineTaskRowProps>(
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
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()

    const { taskId, title, status, progress, message, metadata } = task
    const note = metadata?.note

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
            surfaceId: 'rvn-chat',
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

    const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
      if ((event.shiftKey || event.metaKey || event.ctrlKey) && onSelectionToggle) {
        event.preventDefault()
        onSelectionToggle(taskId, true)
        return
      }

      onExpandedChange?.(!expanded)
    }

    return (
      <article
        ref={ref}
        data-slot="rvn-chat-inline-task-row"
        data-task-id={taskId}
        data-status={status}
        data-expanded={expanded || undefined}
        data-selected={selected || undefined}
        data-transfer-state={transferToken ? transferState : undefined}
        className={cn('rvn-chat__inline-task-row', transferToken && 'rvn-chat__inline-task-row--draggable', className)}
        {...draggableProps}
        {...props}
      >
        <button
          type="button"
          className="rvn-chat__inline-task-row-toggle"
          aria-expanded={expanded}
          onClick={handleToggle}
        >
          <span className="rvn-chat__inline-task-row-head">
            <span className="rvn-chat__inline-task-row-grip" aria-hidden="true">
              <GripVertical
                size={RVN_CHAT_UTILITY_ICON_SIZE}
                strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
              />
            </span>
            <span className="rvn-chat__inline-task-row-title">{title}</span>
            <span className="rvn-chat__inline-task-row-status" aria-live="polite">
              <StatusIndicator status={status} />
              <span className="rvn-chat__inline-task-row-status-label">{status}</span>
            </span>
          </span>
          <span className="rvn-chat__inline-task-row-chevron" aria-hidden="true">
            <ChevronDown
              size={RVN_CHAT_UTILITY_ICON_SIZE}
              strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
            />
          </span>
        </button>

        {/* Collapsed-row bottom bar: running = animated stripe, completed = green line */}
        {status === 'running' && normalizedProgress !== null ? (
          <div className="rvn-chat__inline-task-row-bottom-bar" aria-hidden="true">
            <motion.div
              className="rvn-chat__inline-task-row-bottom-bar-fill"
              data-status="running"
              initial={false}
              animate={
                !prefersReducedMotion
                  ? { backgroundPositionX: ['0px', '16px'] }
                  : undefined
              }
              transition={
                !prefersReducedMotion
                  ? { duration: 1, ease: 'linear', repeat: Number.POSITIVE_INFINITY }
                  : undefined
              }
              style={{ width: `${normalizedProgress}%` }}
            />
          </div>
        ) : status === 'completed' ? (
          <div className="rvn-chat__inline-task-row-bottom-bar rvn-chat__inline-task-row-bottom-bar--completed" aria-hidden="true" />
        ) : null}

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="inline-task-details"
              className="rvn-chat__inline-task-row-details"
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
                  <InlineTaskLogView taskId={taskId} compact />
                )}
                renderSummary={() => (
                  <InlineTaskSemanticSummary
                    task={{
                      id: taskId,
                      status,
                      title,
                      progress: normalizedProgress ?? undefined,
                      dependencies: Array.isArray(task.dependencies) ? task.dependencies : undefined,
                      metadata: task.metadata as Record<string, unknown> | undefined,
                      assignmentMode: task.assignmentMode,
                      claimedBy: task.claimedBy,
                    }}
                  />
                )}
              />

              {actions && actions.length > 0 ? (
                <InlineTaskRowToolbar
                  task={task}
                  actions={actions}
                  onAction={onAction}
                />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </article>
    )
  },
)

RvnChatInlineTaskRow.displayName = 'RvnChatMessage.InlineTaskThread.Row'
