/**
 * Chronicle Atoms — Atom-as-State Layer
 *
 * Atoms ARE the state. Services mutate atoms directly via FnContext.set().
 * React subscribes via useAtomValue. No Effect.Ref, no useState pollution.
 *
 * Pattern: src/lib/getbyshell/atoms.ts (canonical bar atoms)
 *
 * DECISION: Always use DayStateLocalStorage for persistence.
 * DayStateInMemory only for tests.
 *
 * @module @chronicle/atoms
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Option } from 'effect'
import type { DayId } from '../schemas/identifiers'
import type { Day, DaySummary } from '../schemas/day'
import type { DayLifecycleState } from '../schemas/day'
import { DayState, DayStateLocalStorage } from '../state'
import { ChronicleService } from '../services'
import { ShellLoggerLive } from '@/lib/getbyshell/logging'
import type { ChronicleState } from '../types'

// =============================================================================
// Writable State Atoms (Module-Level Singletons)
// =============================================================================

/** Currently selected day ID (null = no day open) */
export const selectedDayIdAtom = Atom.make<DayId | null>(null)

/** Current month being viewed */
export const viewingMonthAtom = Atom.make<{ year: number; month: number }>({
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
})

/** Full Day entity for the selected day (null when no day selected) */
export const selectedDayAtom = Atom.make<Day | null>(null)

/** Day summaries for the current month grid */
export const monthSummariesAtom = Atom.make<readonly DaySummary[]>([])

/** Whether the Chronicle overlay is open */
export const chronicleOpenAtom = Atom.make<boolean>(false)

/** Entrance animation phase */
export const entrancePhaseAtom = Atom.make<string>('idle')

/** Active side panel tab */
export const sidePanelTabAtom = Atom.make<string>('canvas')

/** Day view mode */
export const dayViewModeAtom = Atom.make<string>('canvas')

/** Bloom origin for entrance animation */
export const bloomOriginAtom = Atom.make<{ x: number; y: number }>({ x: 24, y: 0 })

// =============================================================================
// Derived Atoms
// =============================================================================

/** Is a day currently selected? */
export const hasDaySelectedAtom = Atom.make((get) => get(selectedDayIdAtom) !== null)

/** Task completion for selected day */
export const selectedDayTasksAtom = Atom.make((get) => {
  const day = get(selectedDayAtom)
  if (!day) return null
  return day.taskCompletion
})

/** Is the selected day editable (not archived)? */
export const selectedDayEditableAtom = Atom.make((get) => {
  const day = get(selectedDayAtom)
  if (!day) return false
  return day.isEditable
})

/** Count of days with content in current month */
export const monthActiveDayCountAtom = Atom.make((get) =>
  get(monthSummariesAtom).filter(
    (s) => (s.lifecycleState as string) !== 'empty',
  ).length,
)

/** Today's date key */
export const todayKeyAtom = Atom.make<string>(() => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

// =============================================================================
// Runtime Atom (Effect Services → React Bridge)
// =============================================================================

/**
 * Chronicle runtime — provides DayState (LocalStorage) + ChronicleService.
 *
 * Swap DayStateLocalStorage → DayStateInMemory for testing.
 */
export const chronicleRuntimeAtom = Atom.runtime(
  Layer.mergeAll(DayStateLocalStorage, ChronicleService.Default, ShellLoggerLive),
)

// =============================================================================
// Operations — runtimeAtom.fn<Arg>()((arg, ctx) => Effect.gen(...))
// =============================================================================

/** Load month summaries for the viewed month */
export const loadMonthSummariesFn = chronicleRuntimeAtom.fn<{
  year: number
  month: number
}>()((params, ctx) =>
  Effect.gen(function* () {
    yield* Effect.log(`Loading month summaries: ${params.year}-${params.month + 1}`)
    const svc = yield* ChronicleService
    const summaries = yield* svc.getMonthSummaries(params.year, params.month)
    ctx.set(monthSummariesAtom, summaries)
    ctx.set(viewingMonthAtom, params)
    yield* Effect.log(`Loaded ${summaries.length} summaries`)
  }).pipe(Effect.withSpan('chronicle.loadMonthSummaries')),
)

/** Select a day — loads full Day entity */
export const selectDayFn = chronicleRuntimeAtom.fn<DayId>()((dayId, ctx) =>
  Effect.gen(function* () {
    yield* Effect.log(`Selecting day: ${dayId}`)
    const svc = yield* ChronicleService
    const day = yield* svc.getDay(dayId)
    ctx.set(selectedDayIdAtom, dayId)
    ctx.set(selectedDayAtom, day)
    yield* Effect.log(`Day loaded: lifecycle=${day.lifecycleState}, notes=${day.notes.length}, tasks=${day.tasks.length}`)
  }).pipe(Effect.withSpan('chronicle.selectDay')),
)

/** Deselect day */
export const deselectDayFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    yield* Effect.log('Deselecting day')
    ctx.set(selectedDayIdAtom, null)
    ctx.set(selectedDayAtom, null)
  }).pipe(Effect.withSpan('chronicle.deselectDay')),
)

