/**
 * TimeEntryState Service
 *
 * Append-only record store. No lifecycle, no graph.
 * Supports aggregation queries for EVM rollup.
 *
 * @module sios/state/TimeEntryState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { TimeEntry, CreateTimeEntryParams, type ShiftPattern } from '../schemas/time-entry'
import type { TimeEntryId, TaskId, WorkPackageId, WorkerId } from '../schemas/identifiers'

// =============================================================================
// ID Generation
// =============================================================================

let teCounter = 0
const generateTimeEntryId = (): TimeEntryId =>
  `TE-${Date.now().toString(36)}-${++teCounter}` as TimeEntryId

// =============================================================================
// Filter Types
// =============================================================================

export interface TimeEntryFilter {
  readonly taskId?: TaskId
  readonly workPackageId?: WorkPackageId
  readonly workerId?: WorkerId
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Aggregation Result
// =============================================================================

export interface TimeEntryAggregate {
  readonly totalHours: number
  readonly totalCost: number
  readonly entryCount: number
}

// =============================================================================
// Errors
// =============================================================================

export class TimeEntryStateNotFoundError {
  readonly _tag = 'TimeEntryStateNotFoundError'
  constructor(readonly timeEntryId: TimeEntryId) {}
}

// =============================================================================
// Service Shape
// =============================================================================

export interface TimeEntryStateShape {
  readonly create: (params: CreateTimeEntryParams) => Effect.Effect<TimeEntry>
  readonly get: (id: TimeEntryId) => Effect.Effect<TimeEntry, TimeEntryStateNotFoundError>
  readonly list: (filter: TimeEntryFilter) => Effect.Effect<readonly TimeEntry[]>
  readonly delete: (id: TimeEntryId) => Effect.Effect<boolean>
  /** Sum hours and cost for a work package — feeds EVM actual cost */
  readonly aggregateByWorkPackage: (wpId: WorkPackageId) => Effect.Effect<TimeEntryAggregate>
  /** Sum hours and cost for a task */
  readonly aggregateByTask: (taskId: TaskId) => Effect.Effect<TimeEntryAggregate>
}

// =============================================================================
// Service Tag
// =============================================================================

export class TimeEntryState extends Context.Tag('sios/TimeEntryState')<
  TimeEntryState,
  TimeEntryStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

export const TimeEntryStateInMemory: Layer.Layer<TimeEntryState> = Layer.effect(
  TimeEntryState,
  Ref.make(new Map<TimeEntryId, TimeEntry>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (te: TimeEntry, filter: TimeEntryFilter): boolean => {
        if (filter.taskId && te.taskId !== filter.taskId) return false
        if (filter.workPackageId && te.workPackageId !== filter.workPackageId) return false
        if (filter.workerId && te.workerId !== filter.workerId) return false
        return true
      }

      const aggregate = (entries: readonly TimeEntry[]): TimeEntryAggregate => ({
        totalHours: entries.reduce((sum, te) => sum + te.hours, 0),
        totalCost: entries.reduce((sum, te) =>
          sum + (te.cost._tag === 'Some' ? te.cost.value : 0), 0
        ),
        entryCount: entries.length,
      })

      return {
        create: (params: CreateTimeEntryParams) =>
          Effect.gen(function* () {
            const id = generateTimeEntryId()
            const now = yield* DateTime.now

            const te = new TimeEntry({
              id,
              taskId: params.taskId,
              workPackageId: params.workPackageId,
              workerId: params.workerId,
              hours: params.hours,
              cost: params.cost !== undefined
                ? Option.some(params.cost)
                : Option.none(),
              workDate: params.workDate,
              shiftPattern: params.shiftPattern
                ? Option.some(params.shiftPattern)
                : Option.none(),
              costCode: params.costCode
                ? Option.some(params.costCode)
                : Option.none(),
              notes: params.notes
                ? Option.some(params.notes)
                : Option.none(),
              createdAt: now,
              updatedAt: Option.none(),
              metadata: {},
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, te)
              return newMap
            })

            return te
          }),

        get: (id: TimeEntryId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const te = map.get(id)
              if (!te) return Effect.fail(new TimeEntryStateNotFoundError(id))
              return Effect.succeed(te)
            })
          ),

        list: (filter: TimeEntryFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let results = Array.from(map.values()).filter((te) =>
                matchesFilter(te, filter)
              )
              if (filter.offset) results = results.slice(filter.offset)
              if (filter.limit) results = results.slice(0, filter.limit)
              return results
            })
          ),

        delete: (id: TimeEntryId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        aggregateByWorkPackage: (wpId: WorkPackageId) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              const entries = Array.from(map.values()).filter((te) =>
                te.workPackageId === wpId
              )
              return aggregate(entries)
            })
          ),

        aggregateByTask: (taskId: TaskId) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              const entries = Array.from(map.values()).filter((te) =>
                te.taskId === taskId
              )
              return aggregate(entries)
            })
          ),
      } satisfies TimeEntryStateShape
    })
  )
)
