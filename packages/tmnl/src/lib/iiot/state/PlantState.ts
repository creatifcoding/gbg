/**
 * PlantState Service
 *
 * Effect.Service for plant state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * Plants are ISA-95 Level 3 (Site) entities representing manufacturing facilities.
 * Parent: Area or Site (areaId optional, siteId required via hierarchyPath)
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import type { PlantId, SiteId, AreaId } from '../schemas/identifiers'
import { Plant, CreatePlantParams, makePlantId } from '../schemas/assets/plant'
import { HierarchyPath, PathSegment } from '../schemas/hierarchy'
import type { PaginationOptions, TimeRangeFilter } from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let plantCounter = 0

/** Generate a unique plant ID for in-memory testing */
const generatePlantId = (): PlantId =>
  `PLT-gen-${Date.now()}-${++plantCounter}` as PlantId

// =============================================================================
// Filter Types
// =============================================================================

/** Filter for listing plants */
export interface PlantFilter extends PaginationOptions, TimeRangeFilter {
  /** Filter by parent site ID */
  readonly siteId?: SiteId
  /** Filter by parent area ID */
  readonly areaId?: AreaId
  /** Filter by operational status */
  readonly status?: string
  /** Filter by timezone */
  readonly timezone?: string
}

// =============================================================================
// Error Types
// =============================================================================

/** Plant state not found error */
export class PlantStateNotFoundError {
  readonly _tag = 'PlantStateNotFoundError'
  constructor(readonly plantId: PlantId) {}
}

// =============================================================================
// Service Shape
// =============================================================================

/**
 * PlantState Service Shape
 *
 * Contract for plant state storage. Implementations must provide
 * consistent behavior for create/get/set/list/delete operations.
 */
export interface PlantStateShape {
  /** Create a new plant (ID generated from params.slug) */
  readonly create: (params: CreatePlantParams) => Effect.Effect<Plant>

  /** Get plant by ID */
  readonly get: (id: PlantId) => Effect.Effect<Plant, PlantStateNotFoundError>

  /** Set/update plant state (upsert) - use for updates, not creates */
  readonly set: (plant: Plant) => Effect.Effect<void>

  /** List plants matching filter */
  readonly list: (filter: PlantFilter) => Effect.Effect<readonly Plant[]>

  /** Delete plant by ID */
  readonly delete: (id: PlantId) => Effect.Effect<boolean>

  /** Check if plant exists */
  readonly exists: (id: PlantId) => Effect.Effect<boolean>

