/**
 * MachineState Service
 *
 * Effect.Service for machine asset state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * NOTE: This is for Machine ASSET state, not EquipmentState (operational state).
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import type { MachineId, LineId } from '../schemas/identifiers'
import { Machine, CreateMachineParams, makeMachineId } from '../schemas/assets/machine'
import { HierarchyPath, PathSegment } from '../schemas/hierarchy'
import type { PaginationOptions } from './StateShape'
import { MachineStateNotFoundError } from './StateShape'

// =============================================================================
// Re-export Error
// =============================================================================

export { MachineStateNotFoundError } from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let machineCounter = 0

/** Generate a unique machine ID for in-memory testing */
const generateMachineId = (): MachineId =>
  makeMachineId(`gen-${Date.now()}-${++machineCounter}`)

// =============================================================================
// Filter Interface
// =============================================================================

/** Filter for listing machines */
export interface MachineFilter extends PaginationOptions {
  /** Filter by parent line */
  readonly lineId?: LineId
  /** Filter by status */
  readonly status?: string
  /** Filter by machine type */
  readonly machineType?: string
  /** Filter by work cell (optional parent) */
  readonly workCellId?: string
  /** Filter by plant */
  readonly plantId?: string
}

// =============================================================================
// Shape Interface
// =============================================================================

/**
 * Machine State Service Shape
 *
 * Contract for machine asset state storage. Implementations must provide
 * consistent behavior for CRUD operations.
 */
export interface MachineStateShape {
  /** Create a new machine (ID generated from slug in params) */
  readonly create: (params: CreateMachineParams) => Effect.Effect<Machine>

  /** Get machine by ID */
  readonly get: (id: MachineId) => Effect.Effect<Machine, MachineStateNotFoundError>

  /** Set/update machine state (upsert) - use for updates, not creates */
  readonly set: (machine: Machine) => Effect.Effect<void>

  /** List machines matching filter */
  readonly list: (filter: MachineFilter) => Effect.Effect<readonly Machine[]>

  /** Delete machine by ID */
  readonly delete: (id: MachineId) => Effect.Effect<boolean>

  /** Check if machine exists */
  readonly exists: (id: MachineId) => Effect.Effect<boolean>

