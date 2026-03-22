/**
 * Calendar System — Barrel Export
 *
 * Re-exports from both legacy types.ts (backward compat) and
 * the new Chronicle spine (schemas, state, machines, services).
 *
 * New code should import from '@/lib/getbyshell/calendar/chronicle' directly.
 *
 * @module @getbyshell/calendar
 */

// ─── Components ─────────────────────────────────────────────────────────────
export { Calendar } from './Calendar'

// ─── Legacy types (backward compat — consumers import DayMeta, CalendarActions) ──
export type { DayMeta, CalendarActions, SelectionMode } from './types'
export { DateKey } from './types'

// ─── Chronicle re-exports (new spine) ───────────────────────────────────────
export {
  // Schemas
  CalendarEvent, CalendarSource, EventPriority,
  DayNote, DayCard, DayTask,
  LinkRelationship, LinkableEntity, LinkDiscoverer, KnowledgeLink,
  EnergyLevel, Sentiment, DayMood,
  MediaType, MediaAttachment,
  Day, DaySummary,
  DayLifecycleState,
  DayId, NoteId, CardId, DayTaskId, LinkId, AttachmentId,
  // Commands
  CreateNoteParams, CreateTaskParams, CreateCardParams,
  ToggleTaskParams, SetMoodParams, AddLinkParams,
  ArchiveDayParams, UnarchiveDayParams,
  // Queries
  DayQueryParams, MonthQueryParams,
  // State
  DayState, DayStateInMemory, DayStateLocalStorage, DayStateNotFoundError,
  // Machines
  dayStateGraph, isValidDayTransition,
  canArchive, canUnarchive, canAddContent,
  makeDayMachine,
  MachineDayNotFoundError, MachineDayArchivedError, MachineInvalidTransitionError,
  // Services
  ChronicleService,
  // Modal state
  ChronicleState, ChronicleOpenCmd, ChronicleNavCmd,
  // Entrance
  ChronicleEntrance,
} from './chronicle'

export type {
  EntrancePhase, SidePanelTab, DayViewMode, NavDirection,
  DayStateNode, DayTransitionAction,
  DayStateShape, DayFilter,
  ChronicleServiceShape,
} from './chronicle'
