/**
 * ChatInlineTaskVirtualizedList — full-fidelity virtualized task list
 * with @tanstack/react-virtual, AnimatePresence accordion/drawer reveal,
 * transfer clipboard + draggable cluster, keyboard shortcuts, and
 * Effect HashMap dependency resolution.
 *
 * Ports the RVN 471-line component to TMNL Tailwind styling with
 * zero functionality loss.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react'
import { HashMap } from 'effect'
import { useVirtualizer } from '@tanstack/react-virtual'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  createTaskClusterReferenceToken,
  createTaskReferenceToken,
  useTransferClipboard,
  useTransferDraggable,
} from '@/lib/transfer'
import { cn } from '@/lib/utils'
import { ChatInlineTaskExpandControl } from './inline-task-expand-control'
import { ChatInlineTaskRow } from './inline-task-row'
import type { ChatInlineTaskItem } from './inline-task-types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChatInlineTaskVirtualizedListProps extends ComponentPropsWithoutRef<'div'> {
  threadId: string
  messageAnchorId?: string
  expansionLevel?: 'l2' | 'l3'
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  estimatedRowHeight?: number
  overscan?: number
  previewCount?: number
  streaming?: boolean
  autoOpenOnStreaming?: boolean
  previewTasks?: ReadonlyArray<ChatInlineTaskItem>
  expandedTasks?: ReadonlyArray<ChatInlineTaskItem>
  enableTransfer?: boolean
  transferSurfaceId?: string
  transferSourceId?: string
  transferSourceLabel?: string
  transferAgentId?: string
  transferClusterId?: string
  transferClusterLabel?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ChatInlineTaskVirtualizedList = forwardRef<
  HTMLDivElement,
  ChatInlineTaskVirtualizedListProps
>(
  (
    {
      threadId,
      messageAnchorId,
      expansionLevel = 'l2',
      expanded,
      defaultExpanded = false,
      onExpandedChange,
      estimatedRowHeight = 44,
      overscan = 10,
      previewCount = 0,
      streaming = false,
      autoOpenOnStreaming = false,
      previewTasks,
      expandedTasks,
      enableTransfer = true,
      transferSurfaceId = 'tmnl-chat',
      transferSourceId,
      transferSourceLabel = 'Inline Task Thread',
      transferAgentId,
      transferClusterId,
      transferClusterLabel,
      className,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()

    // ── Resolved task list ────────────────────────────────────
    const resolvedExpandedTasks = useMemo(
      () => expandedTasks ?? previewTasks ?? [],
      [expandedTasks, previewTasks],
    )

    // ── Local state ──────────────────────────────────────────
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [selectedTaskIds, setSelectedTaskIds] = useState<ReadonlySet<string>>(new Set())

    const effectiveExpanded = expanded ?? internalExpanded
    const revealMode = expansionLevel === 'l3' ? 'drawer' : 'accordion'

    // ── Virtualizer ──────────────────────────────────────────
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const getScrollElement = useCallback(() => scrollRef.current, [])

    const estimateSize = useCallback(
      (index: number) => {
        const item = resolvedExpandedTasks[index]
        if (item && item.taskId === expandedTaskId) return 128
        return estimatedRowHeight
      },
      [estimatedRowHeight, expandedTaskId, resolvedExpandedTasks],
    )

    const getItemKey = useCallback(
      (index: number) => resolvedExpandedTasks[index]?.taskId ?? `${threadId}:${index}`,
      [resolvedExpandedTasks, threadId],
    )

    const taskIndexById = useMemo(
      () => new Map(resolvedExpandedTasks.map((task, index) => [task.taskId, index])),
      [resolvedExpandedTasks],
    )

    /** Effect HashMap for dep badge resolution in detail panels */
    const taskLookup = useMemo(
      () => HashMap.fromIterable(resolvedExpandedTasks.map((task) => [task.taskId, task] as const)),
      [resolvedExpandedTasks],
    )

    const panelViewportHeight = useMemo(() => {
      const rowCount = Math.max(2, Math.min(resolvedExpandedTasks.length, 6))
      const baseHeight = rowCount * estimatedRowHeight
      return expandedTaskId ? Math.min(400, baseHeight + 200) : Math.min(240, baseHeight)
    }, [resolvedExpandedTasks.length, estimatedRowHeight, expandedTaskId])

    // ── Transfer system ──────────────────────────────────────
    const transferOrigin = useMemo(
      () => ({
        surfaceId: transferSurfaceId,
        sourceId: transferSourceId ?? threadId,
        sourceLabel: transferSourceLabel,
        threadId,
        messageAnchorId,
        agentId: transferAgentId,
      }),
      [messageAnchorId, threadId, transferAgentId, transferSourceId, transferSourceLabel, transferSurfaceId],
    )

    const taskReferenceTokens = useMemo(() => {
      if (!enableTransfer) return new Map<string, ReturnType<typeof createTaskReferenceToken>>()
      return new Map(
        resolvedExpandedTasks.map((task) => [
          task.taskId,
          createTaskReferenceToken(transferOrigin, {
            referenceId: `task:${threadId}:${task.taskId}`,
            taskId: task.taskId,
            label: task.title,
            status: task.status,
          }),
        ]),
      )
    }, [enableTransfer, resolvedExpandedTasks, threadId, transferOrigin])

    const clusterReferenceToken = useMemo(() => {
      if (!enableTransfer || resolvedExpandedTasks.length === 0) return null
      return createTaskClusterReferenceToken(transferOrigin, {
        referenceId: `cluster:${threadId}:${transferClusterId ?? 'all'}`,
        clusterId: transferClusterId ?? `${threadId}-cluster`,
        label: transferClusterLabel ?? `Task cluster (${resolvedExpandedTasks.length})`,
        taskIds: resolvedExpandedTasks.map((task) => task.taskId),
      })
    }, [enableTransfer, resolvedExpandedTasks, threadId, transferClusterId, transferClusterLabel, transferOrigin])

    const selectedTaskList = useMemo(() => Array.from(selectedTaskIds), [selectedTaskIds])

    const selectedTaskTokens = useMemo(
      () =>
        selectedTaskList
          .map((id) => taskReferenceTokens.get(id) ?? null)
          .filter((t): t is NonNullable<typeof t> => t !== null),
      [selectedTaskList, taskReferenceTokens],
    )

    const { copySelection } = useTransferClipboard({
      resolveTokensForSelection: (selectionIds) => {
        if (selectionIds.length === 0) return []
        if (selectionIds.length === 1) {
          const token = taskReferenceTokens.get(selectionIds[0])
          return token ? [token] : []
        }
        return selectionIds
          .map((id) => taskReferenceTokens.get(id) ?? null)
          .filter((t): t is NonNullable<typeof t> => t !== null)
      },
    })

    const fallbackClusterToken = useMemo(
      () =>
        createTaskClusterReferenceToken(transferOrigin, {
          referenceId: `cluster:${threadId}:empty`,
          clusterId: `${threadId}-cluster-empty`,
          label: 'Task cluster',
          taskIds: [],
        }),
      [threadId, transferOrigin],
    )

    const { draggableProps: clusterDraggableProps, copyReference: copyClusterReference } =
      useTransferDraggable({
        token: clusterReferenceToken ?? fallbackClusterToken,
        enabled: enableTransfer && clusterReferenceToken !== null,
        sourceSelectionIds: selectedTaskList,
      })

    // ── Virtualizer instance ─────────────────────────────────
    const virtualizer = useVirtualizer({
      count: resolvedExpandedTasks.length,
      getScrollElement,
      estimateSize,
      overscan,
      getItemKey,
      measureElement: (el) => el.getBoundingClientRect().height,
    })

    const virtualItems = virtualizer.getVirtualItems()

    // ── Effects ──────────────────────────────────────────────
    useEffect(() => {
      if (typeof expanded !== 'boolean') return
      setInternalExpanded(expanded)
    }, [expanded])

    useEffect(() => {
      if (!autoOpenOnStreaming || !streaming || effectiveExpanded) return
      if (typeof expanded !== 'boolean') setInternalExpanded(true)
      onExpandedChange?.(true)
    }, [autoOpenOnStreaming, effectiveExpanded, expanded, onExpandedChange, streaming])

    useEffect(() => {
      if (!effectiveExpanded) {
        setExpandedTaskId(null)
        setSelectedTaskIds(new Set())
      }
    }, [effectiveExpanded])

    useEffect(() => {
      setSelectedTaskIds((prev) => {
        const valid = new Set<string>()
        resolvedExpandedTasks.forEach((task) => {
          if (prev.has(task.taskId)) valid.add(task.taskId)
        })
        return valid
      })
    }, [resolvedExpandedTasks])

    useEffect(() => {
      if (!effectiveExpanded || !expandedTaskId) return
      const expandedIndex = taskIndexById.get(expandedTaskId)
      if (expandedIndex !== undefined) {
        virtualizer.scrollToIndex(expandedIndex, { align: 'end' })
      }
    }, [effectiveExpanded, expandedTaskId, taskIndexById, virtualizer])

    // ── Handlers ─────────────────────────────────────────────
    const toggleExpanded = () => {
      const nextExpanded = !effectiveExpanded
      if (typeof expanded !== 'boolean') setInternalExpanded(nextExpanded)
      if (!nextExpanded) setExpandedTaskId(null)
      onExpandedChange?.(nextExpanded)
    }

    const handleSelectionToggle = useCallback((taskId: string, additive: boolean) => {
      setSelectedTaskIds((prev) => {
        const next = additive ? new Set(prev) : new Set<string>()
        if (next.has(taskId)) next.delete(taskId)
        else next.add(taskId)
        return next
      })
    }, [])

    const handleThreadKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return
        if (selectedTaskList.length === 0) return
        event.preventDefault()
        void copySelection(selectedTaskList)
      },
      [copySelection, selectedTaskList],
    )

    // ── Motion presets ───────────────────────────────────────
    const transition = prefersReducedMotion
      ? { duration: 0.1, ease: 'linear' as const }
      : { duration: 0.16, ease: 'easeOut' as const }

    const accordionInitial = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
    const accordionAnimate = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }
    const accordionExit = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }

    const drawerInitial = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }
    const drawerAnimate = prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }
    const drawerExit = prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8 }

    // ── Guard: nothing to render ─────────────────────────────
    if (resolvedExpandedTasks.length === 0 && !streaming) return null

    // ── Render ───────────────────────────────────────────────
    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-inline-task-virtualized-list"
        data-thread-id={threadId}
        data-message-anchor-id={messageAnchorId}
        data-expanded={effectiveExpanded || undefined}
        data-reveal-mode={revealMode}
        data-transfer-enabled={enableTransfer || undefined}
        className={cn(
          'rounded-lg border border-neutral-800/40 overflow-hidden bg-neutral-900/20',
          className,
        )}
        tabIndex={0}
        onKeyDown={handleThreadKeyDown}
        {...props}
      >
        <AnimatePresence initial={false}>
          {effectiveExpanded ? (
            <motion.div
              key="inline-task-expanded-panel"
              data-slot="tmnl-chat-inline-task-expanded-panel"
              data-mode={revealMode}
              className={cn(
                revealMode === 'drawer' && 'border-l-2 border-l-neutral-700',
              )}
              initial={revealMode === 'drawer' ? drawerInitial : accordionInitial}
              animate={revealMode === 'drawer' ? drawerAnimate : accordionAnimate}
              exit={revealMode === 'drawer' ? drawerExit : accordionExit}
              transition={transition}
            >
              {/* Virtual scroll container */}
              <div
                ref={scrollRef}
                data-slot="tmnl-chat-inline-task-virtual-scroll"
                className="overflow-y-auto"
                style={{ height: `${panelViewportHeight}px` }}
              >
                {/* Virtual inner — full height for scroll positioning */}
                <div
                  data-slot="tmnl-chat-inline-task-virtual-inner"
                  className="relative w-full"
                  style={{ height: `${virtualizer.getTotalSize()}px` }}
                >
                  {virtualItems.map((item) => {
                    const task = resolvedExpandedTasks[item.index]
                    if (!task) return null

                    return (
                      <div
                        key={task.taskId}
                        ref={virtualizer.measureElement}
                        data-index={item.index}
                        data-slot="tmnl-chat-inline-task-virtual-row"
                        className="absolute top-0 left-0 w-full"
                        style={{ transform: `translateY(${item.start}px)` }}
                      >
                        <motion.div
                          initial={
                            prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
                          }
                          animate={
                            prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                          }
                          exit={
                            prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }
                          }
                          transition={{
                            duration: prefersReducedMotion ? 0.08 : 0.14,
                            ease: 'easeOut',
                            delay: prefersReducedMotion
                              ? 0
                              : Math.min((item.index % 8) * 0.02, 0.12),
                          }}
                        >
                          <ChatInlineTaskRow
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
                            transferToken={taskReferenceTokens.get(task.taskId)}
                            transferTokens={
                              selectedTaskIds.has(task.taskId) && selectedTaskTokens.length > 1
                                ? selectedTaskTokens
                                : taskReferenceTokens.get(task.taskId)
                                  ? [taskReferenceTokens.get(task.taskId)!]
                                  : []
                            }
                            transferSelectionIds={selectedTaskList}
                            expanded={expandedTaskId === task.taskId}
                            onExpandedChange={(nextExpanded) => {
                              setExpandedTaskId(nextExpanded ? task.taskId : null)
                            }}
                            onSelectionToggle={handleSelectionToggle}
                          />
                        </motion.div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Expand/collapse control ── */}
        <ChatInlineTaskExpandControl
          expanded={effectiveExpanded}
          previewCount={previewCount}
          totalCount={resolvedExpandedTasks.length}
          onClick={(event) => {
            if ((event.shiftKey || event.metaKey || event.ctrlKey) && clusterReferenceToken) {
              event.preventDefault()
              void copyClusterReference()
              return
            }
            toggleExpanded()
          }}
          {...clusterDraggableProps}
        />
      </div>
    )
  },
)

ChatInlineTaskVirtualizedList.displayName = 'ChatMessage.InlineTaskThread.VirtualizedList'