/** Add a note to the selected day */
export const addNoteFn = chronicleRuntimeAtom.fn<{
  content: string
  tags?: string[]
  pinned?: boolean
}>()((params, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Adding note to ${dayId}: ${params.content.slice(0, 40)}...`)
    const svc = yield* ChronicleService
    const day = yield* svc.addNote({
      dayId,
      content: params.content,
      tags: params.tags ?? [],
      pinned: params.pinned ?? false,
    })
    ctx.set(selectedDayAtom, day)
    const { year, month } = ctx.get(viewingMonthAtom)
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(monthSummariesAtom, summaries)
    yield* Effect.log(`Note added. Day now has ${day.notes.length} notes`)
  }).pipe(Effect.withSpan('chronicle.addNote')),
)

/** Add a task to the selected day */
export const addTaskFn = chronicleRuntimeAtom.fn<{
  title: string
  priority?: string
  dueTime?: string
}>()((params, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Adding task "${params.title}" to ${dayId}`)
    const svc = yield* ChronicleService
    const day = yield* svc.addTask({
      dayId,
      title: params.title,
      priority: (params.priority as any) ?? 'normal',
      dueTime: params.dueTime,
    })
    ctx.set(selectedDayAtom, day)
    const { year, month } = ctx.get(viewingMonthAtom)
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(monthSummariesAtom, summaries)
    yield* Effect.log(`Task added. Day has ${day.tasks.length} tasks`)
  }).pipe(Effect.withSpan('chronicle.addTask')),
)

/** Toggle a task's completion */
export const toggleTaskFn = chronicleRuntimeAtom.fn<{ taskId: string }>()(
  (params, ctx) =>
    Effect.gen(function* () {
      const dayId = ctx.get(selectedDayIdAtom)
      if (!dayId) return
      yield* Effect.log(`Toggling task ${params.taskId} on ${dayId}`)
      const svc = yield* ChronicleService
      const day = yield* svc.toggleTask({
        dayId,
        taskId: params.taskId as any,
      })
      ctx.set(selectedDayAtom, day)
      const { year, month } = ctx.get(viewingMonthAtom)
      const summaries = yield* svc.getMonthSummaries(year, month)
      ctx.set(monthSummariesAtom, summaries)
      const task = day.tasks.find((t) => String(t.id) === params.taskId)
      yield* Effect.log(`Task toggled: completed=${task?.completed ?? '?'}`)
    }).pipe(Effect.withSpan('chronicle.toggleTask')),
)

