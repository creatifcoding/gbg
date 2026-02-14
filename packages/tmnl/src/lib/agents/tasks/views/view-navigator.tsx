/**
 * InlineTaskViewNavigator — Three-view slide transition wrapper.
 *
 * Controls the expanded area of a task row:
 * - Tab bar: Detail | Logs | Summary
 * - Slide transition between views
 * - Renders the active view component
 *
 * Transitions: detail slides out left when switching to logs,
 * logs slides out left when switching to summary, and vice versa.
 *
 * @module agent-task/views/view-navigator
 */

import React, { useCallback, useRef, useState, useEffect, memo } from 'react'
import { useAtom } from '@effect-atom/atom-react'
import {
  taskViewModeFamily,
  viewOrder,
  getSlideDirection,
  type TaskViewMode,
} from '../atoms'
import './view-navigator.css'

export interface InlineTaskViewNavigatorProps {
  readonly taskId: string
  /** Render prop for the detail view */
  readonly renderDetail: () => React.ReactNode
  /** Render prop for the logs view */
  readonly renderLogs: () => React.ReactNode
  /** Render prop for the summary view */
  readonly renderSummary: () => React.ReactNode
}

const TAB_LABELS: Record<TaskViewMode, string> = {
  detail: 'Detail',
  logs: 'Logs',
  summary: 'Summary',
}

export const InlineTaskViewNavigator = memo(function InlineTaskViewNavigator({
  taskId,
  renderDetail,
  renderLogs,
  renderSummary,
}: InlineTaskViewNavigatorProps) {
  const [viewMode, setViewMode] = useAtom(taskViewModeFamily(taskId))
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevView = useRef(viewMode)

  const switchView = useCallback(
    (next: TaskViewMode) => {
      if (next === viewMode || isAnimating) return
      const direction = getSlideDirection(viewMode, next)
      setSlideDirection(direction)
      setIsAnimating(true)
      prevView.current = viewMode

      // Start exit animation, then switch
      requestAnimationFrame(() => {
        setTimeout(() => {
          setViewMode(next)
          // After the view switches, reset animation
          setTimeout(() => {
            setSlideDirection(null)
            setIsAnimating(false)
          }, 200) // match CSS transition duration
        }, 150)
      })
    },
    [viewMode, isAnimating, setViewMode],
  )

  const renderActiveView = () => {
    switch (viewMode) {
      case 'detail':
        return renderDetail()
      case 'logs':
        return renderLogs()
      case 'summary':
        return renderSummary()
    }
  }

  return (
    <div className="at-view-nav">
      {/* Tab bar */}
      <div className="at-view-nav__tabs">
        {viewOrder.map((mode) => (
          <button
            key={mode}
            className="at-view-nav__tab"
            data-active={viewMode === mode ? '' : undefined}
            onClick={() => switchView(mode)}
          >
            {TAB_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* View container with slide */}
      <div
        className="at-view-nav__viewport"
        data-slide={slideDirection}
        data-animating={isAnimating ? '' : undefined}
      >
        {renderActiveView()}
      </div>
    </div>
  )
})
