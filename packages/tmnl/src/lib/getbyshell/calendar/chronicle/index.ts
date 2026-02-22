/**
 * Chronicle — Fullscreen Calendar Modal
 *
 * Rich Day entity system with lifecycle machine, knowledge links,
 * holographic projection entrance, and Melanie integration.
 *
 * Architecture follows the IIoT Alarm vertical slice pattern:
 * schemas → state → machines/graphs → services → atoms → hooks
 *
 * @module @chronicle
 */

// ─── Components ─────────────────────────────────────────────────────────────
export { ChronicleEntrance } from './ChronicleEntrance'

// ─── Modal State (existing) ─────────────────────────────────────────────────
export type { EntrancePhase, SidePanelTab, DayViewMode, NavDirection } from './types'
export { ChronicleState, ChronicleOpenCmd, ChronicleNavCmd } from './types'

// ─── Schemas ────────────────────────────────────────────────────────────────
export {
  // Identifiers
  DayId, NoteId, CardId, DayTaskId, LinkId, AttachmentId,
  // Day lifecycle
  DayLifecycleState,
  // Event types
  CalendarSource, EventPriority,
  CalendarEvent,
  // Sub-entities
  DayNote, DayCard, DayTask,
  // Knowledge links
  LinkRelationship, LinkableEntity, LinkDiscoverer, KnowledgeLink,
  // Mood
  EnergyLevel, Sentiment, DayMood,
  // Media
  MediaType, MediaAttachment,
  // Aggregates
  Day, DaySummary,
  // Commands
  CreateNoteParams, UpdateNoteParams, DeleteNoteParams,
  CreateTaskParams, ToggleTaskParams, DeleteTaskParams,
  CreateCardParams,
  AddLinkParams, SetMoodParams,
  ArchiveDayParams, UnarchiveDayParams,
  // Queries
  DayQueryParams, MonthQueryParams,
} from './schemas'

// ─── State ──────────────────────────────────────────────────────────────────
export { DayState, DayStateInMemory, DayStateLocalStorage, DayStateNotFoundError } from './state'
export type { DayStateShape, DayFilter } from './state'

// ─── Machines ───────────────────────────────────────────────────────────────
export {
  makeDayMachine,
  MachineDayNotFoundError,
  MachineDayArchivedError,
  MachineInvalidTransitionError,
} from './machines'
export type { DayStateNode, DayTransitionAction, DayMachineState } from './machines'
export {
  dayStateGraph,
  isValidDayTransition,
  canActivate, canEnrich, canSimplify, canClear,
  canArchive, canUnarchive, canAddContent,
  ALL_STATES,
} from './machines'

// ─── Services ───────────────────────────────────────────────────────────────
export { ChronicleService } from './services'
export type { ChronicleServiceShape } from './services'

// ─── Atoms ──────────────────────────────────────────────────────────────────
export {
  // Writable state
  selectedDayIdAtom,
  viewingMonthAtom,
  selectedDayAtom,
  monthSummariesAtom,
  chronicleOpenAtom,
  entrancePhaseAtom,
  sidePanelTabAtom,
  dayViewModeAtom,
  bloomOriginAtom,
  // Derived
  hasDaySelectedAtom,
  selectedDayTasksAtom,
  selectedDayEditableAtom,
  monthActiveDayCountAtom,
  todayKeyAtom,
  // Runtime
  chronicleRuntimeAtom,
  // Operations
  loadMonthSummariesFn,
  selectDayFn,
  deselectDayFn,
  addNoteFn,
  addTaskFn,
  toggleTaskFn,
  addCardFn,
  setMoodFn,
  archiveDayFn,
  unarchiveDayFn,
  prevMonthFn,
  nextMonthFn,
  goToTodayFn,
} from './atoms'
