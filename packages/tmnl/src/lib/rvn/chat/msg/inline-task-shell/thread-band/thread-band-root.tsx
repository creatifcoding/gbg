/**
 * ThreadBand — virtualizer viewport for the inline task shell.
 *
 * Absorbs the virtualizer setup, row rendering, scroll-to-task navigation,
 * and selection state from the former VirtualizedList component. The shell
 * context provides all state; this band is a pure viewport consumer.
 *
 * CSS: `.rvn-chat__inline-task-shell-thread-band`.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion, useReducedMotion } from 'motion/react'
import { Eye, RotateCcw, X } from 'lucide-react'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { RvnChatInlineTaskRow } from '../../inline-task-row'
import type { InlineTaskRowAction } from '../row'
import { cn } from '@/lib/utils'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
} from '../../iconography'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

// ── Default toolbar actions (muse parity: View Logs / Retry / Abort) ─────

const DEFAULT_ACTIONS: ReadonlyArray<InlineTaskRowAction> = [
  {
    id: 'view-logs',
    label: 'View Logs',
    icon: <Eye size={12} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} />,
  },
  {
    id: 'retry',
    label: 'Retry',
    icon: <RotateCcw size={12} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} />,
  },
  {
    id: 'abort',
    label: 'Abort',
    icon: <X size={12} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} />,
    variant: 'danger',
  },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ThreadBandProps extends ComponentPropsWithoutRef<'div'> {
  estimatedRowHeight?: number
  overscan?: number
  /** Maximum rows visible before scroll. Default 6. */
  maxVisibleRows?: number
  /** Override toolbar actions per row. Default: View Logs / Retry / Abort */
  actions?: ReadonlyArray<InlineTaskRowAction>
  /** Callback when a toolbar action is clicked */
  onAction?: (actionId: string, task: any) => void
  /** Enable copy-to-clipboard per detail field. Default: true */
  copyable?: boolean
  /** Show standalone progress bar in expanded detail. Default: true */
  showStandaloneProgress?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ThreadBand = forwardRef<HTMLDivElement, ThreadBandProps>(
  (
    {
      estimatedRowHeight = 44,
      overscan = 10,
      maxVisibleRows = 6,
      actions = DEFAULT_ACTIONS,
      onAction,
      copyable = true,
      showStandaloneProgress = true,
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const {
      expanded,
      filteredTasks,
      expandedTaskId,
      setExpandedTaskId,
      selectedTaskIds,
      toggleSelection,
      taskLookup,
      transfer,
      taskLogAtomSurfaceAtom,
    } = useInlineTaskShellContext()

    const scrollRef = useRef<HTMLDivElement | null>(null)

    // ── Virtualizer setup ────────────────────────────────────────────
    const getScrollElement = useCallback(() => scrollRef.current, [])

    const estimateSize = useCallback(
      (index: number) => {
        const item = filteredTasks[index]
        if (item && item.taskId === expandedTaskId) return 128
        return estimatedRowHeight
      },
      [estimatedRowHeight, expandedTaskId, filteredTasks],
    )

    const getItemKey = useCallback(
      (index: number) => filteredTasks[index]?.taskId ?? `shell:${index}`,
      [filteredTasks],
    )

    const taskIndexById = useMemo(
      () => new Map(filteredTasks.map((task, index) => [task.taskId, index])),
      [filteredTasks],
    )

    const virtualizer = useVirtualizer({
      count: filteredTasks.length,
      getScrollElement,
      estimateSize,
      overscan,
      getItemKey,
      measureElement: (el) => el.getBoundingClientRect().height,
    })

    const virtualItems = virtualizer.getVirtualItems()

    // ── Viewport height ──────────────────────────────────────────────
    const panelViewportHeight = useMemo(() => {
      const rowCount = Math.max(2, Math.min(filteredTasks.length, maxVisibleRows))
      const baseHeight = rowCount * estimatedRowHeight
      return expandedTaskId ? Math.min(400, baseHeight + 200) : Math.min(240, baseHeight)
    }, [filteredTasks.length, estimatedRowHeight, expandedTaskId, maxVisibleRows])

    // ── Scroll to expanded task ──────────────────────────────────────
    useEffect(() => {
      if (!expanded || !expandedTaskId) return
      const idx = taskIndexById.get(expandedTaskId)
      if (idx !== undefined) {
        virtualizer.scrollToIndex(idx, { align: 'end' })
      }
    }, [expanded, expandedTaskId, taskIndexById, virtualizer])

    // ── Keyboard copy ────────────────────────────────────────────────
    const handleKeyDown = useCallback(
      (_event: KeyboardEvent<HTMLDivElement>) => {
        // Future: Ctrl+C copy selection handled via shell-level handler
      },
      [],
    )

    // ── Render guard ─────────────────────────────────────────────────
    if (!expanded || filteredTasks.length === 0) return null

    return (
      <div
        ref={ref}
        className={cn('rvn-chat__inline-task-shell-thread-band', className)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <div
          ref={scrollRef}
          className="rvn-chat__inline-task-shell-thread-band-scroll"
          style={{ height: `${panelViewportHeight}px`, overflowY: 'auto' }}
        >
          <div
            className="rvn-chat__inline-task-shell-thread-band-inner"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualItems.map((item) => {
              const task = filteredTasks[item.index]
              if (!task) return null

              const rowTransfer = transfer?.getRowTransferProps(task.taskId)

              return (
                <div
                  key={task.taskId}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  data-transfer-dragging={rowTransfer?.isDragging || undefined}
                  className="rvn-chat__inline-task-shell-thread-band-row"
                  draggable={rowTransfer?.draggable}
                  onDragStart={rowTransfer?.onDragStart}
                  onDragEnd={rowTransfer?.onDragEnd}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <motion.div
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
                    transition={{
                      duration: prefersReducedMotion ? 0.08 : 0.14,
                      ease: 'easeOut',
                      delay: prefersReducedMotion
                        ? 0
                        : Math.min((item.index % 8) * 0.02, 0.12),
                    }}
                  >
                    <RvnChatInlineTaskRow
                      task={task}
                      taskIndex={taskLookup}
                      onNavigateTask={(depId) => {
                        const depIndex = taskIndexById.get(depId)
                        if (depIndex !== undefined) {
                          setExpandedTaskId(depId)
                          virtualizer.scrollToIndex(depIndex, { align: 'center' })
                        }
                      }}
                      selected={selectedTaskIds.has(task.taskId)}
                      expanded={expandedTaskId === task.taskId}
                      onExpandedChange={(nextExpanded) => {
                        setExpandedTaskId(nextExpanded ? task.taskId : null)
                      }}
                      onSelectionToggle={toggleSelection}
                      actions={actions}
                      onAction={onAction}
                      copyable={copyable}
                      showStandaloneProgress={showStandaloneProgress}
                      taskLogAtomSurfaceAtom={taskLogAtomSurfaceAtom}
                    />
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  },
)

ThreadBand.displayName = 'InlineTaskShell.ThreadBand'
