/**
 * InlineTaskLogView — Root log view component for agent tasks.
 *
 * Renders inside the expanded task row as the "Logs" tab.
 * Orchestrates: filter bar → scrollable log entries → tail controls.
 *
 * On mount:
 * 1. Triggers logStreamTrigger for the taskId (starts mock/nats stream)
 * 2. Subscribes to filteredLogBufferFamily for reactive updates
 * 3. Auto-scrolls when tailMode === 'tail'
 *
 * @module agent-task/views/inline-task-log-view
 */

import React, { useEffect, useRef, useCallback, memo } from 'react'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import {
  filteredLogBufferFamily,
  tailModeFamily,
  logStreamTrigger,
} from '../atoms'
import { LogEntryRow } from './log-entry-row'
import { LogFilterBar } from './log-filter-bar'
import { LogTailControls } from './log-tail-controls'
import './log-view.css'

export interface InlineTaskLogViewProps {
  readonly taskId: string
  /** Compact mode — fewer filter controls, shorter height */
  readonly compact?: boolean
  /** Max height override (default: 280px via CSS) */
  readonly maxHeight?: number
}

export const InlineTaskLogView = memo(function InlineTaskLogView({
  taskId,
  compact = false,
  maxHeight,
}: InlineTaskLogViewProps) {
  const entries = useAtomValue(filteredLogBufferFamily(taskId))
  const tailMode = useAtomValue(tailModeFamily(taskId))
  const setStreamTrigger = useAtomSet(logStreamTrigger)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasTriggered = useRef(false)

  // Trigger stream on mount (once)
  useEffect(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setStreamTrigger(taskId)
    }
  }, [taskId, setStreamTrigger])

  // Auto-scroll to bottom when in tail mode and entries change
  useEffect(() => {
    if (tailMode === 'tail' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, tailMode])

  // Handle user scroll — switch to inspect mode if scrolled up
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 30
    // We don't set tailMode here — that's handled by LogTailControls
    // This prevents fighting between auto-scroll and user intent
  }, [])

  const jumpToLatest = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  const style = maxHeight ? { maxHeight: `${maxHeight}px` } : undefined

  return (
    <div className="at-log-view" style={style}>
      {/* Filter bar */}
      <LogFilterBar compact={compact} />

      {/* Header */}
      <div className="at-log-view__header">
        <span className="at-log-view__title">Real-time Logs</span>
      </div>

      {/* Scrollable entries */}
      <div
        ref={scrollRef}
        className="at-log-view__scroll"
        onScroll={handleScroll}
      >
        {entries.length === 0 ? (
          <div className="at-log-view__empty">Waiting for log entries…</div>
        ) : (
          <div className="at-log-view__entries">
            {entries.map((entry) => (
              <LogEntryRow key={entry.key} entry={entry} />
            ))}
            {tailMode === 'tail' && (
              <span className="at-log-view__cursor" />
            )}
          </div>
        )}
      </div>

      {/* Tail controls */}
      <LogTailControls taskId={taskId} onJumpToLatest={jumpToLatest} />
    </div>
  )
})
