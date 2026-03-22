/**
 * LogTailControls — Tail/inspect toggle + jump-to-latest.
 *
 * - 'tail' mode: auto-scroll follows latest entries (live indicator)
 * - 'inspect' mode: user has scrolled up, paused auto-scroll
 * - Jump-to-latest button appears in inspect mode
 *
 * @module agent-task/views/log-tail-controls
 */

import React, { useCallback } from 'react'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import {
  tailModeFamily,
  unreadCountFamily,
  logCountFamily,
  logTotalCountFamily,
  type AgentTaskLogAtomSurfaceAtoms,
} from '../atoms'
import './log-view.css'

export interface LogTailControlsProps {
  readonly taskId: string
  /** Optional injected atom surface. */
  readonly atoms?: AgentTaskLogAtomSurfaceAtoms
  /** Callback when jump-to-latest is clicked */
  readonly onJumpToLatest?: () => void
  /** Optional override for unread count from parent-controlled lifecycle */
  readonly unreadCountOverride?: number
}

export function LogTailControls({
  taskId,
  atoms,
  onJumpToLatest,
  unreadCountOverride,
}: LogTailControlsProps) {
  const [tailMode, setTailMode] = useAtom(
    (atoms?.tailModeFamily ?? tailModeFamily)(taskId),
  )
  const unreadCountFromAtom = useAtomValue(
    (atoms?.unreadCountFamily ?? unreadCountFamily)(taskId),
  )
  const filteredCount = useAtomValue(
    (atoms?.logCountFamily ?? logCountFamily)(taskId),
  )
  const totalCount = useAtomValue(
    (atoms?.logTotalCountFamily ?? logTotalCountFamily)(taskId),
  )
  const unreadCount = unreadCountOverride ?? unreadCountFromAtom

  const toggleMode = useCallback(() => {
    setTailMode((prev) => (prev === 'tail' ? 'inspect' : 'tail'))
  }, [setTailMode])

  const handleJump = useCallback(() => {
    setTailMode('tail')
    onJumpToLatest?.()
  }, [setTailMode, onJumpToLatest])

  const isFiltered = filteredCount !== totalCount

  return (
    <div className="at-log-tail-controls">
      <div className="at-log-tail-controls__status" data-mode={tailMode}>
        <span className="at-log-tail-controls__dot" />
        <span className="at-log-tail-controls__label">
          {tailMode === 'tail' ? 'LIVE' : 'PAUSED'}
        </span>
      </div>

      <span className="at-log-tail-controls__count">
        {isFiltered ? `${filteredCount}/${totalCount}` : totalCount}
        {isFiltered && (
          <span className="at-log-tail-controls__filtered"> filtered</span>
        )}
      </span>

      {tailMode === 'inspect' && unreadCount > 0 ? (
        <span className="at-log-tail-controls__unread" aria-live="polite">
          +{unreadCount} new
        </span>
      ) : null}

      <button
        className="at-log-tail-controls__toggle"
        onClick={toggleMode}
        title={tailMode === 'tail' ? 'Pause auto-scroll' : 'Resume auto-scroll'}
      >
        {tailMode === 'tail' ? '⏸' : '▶'}
      </button>

      {tailMode === 'inspect' && (
        <button
          className="at-log-tail-controls__jump"
          onClick={handleJump}
          title="Jump to latest"
        >
          ↓ Latest{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
      )}
    </div>
  )
}
