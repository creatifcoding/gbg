/**
 * DayMachine — Effect Machine for Day Lifecycle
 *
 * Internal actor-style state machine that wraps DayState service.
 * Validates state transitions via the day-state-graph and handles
 * auto-transitions (empty→active, active→rich) based on content.
 *
 * Architecture:
 * ```
 * ChronicleService
 *   └─▶ Machine.boot(DayMachine)
 *         └─▶ actor.send(InternalAddNote)
 *               └─▶ Machine.procedures.add() handler
 *                     └─▶ state.getOrCreate / state.set
 *                     └─▶ auto-transition lifecycle state
 * ```
 *
 * @module @chronicle/machines/DayMachine
 * @see src/lib/iiot/machines/AlarmMachine.ts — canonical pattern
 */

import { Schema, Effect, Option, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { DayStateShape } from '../state/StateShape'
import type { DayId } from '../schemas/identifiers'
import type { NoteId, DayTaskId, CardId, LinkId } from '../schemas/identifiers'
import {
  Day,
  DayNote,
  DayCard,
  DayTask,
  KnowledgeLink,
  DayMood,
  DayLifecycleState,
} from '../schemas/day'
import type { CreateNoteParams } from '../schemas/commands'
import type { CreateTaskParams } from '../schemas/commands'
import type { CreateCardParams } from '../schemas/commands'
import type { AddLinkParams } from '../schemas/commands'
import type { SetMoodParams } from '../schemas/commands'
import type { ToggleTaskParams } from '../schemas/commands'
import type { ArchiveDayParams } from '../schemas/commands'
import type { UnarchiveDayParams } from '../schemas/commands'
import { canAddContent, canArchive, canUnarchive, type DayStateNode } from './graphs/day-state-graph'

// =============================================================================
// Machine Errors
// =============================================================================

export class MachineDayNotFoundError extends Schema.TaggedError<MachineDayNotFoundError>()(
  'MachineDayNotFoundError',
  { dayId: Schema.String },
) {}

export class MachineDayArchivedError extends Schema.TaggedError<MachineDayArchivedError>()(
  'MachineDayArchivedError',
  { dayId: Schema.String, message: Schema.String },
) {}

export class MachineInvalidTransitionError extends Schema.TaggedError<MachineInvalidTransitionError>()(
  'MachineInvalidTransitionError',
  {
    dayId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  },
) {}

// =============================================================================
// Internal Requests
// =============================================================================

export class InternalGetDay extends Schema.TaggedRequest<InternalGetDay>()(
  'InternalGetDay',
  {
    failure: MachineDayNotFoundError,
    success: Day,
    payload: { dayId: Schema.String },
  },
) {}

export class InternalAddNote extends Schema.TaggedRequest<InternalAddNote>()(
  'InternalAddNote',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      content: Schema.String,
      tags: Schema.Array(Schema.String),
      pinned: Schema.Boolean,
    },
  },
) {}

export class InternalAddTask extends Schema.TaggedRequest<InternalAddTask>()(
  'InternalAddTask',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      title: Schema.String,
      priority: Schema.String,
      dueTime: Schema.NullOr(Schema.String),
    },
  },
) {}

export class InternalAddCard extends Schema.TaggedRequest<InternalAddCard>()(
  'InternalAddCard',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      title: Schema.String,
      content: Schema.String,
    },
  },
) {}

export class InternalToggleTask extends Schema.TaggedRequest<InternalToggleTask>()(
  'InternalToggleTask',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      taskId: Schema.String,
    },
  },
) {}

export class InternalSetMood extends Schema.TaggedRequest<InternalSetMood>()(
  'InternalSetMood',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      sentiment: Schema.String,
      energy: Schema.String,
      focus: Schema.String,
      tags: Schema.Array(Schema.String),
      note: Schema.NullOr(Schema.String),
    },
  },
) {}

export class InternalAddLink extends Schema.TaggedRequest<InternalAddLink>()(
  'InternalAddLink',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineDayArchivedError),
    success: Day,
    payload: {
      dayId: Schema.String,
      sourceId: Schema.String,
      sourceType: Schema.String,
      targetId: Schema.String,
      targetType: Schema.String,
      relationship: Schema.String,
      discoverer: Schema.String,
      confidence: Schema.Number,
    },
  },
) {}

export class InternalArchiveDay extends Schema.TaggedRequest<InternalArchiveDay>()(
  'InternalArchiveDay',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineInvalidTransitionError),
    success: Day,
    payload: { dayId: Schema.String },
  },
) {}

