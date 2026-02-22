/**
 * ChronicleService — High-Level Day Orchestration
 *
 * Boots a DayMachine and exposes typed operations.
 * Replaces the Entity+RPC layer from IIoT with a simpler
 * local-first service that delegates to the Machine.
 *
 * @module @chronicle/services/ChronicleService
 * @see src/lib/iiot/entity/AlarmEntity.ts — AlarmEntityHandlers pattern
 */

import { Effect, Context, Layer, Scope } from 'effect'
import { Machine } from '@effect/experimental'
import type { DayId } from '../schemas/identifiers'
import type { Day, DaySummary } from '../schemas/day'
import type {
  CreateNoteParams,
  CreateTaskParams,
  CreateCardParams,
  ToggleTaskParams,
  SetMoodParams,
  AddLinkParams,
  ArchiveDayParams,
  UnarchiveDayParams,
} from '../schemas/commands'
import { DayState } from '../state/DayState'
import type { DayStateNotFoundError } from '../state/StateShape'
import {
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
  type MachineDayNotFoundError,
  type MachineDayArchivedError,
  type MachineInvalidTransitionError,
} from '../machines/DayMachine'

// =============================================================================
// Service Shape
// =============================================================================

export interface ChronicleServiceShape {
  /** Get a day (always succeeds — creates empty if not found) */
  readonly getDay: (
    dayId: DayId,
  ) => Effect.Effect<Day, MachineDayNotFoundError>

  /** Add a note to a day */
  readonly addNote: (
    params: CreateNoteParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Add a task to a day */
  readonly addTask: (
    params: CreateTaskParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Add a morph card to a day */
  readonly addCard: (
    params: CreateCardParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Toggle a task's completion status */
  readonly toggleTask: (
    params: ToggleTaskParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Set mood/status for a day */
  readonly setMood: (
    params: SetMoodParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Add a knowledge link to a day */
  readonly addLink: (
    params: AddLinkParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineDayArchivedError>

  /** Archive a day (graph-validated) */
  readonly archiveDay: (
    params: ArchiveDayParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineInvalidTransitionError>

  /** Unarchive a day (graph-validated) */
  readonly unarchiveDay: (
    params: UnarchiveDayParams,
  ) => Effect.Effect<Day, MachineDayNotFoundError | MachineInvalidTransitionError>

  /** Get month summaries (lightweight, for grid rendering) */
  readonly getMonthSummaries: (
    year: number,
    month: number,
  ) => Effect.Effect<readonly DaySummary[]>
}

// =============================================================================
// Service Tag
// =============================================================================

export class ChronicleService extends Context.Tag('chronicle/ChronicleService')<
  ChronicleService,
  ChronicleServiceShape
>() {
  /**
   * Default layer — boots DayMachine from DayState.
   *
   * Requires: DayState (InMemory or LocalStorage)
   * Requires: Scope (for Machine.boot lifecycle)
   */
  static Default = Layer.scoped(
    ChronicleService,
    Effect.gen(function* () {
      const dayState = yield* DayState
      const machine = makeDayMachine({ state: dayState })
      const actor = yield* Machine.boot(machine)

      return ChronicleService.of({
        getDay: (dayId) =>
          actor.send(new InternalGetDay({ dayId })),

        addNote: (params) =>
          actor.send(
            new InternalAddNote({
              dayId: params.dayId,
              content: params.content,
              tags: params.tags ?? [],
              pinned: params.pinned ?? false,
            }),
          ),

        addTask: (params) =>
          actor.send(
            new InternalAddTask({
              dayId: params.dayId,
              title: params.title,
              priority: params.priority ?? 'normal',
              dueTime: params.dueTime ?? null,
            }),
          ),

        addCard: (params) =>
          actor.send(
            new InternalAddCard({
              dayId: params.dayId,
              title: params.title,
              content: params.content ?? '',
            }),
          ),

        toggleTask: (params) =>
          actor.send(
            new InternalToggleTask({
              dayId: params.dayId,
              taskId: params.taskId,
            }),
          ),

        setMood: (params) =>
          actor.send(
            new InternalSetMood({
              dayId: params.dayId,
              sentiment: params.sentiment,
              energy: params.energy,
              focus: params.focus ?? 'medium',
              tags: params.tags ?? [],
              note: params.note ?? null,
            }),
          ),

        addLink: (params) =>
          actor.send(
            new InternalAddLink({
              dayId: params.dayId,
              sourceId: params.sourceId,
              sourceType: params.sourceType,
              targetId: params.targetId,
              targetType: params.targetType,
              relationship: params.relationship,
              discoverer: params.discoverer ?? 'user',
              confidence: params.confidence ?? 1.0,
            }),
          ),

        archiveDay: (params) =>
          actor.send(new InternalArchiveDay({ dayId: params.dayId })),

        unarchiveDay: (params) =>
          actor.send(new InternalUnarchiveDay({ dayId: params.dayId })),

        getMonthSummaries: (year, month) =>
          dayState.listSummaries(year, month),
      })
    }),
  )
}