/** Add a morph card to the selected day */
export const addCardFn = chronicleRuntimeAtom.fn<{
  title: string
  content?: string
}>()((params, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Adding card "${params.title}" to ${dayId}`)
    const svc = yield* ChronicleService
    const day = yield* svc.addCard({
      dayId,
      title: params.title,
      content: params.content ?? '',
    })
    ctx.set(selectedDayAtom, day)
    const { year, month } = ctx.get(viewingMonthAtom)
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(monthSummariesAtom, summaries)
    yield* Effect.log(`Card added. Day has ${day.cards.length} cards`)
  }).pipe(Effect.withSpan('chronicle.addCard')),
)

/** Set mood on the selected day */
export const setMoodFn = chronicleRuntimeAtom.fn<{
  sentiment: string
  energy: string
  focus?: string
  tags?: string[]
  note?: string
}>()((params, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Setting mood on ${dayId}: ${params.sentiment}/${params.energy}`)
    const svc = yield* ChronicleService
    const day = yield* svc.setMood({
      dayId,
      sentiment: params.sentiment as any,
      energy: params.energy as any,
      focus: (params.focus as any) ?? 'medium',
      tags: params.tags ?? [],
      note: params.note,
    })
    ctx.set(selectedDayAtom, day)
    yield* Effect.log('Mood set')
  }).pipe(Effect.withSpan('chronicle.setMood')),
)

/** Archive the selected day (graph-validated) */
export const archiveDayFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Archiving day ${dayId}`)
    const svc = yield* ChronicleService
    const day = yield* svc.archiveDay({ dayId })
    ctx.set(selectedDayAtom, day)
    const { year, month } = ctx.get(viewingMonthAtom)
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(monthSummariesAtom, summaries)
    yield* Effect.log(`Day archived: lifecycle=${day.lifecycleState}`)
  }).pipe(Effect.withSpan('chronicle.archiveDay')),
)

/** Unarchive the selected day (graph-validated) */
export const unarchiveDayFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const dayId = ctx.get(selectedDayIdAtom)
    if (!dayId) return
    yield* Effect.log(`Unarchiving day ${dayId}`)
    const svc = yield* ChronicleService
    const day = yield* svc.unarchiveDay({ dayId })
    ctx.set(selectedDayAtom, day)
    const { year, month } = ctx.get(viewingMonthAtom)
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(monthSummariesAtom, summaries)
    yield* Effect.log(`Day unarchived: lifecycle=${day.lifecycleState}`)
  }).pipe(Effect.withSpan('chronicle.unarchiveDay')),
)

// =============================================================================
// Navigation Operations
// =============================================================================

/** Navigate to previous month */
export const prevMonthFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const { year, month } = ctx.get(viewingMonthAtom)
    const newMonth = month === 0 ? 11 : month - 1
    const newYear = month === 0 ? year - 1 : year
    yield* Effect.log(`Navigate prev: ${year}-${month + 1} → ${newYear}-${newMonth + 1}`)
    const svc = yield* ChronicleService
    const summaries = yield* svc.getMonthSummaries(newYear, newMonth)
    ctx.set(viewingMonthAtom, { year: newYear, month: newMonth })
    ctx.set(monthSummariesAtom, summaries)
  }).pipe(Effect.withSpan('chronicle.prevMonth')),
)

/** Navigate to next month */
export const nextMonthFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const { year, month } = ctx.get(viewingMonthAtom)
    const newMonth = month === 11 ? 0 : month + 1
    const newYear = month === 11 ? year + 1 : year
    yield* Effect.log(`Navigate next: ${year}-${month + 1} → ${newYear}-${newMonth + 1}`)
    const svc = yield* ChronicleService
    const summaries = yield* svc.getMonthSummaries(newYear, newMonth)
    ctx.set(viewingMonthAtom, { year: newYear, month: newMonth })
    ctx.set(monthSummariesAtom, summaries)
  }).pipe(Effect.withSpan('chronicle.nextMonth')),
)

/** Navigate to today */
export const goToTodayFn = chronicleRuntimeAtom.fn<void>()((_void, ctx) =>
  Effect.gen(function* () {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    yield* Effect.log(`Navigate to today: ${year}-${month + 1}`)
    const svc = yield* ChronicleService
    const summaries = yield* svc.getMonthSummaries(year, month)
    ctx.set(viewingMonthAtom, { year, month })
    ctx.set(monthSummariesAtom, summaries)
  }).pipe(Effect.withSpan('chronicle.goToToday')),
)