  /** Count machines matching filter */
  readonly count: (filter: MachineFilter) => Effect.Effect<number>
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * MachineState Service Tag
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* MachineState
 *   const machine = yield* state.get(machineId)
 * })
 * ```
 */
export class MachineState extends Context.Tag('iiot/MachineState')<
  MachineState,
  MachineStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory machine state implementation for testing.
 *
 * Uses a Map for O(1) lookup. Not suitable for production due to:
 * - No persistence
 * - No cross-process sharing
 * - Memory limits
 */
export const MachineStateInMemory: Layer.Layer<MachineState> = Layer.effect(
  MachineState,
  Ref.make(new Map<MachineId, Machine>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (machine: Machine, filter: MachineFilter): boolean => {
        if (filter.lineId && machine.lineId !== filter.lineId) return false
        if (filter.status && machine.status !== filter.status) return false
        if (filter.machineType && machine.machineType !== filter.machineType) return false
        if (filter.plantId && machine.plantId !== filter.plantId) return false
        if (filter.workCellId) {
          const workCell = Option.getOrNull(machine.workCellId)
          if (workCell !== filter.workCellId) return false
        }
        return true
      }

      return {
        create: (params: CreateMachineParams) =>
          Effect.gen(function* () {
            const id = makeMachineId(params.slug)
            const now = yield* DateTime.now

            // Build hierarchy path from parent IDs
            const segments: PathSegment[] = [
              new PathSegment({ level: 'enterprise', id: params.enterpriseId }),
              new PathSegment({ level: 'site', id: params.siteId }),
              new PathSegment({ level: 'plant', id: params.plantId }),
              new PathSegment({ level: 'line', id: params.lineId }),
            ]

            // Add work cell if present
            if (Option.isSome(params.workCellId)) {
              segments.push(new PathSegment({ level: 'workcell', id: params.workCellId.value }))
            }

            // Add self to path
            segments.push(new PathSegment({ level: 'machine', id }))

            const hierarchyPath = HierarchyPath.fromSegments(segments)

            const machine = new Machine({
              id,
              name: params.name,
              status: params.status ?? 'active',
              description: params.description ?? Option.none(),
              enterpriseId: params.enterpriseId,
              siteId: params.siteId,
              plantId: params.plantId,
              lineId: params.lineId,
              workCellId: params.workCellId ?? Option.none(),
              hierarchyPath,
              machineType: params.machineType,
              manufacturer: params.manufacturer ?? Option.none(),
              modelNumber: params.modelNumber ?? Option.none(),
              serialNumber: params.serialNumber ?? Option.none(),
              installationDate: params.installationDate ?? Option.none(),
              lastMaintenanceDate: Option.none(),
              nextMaintenanceDate: params.nextMaintenanceDate ?? Option.none(),
              location: Option.none(),
              metadata: params.metadata ?? {},
              createdAt: now,
              updatedAt: Option.none(),
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, machine)
              return newMap
            })

            return machine
          }),

        get: (id: MachineId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const machine = map.get(id)
              if (!machine) {
                return Effect.fail(new MachineStateNotFoundError(id))
              }
              return Effect.succeed(machine)
            })
          ),

        set: (machine: Machine) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(machine.id, machine)
            return newMap
          }),

        list: (filter: MachineFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let machines = Array.from(map.values()).filter((m) =>
                matchesFilter(m, filter)
              )

              // Sort by createdAt descending
              machines.sort((a, b) =>
                Number(b.createdAt.epochMillis) - Number(a.createdAt.epochMillis)
              )

              // Apply pagination
              if (filter.offset) {
                machines = machines.slice(filter.offset)
              }
              if (filter.limit) {
                machines = machines.slice(0, filter.limit)
              }

              return machines
            })
          ),

        delete: (id: MachineId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: MachineId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: MachineFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) =>
              Array.from(map.values()).filter((m) => matchesFilter(m, filter)).length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Factory
// =============================================================================

/**
 * Factory to create SQL-backed machine state from a repository.
 *
 * Bridges the state interface to the repository pattern.
 */
export const makeMachineStateSql = (repo: {
  findById: (id: MachineId) => Effect.Effect<Option.Option<Machine>, unknown>
  findAll: (filter: MachineFilter) => Effect.Effect<readonly Machine[], unknown>
  insert: (machine: Machine) => Effect.Effect<Machine, unknown>
  update: (machine: Partial<Machine> & { id: MachineId }) => Effect.Effect<Machine, unknown>
  delete: (id: MachineId) => Effect.Effect<boolean, unknown>
  /** Insert with DB-generated path. If not provided, falls back to insert() */
  insertWithGeneratedId?: (params: CreateMachineParams) => Effect.Effect<Machine, unknown>
}): MachineStateShape => ({
  create: (params: CreateMachineParams) =>
    repo.insertWithGeneratedId
      ? repo.insertWithGeneratedId(params).pipe(Effect.orDie)
      : Effect.gen(function* () {
          // Fallback: generate ID client-side if repo doesn't support generated IDs
          const id = makeMachineId(params.slug)
          const now = yield* DateTime.now

          // Build hierarchy path from parent IDs
          const segments: PathSegment[] = [
            new PathSegment({ type: 'enterprise', id: params.enterpriseId }),
            new PathSegment({ type: 'site', id: params.siteId }),
            new PathSegment({ type: 'plant', id: params.plantId }),
            new PathSegment({ type: 'line', id: params.lineId }),
          ]

          if (Option.isSome(params.workCellId)) {
            segments.push(new PathSegment({ type: 'workcell', id: params.workCellId.value }))
          }

          segments.push(new PathSegment({ type: 'machine', id }))

          const hierarchyPath = HierarchyPath.fromSegments(segments)

          const machine = new Machine({
            id,
            name: params.name,
            status: params.status ?? 'active',
            description: params.description ?? Option.none(),
            enterpriseId: params.enterpriseId,
            siteId: params.siteId,
            plantId: params.plantId,
            lineId: params.lineId,
            workCellId: params.workCellId ?? Option.none(),
            hierarchyPath,
            machineType: params.machineType,
            manufacturer: params.manufacturer ?? Option.none(),
            modelNumber: params.modelNumber ?? Option.none(),
            serialNumber: params.serialNumber ?? Option.none(),
            installationDate: params.installationDate ?? Option.none(),
            lastMaintenanceDate: Option.none(),
            nextMaintenanceDate: params.nextMaintenanceDate ?? Option.none(),
            location: Option.none(),
            metadata: params.metadata ?? {},
            createdAt: now,
            updatedAt: Option.none(),
          })

          return yield* repo.insert(machine).pipe(Effect.orDie)
        }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new MachineStateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new MachineStateNotFoundError(id)))
    ),

  set: (machine) =>
    repo.findById(machine.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(machine as Partial<Machine> & { id: MachineId })
          : repo.insert(machine)
      ),
      Effect.asVoid,
      Effect.catchAll(() => Effect.void)
    ),

  list: (filter) =>
    repo.findAll(filter).pipe(
      Effect.catchAll(() => Effect.succeed([]))
    ),

  delete: (id) =>
    repo.delete(id).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    ),

  exists: (id) =>
    repo.findById(id).pipe(
      Effect.map(Option.isSome),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  count: (filter) =>
    repo.findAll({ ...filter, limit: undefined, offset: undefined }).pipe(
      Effect.map((machines) => machines.length),
      Effect.catchAll(() => Effect.succeed(0))
    ),
})