  /** Count plants matching filter */
  readonly count: (filter: PlantFilter) => Effect.Effect<number>
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * PlantState Service Tag
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* PlantState
 *   const plant = yield* state.get(plantId)
 * })
 * ```
 */
export class PlantState extends Context.Tag('iiot/PlantState')<
  PlantState,
  PlantStateShape
>() {}

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory plant state implementation for testing.
 *
 * Uses a Map for O(1) lookup. Not suitable for production due to:
 * - No persistence
 * - No cross-process sharing
 * - Memory limits
 */
export const PlantStateInMemory: Layer.Layer<PlantState> = Layer.effect(
  PlantState,
  Ref.make(new Map<PlantId, Plant>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (plant: Plant, filter: PlantFilter): boolean => {
        // Filter by siteId (from hierarchyPath)
        if (filter.siteId) {
          const siteSeg = plant.hierarchyPath.getAncestorAtLevel('site')
          if (!siteSeg || siteSeg.id !== filter.siteId) return false
        }

        // Filter by areaId (from hierarchyPath)
        if (filter.areaId) {
          const areaSeg = plant.hierarchyPath.getAncestorAtLevel('area')
          if (!areaSeg || areaSeg.id !== filter.areaId) return false
        }

        // Filter by status
        if (filter.status && plant.status !== filter.status) return false

        // Filter by timezone
        if (filter.timezone && plant.timezone !== filter.timezone) return false

        // Time range filters on createdAt
        if (filter.since) {
          const sinceMs = filter.since.getTime()
          const plantMs = Number(plant.createdAt.epochMillis)
          if (plantMs < sinceMs) return false
        }
        if (filter.until) {
          const untilMs = filter.until.getTime()
          const plantMs = Number(plant.createdAt.epochMillis)
          if (plantMs > untilMs) return false
        }

        return true
      }

      return {
        create: (params: CreatePlantParams) =>
          Effect.gen(function* () {
            const id = makePlantId(params.slug)
            const now = yield* DateTime.now

            // Build hierarchy path (simplified for in-memory - assumes root enterprise)
            const hierarchyPath = HierarchyPath.fromSegments([
              new PathSegment({
                level: 'enterprise',
                id: 'ENT-default',
                name: Option.none(),
              }),
              new PathSegment({
                level: 'site',
                id: 'SIT-default',
                name: Option.none(),
              }),
              new PathSegment({
                level: 'plant',
                id,
                name: Option.some(params.name),
              }),
            ])

            const plant = new Plant({
              id,
              name: params.name,
              status: Option.isSome(params.status) ? params.status.value : 'commissioning',
              timezone: params.timezone,
              siteCode: params.siteCode,
              description: params.description,
              location: params.location,
              metadata: Option.isSome(params.metadata) ? params.metadata.value : {},
              hierarchyPath,
              createdAt: now,
              updatedAt: Option.none(),
              enterpriseId: Option.some('ENT-default' as any),
              siteId: Option.some('SIT-default' as any),
              areaId: Option.none(),
              plantId: Option.none(),
              lineId: Option.none(),
              workCellId: Option.none(),
              machineId: Option.none(),
            })

            yield* Ref.update(store, (map) => {
              const newMap = new Map(map)
              newMap.set(id, plant)
              return newMap
            })

            return plant
          }),

        get: (id: PlantId) =>
          Ref.get(store).pipe(
            Effect.flatMap((map) => {
              const plant = map.get(id)
              if (!plant) {
                return Effect.fail(new PlantStateNotFoundError(id))
              }
              return Effect.succeed(plant)
            })
          ),

        set: (plant: Plant) =>
          Ref.update(store, (map) => {
            const newMap = new Map(map)
            newMap.set(plant.id, plant)
            return newMap
          }),

        list: (filter: PlantFilter) =>
          Ref.get(store).pipe(
            Effect.map((map) => {
              let plants = Array.from(map.values()).filter((p) =>
                matchesFilter(p, filter)
              )

              // Sort by createdAt descending
              plants.sort(
                (a, b) =>
                  Number(b.createdAt.epochMillis) - Number(a.createdAt.epochMillis)
              )

              // Apply pagination
              if (filter.offset) {
                plants = plants.slice(filter.offset)
              }
              if (filter.limit) {
                plants = plants.slice(0, filter.limit)
              }

              return plants
            })
          ),

        delete: (id: PlantId) =>
          Ref.modify(store, (map) => {
            const existed = map.has(id)
            if (existed) {
              const newMap = new Map(map)
              newMap.delete(id)
              return [true, newMap] as const
            }
            return [false, map] as const
          }),

        exists: (id: PlantId) =>
          Ref.get(store).pipe(Effect.map((map) => map.has(id))),

        count: (filter: PlantFilter) =>
          Ref.get(store).pipe(
            Effect.map(
              (map) =>
                Array.from(map.values()).filter((p) => matchesFilter(p, filter))
                  .length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Implementation Factory
// =============================================================================

/**
 * SQL-backed plant state implementation for production.
 *
 * Uses a repository pattern for actual SQL operations.
 * This factory bridges the state interface to the repository pattern.
 */
export const makePlantStateSql = (repo: {
  findById: (id: PlantId) => Effect.Effect<Option.Option<Plant>, unknown>
  findAll: (filter: PlantFilter) => Effect.Effect<readonly Plant[], unknown>
  insert: (plant: Plant) => Effect.Effect<Plant, unknown>
  update: (plant: Partial<Plant> & { id: PlantId }) => Effect.Effect<Plant, unknown>
  delete: (id: PlantId) => Effect.Effect<boolean, unknown>
  /** Insert with DB-generated ID. If not provided, falls back to insert() */
  insertWithGeneratedId?: (params: CreatePlantParams) => Effect.Effect<Plant, unknown>
}): PlantStateShape => ({
  create: (params: CreatePlantParams) =>
    repo.insertWithGeneratedId
      ? repo.insertWithGeneratedId(params).pipe(
          Effect.orDie // SQL failures are defects
        )
      : Effect.gen(function* () {
          // Fallback: generate ID client-side if repo doesn't support generated IDs
          const id = makePlantId(params.slug)
          const now = yield* DateTime.now

          // Build minimal hierarchy path
          const hierarchyPath = HierarchyPath.fromSegments([
            new PathSegment({
              level: 'enterprise',
              id: 'ENT-default',
              name: Option.none(),
            }),
            new PathSegment({
              level: 'site',
              id: 'SIT-default',
              name: Option.none(),
            }),
            new PathSegment({
              level: 'plant',
              id,
              name: Option.some(params.name),
            }),
          ])

          const plant = new Plant({
            id,
            name: params.name,
            status: Option.isSome(params.status) ? params.status.value : 'commissioning',
            timezone: params.timezone,
            siteCode: params.siteCode,
            description: params.description,
            location: params.location,
            metadata: Option.isSome(params.metadata) ? params.metadata.value : {},
            hierarchyPath,
            createdAt: now,
            updatedAt: Option.none(),
            enterpriseId: Option.some('ENT-default' as any),
            siteId: Option.some('SIT-default' as any),
            areaId: Option.none(),
            plantId: Option.none(),
            lineId: Option.none(),
            workCellId: Option.none(),
            machineId: Option.none(),
          })

          return yield* repo.insert(plant).pipe(Effect.orDie)
        }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new PlantStateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new PlantStateNotFoundError(id)))
    ),

  set: (plant) =>
    repo.findById(plant.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(plant as Partial<Plant> & { id: PlantId })
          : repo.insert(plant)
      ),
      Effect.asVoid,
      Effect.catchAll(() => Effect.void)
    ),

  list: (filter) =>
    repo.findAll(filter).pipe(Effect.catchAll(() => Effect.succeed([]))),

  delete: (id) =>
    repo.delete(id).pipe(Effect.catchAll(() => Effect.succeed(false))),

  exists: (id) =>
    repo.findById(id).pipe(
      Effect.map(Option.isSome),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  count: (filter) =>
    repo.findAll({ ...filter, limit: undefined, offset: undefined }).pipe(
      Effect.map((plants) => plants.length),
      Effect.catchAll(() => Effect.succeed(0))
    ),
})
