/**
 * GeoPositionService - Entity Positioning via Kori ECS
 *
 * Effect Service that manages geographically-positioned entities.
 * Integrates Kori ECS with MapProjectionService to maintain
 * screen-space positions synchronized with viewport changes.
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module geoint/positioning/GeoPositionService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Fiber,
  Data,
  pipe,
  Ref,
  Scope,
  Duration,
  PubSub,
  Metric,
  MetricBoundaries,
} from 'effect'
import { KoriWorld, type EntityId, type TraitId } from '@/lib/kori'
import {
  MapProjectionService,
  type GeoCoord,
  type BatchProjectionInput,
} from './MapProjectionService'
import type { GeoPosition, ScreenPosition, NDCPosition, GeoHeading } from './traits'

// =============================================================================
// Types
// =============================================================================

/**
 * Options for spawning a positioned entity.
 */
export interface SpawnPositionedOptions {
  /** Geographic position */
  readonly position: GeoCoord
  /** Optional heading */
  readonly heading?: {
    readonly heading: number
    readonly pitch?: number
    readonly roll?: number
  }
  /** Additional traits to attach */
  readonly additionalTraits?: readonly {
    readonly id: TraitId
    readonly data: unknown
  }[]
  /** Entity ID override (for deterministic IDs) */
  readonly entityId?: string
}

/**
 * Positioned entity with all position-related data.
 */
export interface PositionedEntity {
  readonly entityId: EntityId
  readonly geo: GeoCoord
  readonly screen: { x: number; y: number; z: number }
  readonly ndc: { x: number; y: number; z: number }
  readonly isVisible: boolean
  readonly heading?: number
}

/**
 * Query options for positioned entities.
 */
export interface QueryPositionedOptions {
  /** Only return visible entities */
  readonly visibleOnly?: boolean
  /** Filter by bounding box [minLon, minLat, maxLon, maxLat] */
  readonly bounds?: readonly [number, number, number, number]
  /** Filter by additional trait */
  readonly withTrait?: TraitId
  /** Maximum results */
  readonly limit?: number
}

/**
 * Batch position update input.
 */
export interface BatchPositionUpdate {
  readonly entityId: EntityId
  readonly position: GeoCoord
  readonly heading?: number
}

// =============================================================================
// Errors
// =============================================================================

export class GeoPositionError extends Data.TaggedError('GeoPositionError')<{
  readonly operation: 'spawn' | 'update' | 'query' | 'sync' | 'destroy'
  readonly entityId?: string
  readonly message: string
  readonly cause?: unknown
}> {}

// =============================================================================
// Metrics (Effect-native observability)
// =============================================================================

/**
 * Counter for entity spawn operations.
 * Incremented each time an entity is successfully spawned.
 */
export const entitySpawnCounter = Metric.counter('geoint.entity.spawns', {
  description: 'Total number of positioned entities spawned',
  incremental: true,
})

/**
 * Gauge for current entity count.
 * Updated when entities are spawned or destroyed.
 */
export const entityCountGauge = Metric.gauge('geoint.entity.count', {
  description: 'Current number of positioned entities',
})

/**
 * Histogram for sync projection latency.
 * Tracks the distribution of syncProjections execution time.
 */
export const syncLatencyHistogram = Metric.histogram(
  'geoint.sync.latency_ms',
  MetricBoundaries.exponential({ start: 1, factor: 2, count: 10 }) // 1, 2, 4, 8, 16, 32, 64, 128, 256, 512ms
)

/**
 * Counter for sync operations.
 */
export const syncCounter = Metric.counter('geoint.sync.operations', {
  description: 'Total number of sync projection operations',
  incremental: true,
})

// =============================================================================
// Service Interface
// =============================================================================

export interface GeoPositionServiceOps {
  /**
   * Spawn a new positioned entity.
   * Automatically projects to screen space.
   */
  readonly spawn: (
    options: SpawnPositionedOptions
  ) => Effect.Effect<PositionedEntity, GeoPositionError, Scope.Scope>

