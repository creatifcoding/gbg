/**
 * Per-task view state atom — 'detail' | 'logs' | 'summary'
 *
 * Controls which view is shown in the expanded task row:
 * - 'detail': Schema-driven field grid (existing InlineTaskDetail)
 * - 'logs': Live log stream (InlineTaskLogView)
 * - 'summary': Polymorphic semantic summary (InlineTaskSemanticSummary)
 *
 * @module agent-task/atoms/view-state
 */

import { Atom } from '@effect-atom/atom'

/** The three views available in an expanded task row. */
export type TaskViewMode = 'detail' | 'logs' | 'summary'

/**
 * Per-task view mode.
 * Defaults to 'detail' — schema field grid.
 */
export const taskViewModeFamily = Atom.family(
  (_taskId: string) => Atom.make<TaskViewMode>('detail'),
)

/**
 * Direction of the slide transition.
 * Derived from the previous and next view.
 *
 * detail ← → logs ← → summary
 */
export const viewOrder: ReadonlyArray<TaskViewMode> = ['detail', 'logs', 'summary']

export const getSlideDirection = (
  from: TaskViewMode,
  to: TaskViewMode,
): 'left' | 'right' => {
  const fromIdx = viewOrder.indexOf(from)
  const toIdx = viewOrder.indexOf(to)
  return toIdx > fromIdx ? 'left' : 'right'
}
