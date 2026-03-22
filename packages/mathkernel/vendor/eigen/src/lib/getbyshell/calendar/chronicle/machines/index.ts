/**
 * Chronicle Machines — Barrel Export
 * @module @chronicle/machines
 */

export {
  makeDayMachine,
  InternalGetDay,
  InternalAddNote,
  InternalAddTask,
  InternalAddCard,
  InternalToggleTask,
  InternalSetMood,
  InternalAddLink,
  InternalArchiveDay,
  InternalUnarchiveDay,
  MachineDayNotFoundError,
  MachineDayArchivedError,
  MachineInvalidTransitionError,
} from './DayMachine'
export type { DayMachineState, DayMachineDeps, DayMachine } from './DayMachine'

export {
  dayStateGraph,
  isValidDayTransition,
  getTransitionAction,
  getValidNextStates,
  canActivate,
  canEnrich,
  canSimplify,
  canClear,
  canArchive,
  canUnarchive,
  canAddContent,
  ALL_STATES,
  STATE_COUNT,
} from './graphs'
export type { DayStateNode, DayTransitionAction } from './graphs'
