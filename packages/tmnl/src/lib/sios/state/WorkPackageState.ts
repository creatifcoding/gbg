/**
 * WorkPackageState Service
 *
 * Context.Tag service for WorkPackage state management with swappable implementations.
 * Provides in-memory (testing) and SQL adapter (production).
 *
 * Follows the IIoT SiteState.ts pattern exactly:
 *   - Context.Tag for the service
 *   - In-memory impl using Ref<Map> for testing
 *   - SQL adapter factory for production
 *   - Filter type + not-found error
 *
 * @module sios/state/WorkPackageState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import {
  WorkPackage,
  CreateWorkPackageParams,
  type WorkPackageStatus,
  type Discipline,
} from '../schemas/work-package'
import type { WorkPackageId, ZoneId, ProjectId, CrewId } from '../schemas/identifiers'

// =============================================================================
// ID Generation
// =============================================================================

let wpCounter = 0

const generateWorkPackageId = (): WorkPackageId =>
  `WP-${Date.now().toString(36)}-${++wpCounter}` as WorkPackageId

// =============================================================================
// Filter Types
// =============================================================================

export interface WorkPackageFilter {
  readonly projectId?: ProjectId
  readonly zoneId?: ZoneId
  readonly discipline?: Discipline
  readonly status?: WorkPackageStatus
  readonly assignedCrewId?: CrewId
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// Errors
// =============================================================================

export class WorkPackageStateNotFoundError {
  readonly _tag = 'WorkPackageStateNotFoundError'
  constructor(readonly workPackageId: WorkPackageId) {}
}

// =============================================================================
// Service Shape
// =============================================================================

export interface WorkPackageStateShape {
  readonly create: (params: CreateWorkPackageParams) => Effect.Effect<WorkPackage>
  readonly get: (id: WorkPackageId) => Effect.Effect<WorkPackage, WorkPackageStateNotFoundError>
  readonly set: (wp: WorkPackage) => Effect.Effect<void>
  readonly list: (filter: WorkPackageFilter) => Effect.Effect<readonly WorkPackage[]>
  readonly delete: (id: WorkPackageId) => Effect.Effect<boolean>
  readonly exists: (id: WorkPackageId) => Effect.Effect<boolean>
  readonly count: (filter: WorkPackageFilter) => Effect.Effect<number>
}

// =============================================================================
// Service Tag
// =============================================================================

export class WorkPackageState extends Context.Tag('sios/WorkPackageState')<
  WorkPackageState,
  WorkPackageStateShape
>() {}

// =============================================================================
// In-Memory Implementation (for testing)
// =============================================================================

export const WorkPackageStateInMemory: Layer.Layer<WorkPackageState> = Layer.effect(
  WorkPackageState,
  Ref.make(new Map<WorkPackageId, WorkPackage>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (wp: WorkPackage, filter: WorkPackageFilter): boolean => {
        if (filter.projectId && wp.projectId !== filter.projectId) return false
        if (filter.zoneId && wp.zoneId !== filter.zoneId) return false
        if (filter.discipline && wp.discipline !== filter.discipline) return false
        if (filter.status && wp.status !== filter.status) return false
        if (filter.assignedCrewId && !Option.contains(wp.assignedCrewId, filter.assignedCrewId)) return false
        return true
      }

      return {
        create: (params: CreateWorkPackageParams) =>
          Effect.gen(function* () {
            const id = generateWorkPackageId()
            const now = yield* DateTime.now

            const wp = new WorkPackage({
              id,
              zoneId: params.zoneId,
              projectId: params.projectId,
              discipline: params.discipline,
              name: params.name,
              equipmentFamily: params.equipmentFamily
                ? Option.some(params.equipmentFamily)
                : Option.none(),
              status: 'planned',
              progressUnit: params.progressUnit,
              plannedQty: params.plannedQty,
              actualQty: 0,
              budgetedHours: params.budgetedHours,
              budgetedCost: params.budgetedCost,
              actualHours: 0,
              actualCost: 0,
              plannedStart: params.plannedStart
                ? Option.some(params.plannedStart)
                : Option.none(),
              plannedEnd: params.plannedEnd
                ? Option.some(params.plannedEnd)
                : Option.none(),
              actualStart: Option.none(),
              actualEnd: Option.none(),
              assignedCrewId: Option.none(),
              costCode: params.costCode
                ? Option.some(params.costCode)
                : Option.none(),
              createdAt: now,
              updatedAt: Option.none(),
              metadata: {},
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, wp)
              return newMap
            })

            return wp
          }),

        get: (id: WorkPackageId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const wp = map.get(id)
              if (!wp) return Effect.fail(new WorkPackageStateNotFoundError(id))
              return Effect.succeed(wp)
            })
          ),

        set: (wp: WorkPackage) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(wp.id, wp)
            return newMap
          }),

        list: (filter: WorkPackageFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let results = Array.from(map.values()).filter((wp) =>
                matchesFilter(wp, filter)
              )
              // Sort by name
              results.sort((a, b) => a.name.localeCompare(b.name))
              if (filter.offset) results = results.slice(filter.offset)
              if (filter.limit) results = results.slice(0, filter.limit)
              return results
            })
          ),

        delete: (id: WorkPackageId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: WorkPackageId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: WorkPackageFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((wp) => matchesFilter(wp, filter)).length
            )
          ),
      } satisfies WorkPackageStateShape
    })
  )
)