export class InternalUnarchiveDay extends Schema.TaggedRequest<InternalUnarchiveDay>()(
  'InternalUnarchiveDay',
  {
    failure: Schema.Union(MachineDayNotFoundError, MachineInvalidTransitionError),
    success: Day,
    payload: { dayId: Schema.String },
  },
) {}

// =============================================================================
// Machine State
// =============================================================================

export interface DayMachineState {
  readonly mode: DayStateNode
}

// =============================================================================
// Dependencies
// =============================================================================

export interface DayMachineDeps {
  readonly state: DayStateShape
}

// =============================================================================
// ID Generation
// =============================================================================

let counter = 0
const genId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`

// =============================================================================
// Auto-Transition Logic
// =============================================================================

/**
 * Compute the correct lifecycle state based on day content.
 * If the current state is 'archived', don't change it.
 */
const computeLifecycleState = (day: Day): DayLifecycleState => {
  if (day.lifecycleState === ('archived' as DayLifecycleState)) {
    return 'archived' as DayLifecycleState
  }
  if (day.isEmpty) return 'empty' as DayLifecycleState
  return day.contentTypeCount >= 2
    ? ('rich' as DayLifecycleState)
    : ('active' as DayLifecycleState)
}

/** Update a day with auto-transitioned lifecycle state */
const withAutoTransition = (day: Day): Day => {
  const newState = computeLifecycleState(day)
  if (day.lifecycleState === newState) return day
  return new Day({ ...day, lifecycleState: newState, updatedAt: new Date() })
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a DayMachine with injected dependencies.
 *
 * @param deps - Injected state service
 * @returns Effect Machine that can be booted
 *
 * @example
 * ```typescript
 * const state = yield* DayState
 * const machine = makeDayMachine({ state })
 * const actor = yield* Machine.boot(machine)
 * const day = yield* actor.send(new InternalAddNote({ dayId: '2026-01-15', ... }))
 * ```
 */
export const makeDayMachine = (deps: DayMachineDeps) =>
  Machine.make(
    (_input: void, previous?: DayMachineState) =>
      Effect.gen(function* () {
        const { state } = deps
        const initial: DayMachineState = previous ?? { mode: 'empty' }

        return pipe(
          Machine.procedures.make(initial),

          // ─── GET ──────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetDay>()(
            'InternalGetDay',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)
                return [day, { mode: day.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── ADD NOTE ─────────────────────────────────────────────────────
          Machine.procedures.add<InternalAddNote>()(
            'InternalAddNote',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot add note to archived day '${request.dayId}'`,
                    }),
                  )
                }

                const now = new Date()
                const note = new DayNote({
                  id: genId('note') as NoteId,
                  content: request.content,
                  tags: request.tags,
                  pinned: request.pinned,
                  createdAt: now,
                  updatedAt: now,
                })

                const updated = withAutoTransition(
                  new Day({
                    ...day,
                    notes: [...day.notes, note],
                    updatedAt: now,
                  }),
                )

                yield* state.set(updated)
                yield* Effect.logInfo(`[DayMachine] Note added to ${request.dayId}`)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── ADD TASK ─────────────────────────────────────────────────────
          Machine.procedures.add<InternalAddTask>()(
            'InternalAddTask',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot add task to archived day '${request.dayId}'`,
                    }),
                  )
                }

                const now = new Date()
                const task = new DayTask({
                  id: genId('task') as DayTaskId,
                  title: request.title,
                  completed: false,
                  priority: request.priority as any,
                  dueTime: request.dueTime ? Option.some(request.dueTime) : Option.none(),
                  piTaskId: Option.none(),
                  createdAt: now,
                })

                const updated = withAutoTransition(
                  new Day({
                    ...day,
                    tasks: [...day.tasks, task],
                    updatedAt: now,
                  }),
                )

                yield* state.set(updated)
                yield* Effect.logInfo(`[DayMachine] Task added to ${request.dayId}`)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── ADD CARD ─────────────────────────────────────────────────────
          Machine.procedures.add<InternalAddCard>()(
            'InternalAddCard',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot add card to archived day '${request.dayId}'`,
                    }),
                  )
                }

                const now = new Date()
                const card = new DayCard({
                  id: genId('card') as CardId,
                  cardId: genId('morph'),
                  title: request.title,
                  content: request.content,
                  position: { x: 0, y: 0 },
                  createdAt: now,
                })

                const updated = withAutoTransition(
                  new Day({
                    ...day,
                    cards: [...day.cards, card],
                    updatedAt: now,
                  }),
                )

                yield* state.set(updated)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── TOGGLE TASK ──────────────────────────────────────────────────
          Machine.procedures.add<InternalToggleTask>()(
            'InternalToggleTask',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot toggle task on archived day '${request.dayId}'`,
                    }),
                  )
                }

                const tasks = day.tasks.map((t) =>
                  t.id === request.taskId
                    ? new DayTask({ ...t, completed: !t.completed })
                    : t,
                )

                const updated = new Day({ ...day, tasks, updatedAt: new Date() })
                yield* state.set(updated)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── SET MOOD ─────────────────────────────────────────────────────
          Machine.procedures.add<InternalSetMood>()(
            'InternalSetMood',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot set mood on archived day '${request.dayId}'`,
                    }),
                  )
                }

                const mood = new DayMood({
                  energy: request.energy as any,
                  focus: request.focus as any,
                  sentiment: request.sentiment as any,
                  tags: request.tags,
                  note: request.note ? Option.some(request.note) : Option.none(),
                })

                const updated = withAutoTransition(
                  new Day({
                    ...day,
                    mood: Option.some(mood),
                    updatedAt: new Date(),
                  }),
                )

                yield* state.set(updated)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── ADD LINK ─────────────────────────────────────────────────────
          Machine.procedures.add<InternalAddLink>()(
            'InternalAddLink',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)

                if (!canAddContent(day.lifecycleState as DayStateNode)) {
                  return yield* Effect.fail(
                    new MachineDayArchivedError({
                      dayId: request.dayId,
                      message: `Cannot add link to archived day '${request.dayId}'`,
                    }),
                  )
                }

                const link = new KnowledgeLink({
                  id: genId('link') as LinkId,
                  sourceId: request.sourceId,
                  sourceType: request.sourceType as any,
                  targetId: request.targetId,
                  targetType: request.targetType as any,
                  relationship: request.relationship as any,
                  confidence: request.confidence,
                  discoveredBy: request.discoverer as any,
                  createdAt: new Date(),
                })

                const updated = withAutoTransition(
                  new Day({
                    ...day,
                    links: [...day.links, link],
                    updatedAt: new Date(),
                  }),
                )

                yield* state.set(updated)
                return [updated, { mode: updated.lifecycleState as DayStateNode }] as const
              }),
          ),

          // ─── ARCHIVE (graph-validated) ────────────────────────────────────
          Machine.procedures.add<InternalArchiveDay>()(
            'InternalArchiveDay',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)
                const currentState = day.lifecycleState as DayStateNode

                if (!canArchive(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      dayId: request.dayId,
                      fromState: currentState,
                      toState: 'archived',
                      message: `Cannot archive day in state '${currentState}'. Day must be 'active' or 'rich'.`,
                    }),
                  )
                }

                const archived = new Day({
                  ...day,
                  lifecycleState: 'archived' as DayLifecycleState,
                  updatedAt: new Date(),
                })

                yield* state.set(archived)
                yield* Effect.logInfo(`[DayMachine] Day ${request.dayId} archived`)
                return [archived, { mode: 'archived' as DayStateNode }] as const
              }),
          ),

          // ─── UNARCHIVE (graph-validated) ──────────────────────────────────
          Machine.procedures.add<InternalUnarchiveDay>()(
            'InternalUnarchiveDay',
            ({ request }) =>
              Effect.gen(function* () {
                const day = yield* state.getOrCreate(request.dayId as DayId)
                const currentState = day.lifecycleState as DayStateNode

                if (!canUnarchive(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      dayId: request.dayId,
                      fromState: currentState,
                      toState: 'active',
                      message: `Cannot unarchive day in state '${currentState}'. Day must be 'archived'.`,
                    }),
                  )
                }

                // Restore to computed state based on content
                const restored = new Day({
                  ...day,
                  lifecycleState: day.isEmpty
                    ? ('empty' as DayLifecycleState)
                    : day.contentTypeCount >= 2
                      ? ('rich' as DayLifecycleState)
                      : ('active' as DayLifecycleState),
                  updatedAt: new Date(),
                })

                yield* state.set(restored)
                yield* Effect.logInfo(`[DayMachine] Day ${request.dayId} unarchived → ${restored.lifecycleState}`)
                return [restored, { mode: restored.lifecycleState as DayStateNode }] as const
              }),
          ),
        )
      }),
  )

// =============================================================================
// Type Helpers
// =============================================================================

export type DayMachine = ReturnType<typeof makeDayMachine>
