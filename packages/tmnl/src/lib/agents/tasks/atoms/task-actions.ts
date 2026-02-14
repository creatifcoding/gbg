/**
 * Task Action State Machine — status → available actions mapping.
 *
 * Derived Atom.family: given a task's status, produces the set of
 * actions available in the toolbar. This is the "polymorphic button"
 * pattern from the integrate spec.
 *
 * Action taxonomy:
 * - running: View Logs, Stop Execution (danger)
 * - completed: View Logs, Rerun Task
 * - failed: View Logs, Retry Task, View Error
 * - queued: View Logs, Cancel Task, Prioritize
 * - paused: View Logs, Resume, Cancel (danger)
 *
 * @module agent-task/atoms/task-actions
 */

import { Atom } from '@effect-atom/atom'

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

/** Action variant determines visual treatment. */
export type ActionVariant = 'default' | 'primary' | 'danger'

/** A single toolbar action. */
export interface TaskAction {
  readonly id: string
  readonly label: string
  readonly variant: ActionVariant
  /** Lucide icon name (or null for text-only) */
  readonly icon?: string
}

// ---------------------------------------------------------------------------
// Status → Actions mapping (the state machine)
// ---------------------------------------------------------------------------

const ACTIONS_BY_STATUS: Record<string, ReadonlyArray<TaskAction>> = {
  running: [
    { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
    { id: 'stop', label: 'Stop Execution', variant: 'danger', icon: 'Square' },
  ],
  completed: [
    { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
    { id: 'rerun', label: 'Rerun Task', variant: 'primary', icon: 'RotateCcw' },
  ],
  failed: [
    { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
    { id: 'view-error', label: 'View Error', variant: 'default', icon: 'AlertTriangle' },
    { id: 'retry', label: 'Retry Task', variant: 'primary', icon: 'RotateCcw' },
  ],
  queued: [
    { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
    { id: 'cancel', label: 'Cancel Task', variant: 'default', icon: 'X' },
    { id: 'prioritize', label: 'Prioritize', variant: 'primary', icon: 'ArrowUp' },
  ],
  paused: [
    { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
    { id: 'resume', label: 'Resume', variant: 'primary', icon: 'Play' },
    { id: 'cancel', label: 'Cancel', variant: 'danger', icon: 'X' },
  ],
}

const DEFAULT_ACTIONS: ReadonlyArray<TaskAction> = [
  { id: 'view-logs', label: 'View Logs', variant: 'default', icon: 'Eye' },
]

/** Get actions for a status string. */
export const getActionsForStatus = (
  status: string,
): ReadonlyArray<TaskAction> => ACTIONS_BY_STATUS[status] ?? DEFAULT_ACTIONS

// ---------------------------------------------------------------------------
// Derived atom family — keyed by taskId
// ---------------------------------------------------------------------------

/**
 * Per-task status atom.
 * External code sets this to keep actions in sync with task state.
 */
export const taskStatusFamily = Atom.family(
  (_taskId: string) => Atom.make<string>('queued'),
)

/**
 * Derived: available actions for a task.
 * Re-computes when taskStatusFamily changes.
 */
export const taskActionsFamily = Atom.family(
  (taskId: string) =>
    Atom.readable((get) => {
      const status = get(taskStatusFamily(taskId))
      return getActionsForStatus(status)
    }),
)
