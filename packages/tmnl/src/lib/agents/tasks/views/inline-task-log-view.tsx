/**
 * InlineTaskLogView — Root log view component for agent tasks.
 *
 * Renders inside the expanded task row as the "Logs" tab.
 * Orchestrates: filter bar → scrollable log entries → tail controls.
 *
 * Atom dependencies are injected through a DI-able atom surface
 * (Context.Tag-backed), with a default mock-backed runtime.
 *
 * @module agent-task/views/inline-task-log-view
 */

import React, { useEffect, useRef, useCallback, memo } from 'react'
import type { Atom } from '@effect-atom/atom'
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'
import {
  agentTaskLogSurfaceMockRuntime,
  type AgentTaskLogAtomSurfaceAtoms,
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
  /** Optional injected atom-surface atom (DI seam). */
  readonly atomSurfaceAtom?: Atom.Atom<AgentTaskLogAtomSurfaceAtoms>
}

export const InlineTaskLogView = memo(function InlineTaskLogView({
  taskId,
  compact = false,
  maxHeight,
  atomSurfaceAtom = agentTaskLogSurfaceMockRuntime.atomSurfaceAtom,
}: InlineTaskLogViewProps) {
  const atoms = useAtomValue(atomSurfaceAtom)

  const entries = useAtomValue(atoms.filteredLogBufferFamily(taskId))
  const tailMode = useAtomValue(atoms.tailModeFamily(taskId))
  const setStreamTrigger = useAtomSet(atoms.logStreamTrigger)
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

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    // Reserved for future auto tail/inspect mode switching.
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
      <LogFilterBar compact={compact} atoms={atoms} />

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
            {tailMode === 'tail' && <span className="at-log-view__cursor" />}
          </div>
        )}
      </div>

      {/* Tail controls */}
      <LogTailControls taskId={taskId} atoms={atoms} onJumpToLatest={jumpToLatest} />
    </div>
  )
})