  /**
   * Spawn multiple positioned entities in batch.
   */
  readonly spawnBatch: (
    options: readonly SpawnPositionedOptions[]
  ) => Effect.Effect<readonly PositionedEntity[], GeoPositionError, Scope.Scope>

  /**
   * Update an entity's geographic position.
   */
  readonly updatePosition: (
    entityId: EntityId,
    position: GeoCoord
  ) => Effect.Effect<PositionedEntity, GeoPositionError>

  /**
   * Update multiple entity positions in batch.
   */
  readonly updatePositionBatch: (
    updates: readonly BatchPositionUpdate[]
  ) => Effect.Effect<readonly PositionedEntity[], GeoPositionError>

  /**
   * Query positioned entities.
   */
  readonly query: (
    options?: QueryPositionedOptions
  ) => Effect.Effect<readonly PositionedEntity[], GeoPositionError>

  /**
   * Get a single positioned entity by ID.
   */
  readonly get: (entityId: EntityId) => Effect.Effect<PositionedEntity, GeoPositionError>

  /**
   * Destroy a positioned entity.
   */
  readonly destroy: (entityId: EntityId) => Effect.Effect<void, GeoPositionError>

  /**
   * Destroy multiple entities.
   */
  readonly destroyBatch: (
    entityIds: readonly EntityId[]
  ) => Effect.Effect<void, GeoPositionError>

  /**
   * Sync all positioned entities with current viewport.
   * Called automatically on viewport change, but can be triggered manually.
   */
  readonly syncProjections: () => Effect.Effect<number, GeoPositionError>

  /**
   * Start automatic viewport sync.
   * Returns a fiber that can be interrupted to stop.
   */
  readonly startViewportSync: () => Effect.Effect<
    Fiber.RuntimeFiber<void, never>,
    never,
    Scope.Scope
  >

  /**
   * Subscribe to positioned entity changes.
   */
  readonly onChange: () => Effect.Effect<
    Stream.Stream<PositionedEntity>,
    never,
    Scope.Scope
  >

  /**
   * Get statistics about positioned entities.
   */
  readonly getStats: () => Effect.Effect<{
    readonly total: number
    readonly visible: number
    readonly lastSyncMs: number
  }>
}

// =============================================================================
// Service Tag
// =============================================================================

export class GeoPositionService extends Context.Tag('geoint/GeoPositionService')<
  GeoPositionService,
  GeoPositionServiceOps
>() {}

// =============================================================================
// Implementation
// =============================================================================

export const makeGeoPositionService: Effect.Effect<
  GeoPositionServiceOps,
  never,
  KoriWorld | MapProjectionService
> = Effect.gen(function* () {
  const world = yield* KoriWorld
  const projection = yield* MapProjectionService

  // Track positioned entities for fast access
  const positionedEntitiesRef = yield* Ref.make<Set<EntityId>>(new Set())

  // Stats tracking
  const statsRef = yield* Ref.make({
    total: 0,
    visible: 0,
    lastSyncMs: 0,
  })

  // PubSub for entity change notifications (Effect-native pub/sub with backpressure)
  const changePubSub = yield* PubSub.unbounded<PositionedEntity>()

  /**
   * Notify change subscribers via PubSub.
   */
  const notifyChange = (entity: PositionedEntity) =>
    PubSub.publish(changePubSub, entity)

  /**
   * Convert Kori entity to PositionedEntity.
   */
  const toPositionedEntity = (
    entityId: EntityId,
    geoPos: GeoPosition,
    screenPos: ScreenPosition | null,
    ndcPos: NDCPosition | null,
    heading: GeoHeading | null
  ): PositionedEntity => ({
    entityId,
    geo: {
      longitude: geoPos.longitude,
      latitude: geoPos.latitude,
      altitude: geoPos.altitude,
    },
    screen: screenPos
      ? { x: screenPos.x, y: screenPos.y, z: screenPos.z ?? 0 }
      : { x: 0, y: 0, z: 0 },
    ndc: ndcPos
      ? { x: ndcPos.ndcX, y: ndcPos.ndcY, z: ndcPos.ndcZ ?? 0.5 }
      : { x: 0, y: 0, z: 0.5 },
    isVisible: screenPos?.isVisible ?? false,
    heading: heading?.heading,
  })

  /**
   * Project and update screen position traits for an entity.
   */
  const projectEntity = (
    entityId: EntityId,
    geoPos: GeoPosition
  ): Effect.Effect<PositionedEntity, GeoPositionError> =>
    Effect.gen(function* () {
      // Project geographic position
      const projectionResult = yield* pipe(
        projection.project({
          longitude: geoPos.longitude,
          latitude: geoPos.latitude,
          altitude: geoPos.altitude,
        }),
        Effect.mapError(
          (e) =>
            new GeoPositionError({
              operation: 'update',
              entityId: entityId as string,
              message: e.message,
              cause: e,
            })
        )
      )

      // Update ScreenPosition trait
      const screenData: ScreenPosition = {
        _tag: 'ScreenPosition',
        x: projectionResult.screen.x,
        y: projectionResult.screen.y,
        z: projectionResult.screen.z ?? 0,
        isVisible: projectionResult.isVisible,
      }

      // Update NDCPosition trait
      const ndcData: NDCPosition = {
        _tag: 'NDCPosition',
        ndcX: projectionResult.ndc.x,
        ndcY: projectionResult.ndc.y,
        ndcZ: projectionResult.ndc.z ?? 0.5,
      }

      // Parallel trait updates and heading fetch
      const [, , headingResult] = yield* Effect.all(
        [
          pipe(
            world.setTrait(entityId, 'ScreenPosition' as TraitId, screenData),
            Effect.catchAll(() =>
              world.addTrait(entityId, 'ScreenPosition' as TraitId, screenData)
            ),
            Effect.catchAll(() => Effect.void)
          ),
          pipe(
            world.setTrait(entityId, 'NDCPosition' as TraitId, ndcData),
            Effect.catchAll(() =>
              world.addTrait(entityId, 'NDCPosition' as TraitId, ndcData)
            ),
            Effect.catchAll(() => Effect.void)
          ),
          pipe(
            world.getTrait(entityId, 'GeoHeading' as TraitId),
            Effect.map((data) => data as GeoHeading),
            Effect.catchAll(() => Effect.succeed(null))
          ),
        ],
        { concurrency: 'unbounded' }
      )

      return toPositionedEntity(entityId, geoPos, screenData, ndcData, headingResult)
    })

  // =========================================================================
  // Service Methods
  // =========================================================================

  const spawn = (
    options: SpawnPositionedOptions
  ): Effect.Effect<PositionedEntity, GeoPositionError, Scope.Scope> =>
    Effect.withSpan('GeoPositionService.spawn', {
      attributes: {
        'geo.longitude': options.position.longitude,
        'geo.latitude': options.position.latitude,
      },
    })(Effect.gen(function* () {
      // Build traits array
      const traits: { id: TraitId; data: unknown }[] = [
        {
          id: 'GeoPosition' as TraitId,
          data: {
            _tag: 'GeoPosition',
            longitude: options.position.longitude,
            latitude: options.position.latitude,
            altitude: options.position.altitude ?? 0,
            timestamp: new Date(),
          },
        },
        {
          id: 'NeedsProjection' as TraitId,
          data: { _tag: 'NeedsProjection' },
        },
      ]

      // Add heading if provided
      if (options.heading) {
        traits.push({
          id: 'GeoHeading' as TraitId,
          data: {
            _tag: 'GeoHeading',
            heading: options.heading.heading,
            pitch: options.heading.pitch ?? 0,
            roll: options.heading.roll ?? 0,
          },
        })
      }

      // Add additional traits
      if (options.additionalTraits) {
        traits.push(...options.additionalTraits)
      }

      // Use Effect.acquireRelease for automatic entity cleanup when scope closes
      // Acquire: spawn entity and set up tracking
      // Release: destroy entity and clean up tracking when scope finalizes
      const positioned = yield* Effect.acquireRelease(
        // Acquire effect - spawn and initialize
        Effect.gen(function* () {
          // Spawn entity in world
          const entity = yield* pipe(
            world.spawn(traits),
            Effect.mapError(
              (e) =>
                new GeoPositionError({
                  operation: 'spawn',
                  message: `Failed to spawn entity: ${e}`,
                  cause: e,
                })
            )
          )

          // Track as positioned entity
          yield* Ref.update(positionedEntitiesRef, (set) => {
            set.add(entity.id)
            return set
          })

          // Project to screen space
          const geoPos = entity.traits.get('GeoPosition' as TraitId) as GeoPosition
          const projectedEntity = yield* projectEntity(entity.id, geoPos)

          // Update stats
          yield* Ref.update(statsRef, (s) => ({
            ...s,
            total: s.total + 1,
            visible: projectedEntity.isVisible ? s.visible + 1 : s.visible,
          }))

          // Notify subscribers
          yield* notifyChange(projectedEntity)

          // Update metrics
          yield* Metric.increment(entitySpawnCounter)
          const currentStats = yield* Ref.get(statsRef)
          yield* Metric.set(entityCountGauge, currentStats.total)

          return projectedEntity
        }),
        // Release effect - cleanup when scope closes
        (entity) =>
          Effect.gen(function* () {
            // Remove from tracking
            yield* Ref.update(positionedEntitiesRef, (set) => {
              set.delete(entity.entityId)
              return set
            })

            // Destroy in world (ignore errors - entity may already be destroyed)
            yield* pipe(
              world.destroy(entity.entityId),
              Effect.catchAll(() => Effect.void)
            )

            // Update stats
            yield* Ref.update(statsRef, (s) => ({
              ...s,
              total: Math.max(0, s.total - 1),
            }))

            // Update entity count gauge on release
            const currentStats = yield* Ref.get(statsRef)
            yield* Metric.set(entityCountGauge, currentStats.total)
          })
      )

      return positioned
    }))

  const spawnBatch = (
    options: readonly SpawnPositionedOptions[]
  ): Effect.Effect<readonly PositionedEntity[], GeoPositionError, Scope.Scope> =>
    Effect.forEach(options, spawn, { concurrency: 10 })

  const updatePosition = (
    entityId: EntityId,
    position: GeoCoord
  ): Effect.Effect<PositionedEntity, GeoPositionError> =>
    Effect.gen(function* () {
      // Update GeoPosition trait
      const geoData: GeoPosition = {
        _tag: 'GeoPosition',
        longitude: position.longitude,
        latitude: position.latitude,
        altitude: position.altitude ?? 0,
        timestamp: new Date(),
      }

      yield* pipe(
        world.setTrait(entityId, 'GeoPosition' as TraitId, geoData),
        Effect.mapError(
          (e) =>
            new GeoPositionError({
              operation: 'update',
              entityId: entityId as string,
              message: `Failed to update position: ${e}`,
              cause: e,
            })
        )
      )

      // Re-project and notify subscribers (tap for side effect)
      return yield* pipe(
        projectEntity(entityId, geoData),
        Effect.tap(notifyChange)
      )
    })

  const updatePositionBatch = (
    updates: readonly BatchPositionUpdate[]
  ): Effect.Effect<readonly PositionedEntity[], GeoPositionError> =>
    Effect.forEach(
      updates,
      (update) =>
        Effect.gen(function* () {
          // Update GeoPosition
          const geoData: GeoPosition = {
            _tag: 'GeoPosition',
            longitude: update.position.longitude,
            latitude: update.position.latitude,
            altitude: update.position.altitude ?? 0,
            timestamp: new Date(),
          }

          yield* pipe(
            world.setTrait(update.entityId, 'GeoPosition' as TraitId, geoData),
            Effect.catchAll(() => Effect.void)
          )

          // Update heading if provided
          if (update.heading !== undefined) {
            yield* pipe(
              world.setTrait(update.entityId, 'GeoHeading' as TraitId, {
                _tag: 'GeoHeading',
                heading: update.heading,
                pitch: 0,
                roll: 0,
              }),
              Effect.catchAll(() => Effect.void)
            )
          }

          return { entityId: update.entityId, geoData }
        }),
      { concurrency: 20 }
    ).pipe(
      Effect.flatMap((prepared) => {
        // Batch project all positions
        const batchInput: BatchProjectionInput[] = prepared.map((p) => ({
          id: p.entityId as string,
          coord: {
            longitude: p.geoData.longitude,
            latitude: p.geoData.latitude,
            altitude: p.geoData.altitude,
          },
        }))

        return pipe(
          projection.projectBatch(batchInput),
          Effect.mapError(
            (e) =>
              new GeoPositionError({
                operation: 'update',
                message: `Batch projection failed: ${e.message}`,
                cause: e,
              })
          ),
          Effect.flatMap((results) =>
            Effect.forEach(
              results,
              (result) =>
                Effect.gen(function* () {
                  const entityId = result.id as EntityId
                  const preparedItem = prepared.find(
                    (p) => (p.entityId as string) === result.id
                  )!

                  // Update screen traits
                  const screenData: ScreenPosition = {
                    _tag: 'ScreenPosition',
                    x: result.result.screen.x,
                    y: result.result.screen.y,
                    z: result.result.screen.z ?? 0,
                    isVisible: result.result.isVisible,
                  }

                  const ndcData: NDCPosition = {
                    _tag: 'NDCPosition',
                    ndcX: result.result.ndc.x,
                    ndcY: result.result.ndc.y,
                    ndcZ: result.result.ndc.z ?? 0.5,
                  }

                  yield* pipe(
                    world.setTrait(entityId, 'ScreenPosition' as TraitId, screenData),
                    Effect.catchAll(() =>
                      world.addTrait(entityId, 'ScreenPosition' as TraitId, screenData)
                    ),
                    Effect.catchAll(() => Effect.void)
                  )

                  yield* pipe(
                    world.setTrait(entityId, 'NDCPosition' as TraitId, ndcData),
                    Effect.catchAll(() =>
                      world.addTrait(entityId, 'NDCPosition' as TraitId, ndcData)
                    ),
                    Effect.catchAll(() => Effect.void)
                  )

                  // Get heading
                  const headingResult = yield* pipe(
                    world.getTrait(entityId, 'GeoHeading' as TraitId),
                    Effect.map((data) => data as GeoHeading),
                    Effect.catchAll(() => Effect.succeed(null))
                  )

                  return toPositionedEntity(
                    entityId,
                    preparedItem.geoData,
                    screenData,
                    ndcData,
                    headingResult
                  )
                }),
              { concurrency: 20 }
            )
          )
        )
      })
    )

  const query = (
    options?: QueryPositionedOptions
  ): Effect.Effect<readonly PositionedEntity[], GeoPositionError> =>
    Effect.gen(function* () {
      const entityIds = yield* Ref.get(positionedEntitiesRef)

      // Fetch all entity data in parallel
      const allEntityData = yield* Effect.forEach(
        Array.from(entityIds),
        (entityId) =>
          Effect.gen(function* () {
            // Parallel fetch of all traits for this entity
            const [geoPosResult, screenPosResult, ndcPosResult, headingResult] =
              yield* Effect.all(
                [
                  pipe(
                    world.getTrait(entityId, 'GeoPosition' as TraitId),
                    Effect.map((data) => data as GeoPosition),
                    Effect.catchAll(() => Effect.succeed(null))
                  ),
                  pipe(
                    world.getTrait(entityId, 'ScreenPosition' as TraitId),
                    Effect.map((data) => data as ScreenPosition),
                    Effect.catchAll(() => Effect.succeed(null))
                  ),
                  pipe(
                    world.getTrait(entityId, 'NDCPosition' as TraitId),
                    Effect.map((data) => data as NDCPosition),
                    Effect.catchAll(() => Effect.succeed(null))
                  ),
                  pipe(
                    world.getTrait(entityId, 'GeoHeading' as TraitId),
                    Effect.map((data) => data as GeoHeading),
                    Effect.catchAll(() => Effect.succeed(null))
                  ),
                ],
                { concurrency: 'unbounded' }
              )

            if (!geoPosResult) return null

            // Check withTrait filter if needed
            if (options?.withTrait) {
              const hasTrait = yield* pipe(
                world.getTrait(entityId, options.withTrait),
                Effect.map(() => true),
                Effect.catchAll(() => Effect.succeed(false))
              )
              if (!hasTrait) return null
            }

            return toPositionedEntity(
              entityId,
              geoPosResult,
              screenPosResult,
              ndcPosResult,
              headingResult
            )
          }),
        { concurrency: 'unbounded' }
      )

      // Apply filters (must be sequential for limit support)
      const results: PositionedEntity[] = []

      for (const positioned of allEntityData) {
        if (!positioned) continue

        // Apply visibility filter
        if (options?.visibleOnly && !positioned.isVisible) continue

        // Apply bounds filter
        if (options?.bounds) {
          const [minLon, minLat, maxLon, maxLat] = options.bounds
          if (
            positioned.geo.longitude < minLon ||
            positioned.geo.longitude > maxLon ||
            positioned.geo.latitude < minLat ||
            positioned.geo.latitude > maxLat
          ) {
            continue
          }
        }

        results.push(positioned)

        if (options?.limit && results.length >= options.limit) break
      }

      return results
    })

  const get = (entityId: EntityId): Effect.Effect<PositionedEntity, GeoPositionError> =>
    Effect.gen(function* () {
      // Parallel fetch of all traits
      const [geoPos, screenPos, ndcPos, heading] = yield* Effect.all(
        [
          pipe(
            world.getTrait(entityId, 'GeoPosition' as TraitId),
            Effect.map((data) => data as GeoPosition),
            Effect.mapError(
              () =>
                new GeoPositionError({
                  operation: 'query',
                  entityId: entityId as string,
                  message: 'Entity not found or missing GeoPosition trait',
                })
            )
          ),
          pipe(
            world.getTrait(entityId, 'ScreenPosition' as TraitId),
            Effect.map((data) => data as ScreenPosition),
            Effect.catchAll(() => Effect.succeed(null))
          ),
          pipe(
            world.getTrait(entityId, 'NDCPosition' as TraitId),
            Effect.map((data) => data as NDCPosition),
            Effect.catchAll(() => Effect.succeed(null))
          ),
          pipe(
            world.getTrait(entityId, 'GeoHeading' as TraitId),
            Effect.map((data) => data as GeoHeading),
            Effect.catchAll(() => Effect.succeed(null))
          ),
        ],
        { concurrency: 'unbounded' }
      )

      return toPositionedEntity(entityId, geoPos, screenPos, ndcPos, heading)
    })

  const destroy = (entityId: EntityId): Effect.Effect<void, GeoPositionError> =>
    Effect.gen(function* () {
      yield* pipe(
        world.destroy(entityId),
        Effect.mapError(
          (e) =>
            new GeoPositionError({
              operation: 'destroy',
              entityId: entityId as string,
              message: `Failed to destroy entity: ${e}`,
              cause: e,
            })
        )
      )

      yield* Ref.update(positionedEntitiesRef, (set) => {
        set.delete(entityId)
        return set
      })

      yield* Ref.update(statsRef, (s) => ({
        ...s,
        total: Math.max(0, s.total - 1),
      }))
    })

  const destroyBatch = (
    entityIds: readonly EntityId[]
  ): Effect.Effect<void, GeoPositionError> =>
    Effect.forEach(entityIds, destroy, { concurrency: 10, discard: true })

  const syncProjections = (): Effect.Effect<number, GeoPositionError> =>
    Effect.withSpan('GeoPositionService.syncProjections')(
      Effect.gen(function* () {
        const startTime = Date.now()
        const entityIds = yield* Ref.get(positionedEntitiesRef)

      // Collect all positions for batch projection - parallel trait lookups
      const geoPositionResults = yield* Effect.forEach(
        Array.from(entityIds),
        (entityId) =>
          pipe(
            world.getTrait(entityId, 'GeoPosition' as TraitId),
            Effect.map((data) => ({ entityId, geoPos: data as GeoPosition })),
            Effect.catchAll(() => Effect.succeed(null))
          ),
        { concurrency: 'unbounded' }
      )

      const batchInput = geoPositionResults.filter(
        (item): item is { entityId: EntityId; geoPos: GeoPosition } => item !== null
      )

      if (batchInput.length === 0) return 0

      // Batch project
      const projectionInput: BatchProjectionInput[] = batchInput.map((item) => ({
        id: item.entityId as string,
        coord: {
          longitude: item.geoPos.longitude,
          latitude: item.geoPos.latitude,
          altitude: item.geoPos.altitude,
        },
      }))

      const results = yield* pipe(
        projection.projectBatch(projectionInput),
        Effect.mapError(
          (e) =>
            new GeoPositionError({
              operation: 'sync',
              message: `Batch projection failed: ${e.message}`,
              cause: e,
            })
        )
      )

      // Update all screen positions - parallel trait updates
      const updateResults = yield* Effect.forEach(
        results,
        (result) =>
          Effect.gen(function* () {
            const entityId = result.id as EntityId

            const screenData: ScreenPosition = {
              _tag: 'ScreenPosition',
              x: result.result.screen.x,
              y: result.result.screen.y,
              z: result.result.screen.z ?? 0,
              isVisible: result.result.isVisible,
            }

            const ndcData: NDCPosition = {
              _tag: 'NDCPosition',
              ndcX: result.result.ndc.x,
              ndcY: result.result.ndc.y,
              ndcZ: result.result.ndc.z ?? 0.5,
            }

            yield* pipe(
              world.setTrait(entityId, 'ScreenPosition' as TraitId, screenData),
              Effect.catchAll(() =>
                world.addTrait(entityId, 'ScreenPosition' as TraitId, screenData)
              ),
              Effect.catchAll(() => Effect.void)
            )

            yield* pipe(
              world.setTrait(entityId, 'NDCPosition' as TraitId, ndcData),
              Effect.catchAll(() =>
                world.addTrait(entityId, 'NDCPosition' as TraitId, ndcData)
              ),
              Effect.catchAll(() => Effect.void)
            )

            return { synced: true, visible: result.result.isVisible }
          }),
        { concurrency: 'unbounded' }
      )

      const synced = updateResults.length
      const visible = updateResults.filter((r) => r.visible).length
      const elapsed = Date.now() - startTime

      yield* Ref.set(statsRef, {
        total: synced,
        visible,
        lastSyncMs: elapsed,
      })

      // Update sync metrics
      yield* Metric.increment(syncCounter)
      yield* Metric.update(syncLatencyHistogram, elapsed)

      return synced
    }))

  const startViewportSync = () =>
    Effect.gen(function* () {
      const viewportStream = yield* projection.onViewportChange()

      const fiber = yield* pipe(
        viewportStream,
        Stream.debounce(Duration.millis(16)), // ~60fps max
        Stream.runForEach(() => syncProjections().pipe(Effect.catchAll(() => Effect.void))),
        Effect.fork
      )

      return fiber
    })

  const onChange = () =>
    Effect.gen(function* () {
      // Subscribe to PubSub - returns a Dequeue that receives published messages
      const dequeue = yield* PubSub.subscribe(changePubSub)
      // Convert Dequeue to Stream for reactive consumption
      return Stream.fromQueue(dequeue)
    })

  const getStats = () => Ref.get(statsRef)

  return {
    spawn,
    spawnBatch,
    updatePosition,
    updatePositionBatch,
    query,
    get,
    destroy,
    destroyBatch,
    syncProjections,
    startViewportSync,
    onChange,
    getStats,
  }
})

// =============================================================================
// Layer
// =============================================================================

/**
 * GeoPositionService live layer.
 * Requires KoriWorld and MapProjectionService.
 */
export const GeoPositionServiceLive = Layer.effect(
  GeoPositionService,
  makeGeoPositionService
)

export default GeoPositionService
