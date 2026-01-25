/**
 * GEOINT Kori Bridge Service
 *
 * Bridges SearchResultItems to Kori entities with stream-connected traits.
 * When tracking an entity, its traits update reactively as data streams in.
 *
 * Architecture:
 * - SearchResultItem → TraitBundle → KoriEntity (initial hydration)
 * - Stream subscriptions → Trait updates → Atom updates (live tracking)
 * - Effect.Stream for reactive data flow
 *
 * @module geoint/kori/GeointKoriBridge
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Fiber,
  HashMap,
  HashSet,
  Option,
  Scope,
  pipe,
} from 'effect'
import type { SearchResultItem } from '../schemas/search'
import {
  mapSearchResultToTraits,
  getEntityType,
  getEntityLabel,
  type TraitBundle,
  type GeointEntityType,
} from './search-result-mapper'
import {
  geointRegistry,
  entityOps,
  selectedEntityIds,
  pinnedEntityIds,
  liveEntityIds,
  type EntityLiveData,
  type EntityPosition,
} from './entity-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entity ID (opaque string).
 */
export type EntityId = string

/**
 * Stream subscription handle for live entity tracking.
 */
export interface StreamSubscription {
  readonly entityId: EntityId
  readonly fiber: Fiber.RuntimeFiber<void, unknown>
  readonly unsubscribe: Effect.Effect<void>
}

/**
 * Live data update from a stream.
 */
export interface LiveDataUpdate {
  readonly entityId: EntityId
  readonly position?: EntityPosition
  readonly heading?: number
  readonly speed?: number
  readonly timestamp: Date
}

/**
 * Entity spawn result.
 */
export interface SpawnResult {
  readonly entityId: EntityId
  readonly entityType: GeointEntityType
  readonly label: string
  readonly traits: TraitBundle
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GeointKoriBridge service operations.
 */
export interface GeointKoriBridgeOps {
  /**
   * Spawn an entity from a search result.
   * Initializes atoms and optionally starts live tracking.
   */
  readonly spawnFromSearchResult: (
    result: SearchResultItem,
    options?: { startLiveTracking?: boolean }
  ) => Effect.Effect<SpawnResult>

  /**
   * Bulk hydrate entities from search results.
   * More efficient than spawning one at a time.
   */
  readonly hydrateFromSearch: (
    results: readonly SearchResultItem[]
  ) => Effect.Effect<readonly SpawnResult[]>

  /**
   * Start live tracking for an entity.
   * Connects to data stream for real-time updates.
   */
  readonly startLiveTracking: (
    entityId: EntityId,
    dataStream: Stream.Stream<LiveDataUpdate, unknown>
  ) => Effect.Effect<StreamSubscription, never, Scope.Scope>

  /**
   * Stop live tracking for an entity.
   */
  readonly stopLiveTracking: (entityId: EntityId) => Effect.Effect<void>

  /**
   * Despawn an entity (cleanup atoms and streams).
   */
  readonly despawn: (entityId: EntityId) => Effect.Effect<void>

  /**
   * Clear stale entities (not pinned, not live).
   */
  readonly clearStaleEntities: () => Effect.Effect<void>

  /**
   * Clear all entities except pinned.
   */
  readonly clearNonPinned: () => Effect.Effect<void>

  /**
   * Get active stream subscriptions.
   */
  readonly getActiveStreams: () => Effect.Effect<readonly EntityId[]>

  /**
   * Get entity count statistics.
   */
  readonly getStats: () => Effect.Effect<{
    totalEntities: number
    liveEntities: number
    pinnedEntities: number
    selectedEntities: number
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GeointKoriBridge service tag.
 */
export class GeointKoriBridge extends Context.Tag('geoint/KoriBridge')<
  GeointKoriBridge,
  GeointKoriBridgeOps
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live implementation of GeointKoriBridge.
 */
export const GeointKoriBridgeLive = Layer.effect(
  GeointKoriBridge,
  Effect.gen(function* () {
    // Track active stream subscriptions
    let activeStreams = HashMap.empty<EntityId, StreamSubscription>()

    // Track spawned entity IDs
    let spawnedEntities = HashSet.empty<EntityId>()

    /**
     * Spawn a single entity from search result.
     */
    const spawnFromSearchResult = (
      result: SearchResultItem,
      options?: { startLiveTracking?: boolean }
    ): Effect.Effect<SpawnResult> =>
      Effect.sync(() => {
        const traits = mapSearchResultToTraits(result)
        const entityType = getEntityType(result)
        const label = getEntityLabel(result)
        const entityId = traits.entityId

        // Initialize live data atom
        const position = extractPosition(result)
        const liveData: EntityLiveData = {
          entityId,
          entityType,
          position,
          heading: extractHeading(result),
          speed: extractSpeed(result),
          label,
          lastUpdated: new Date(),
          isLive: options?.startLiveTracking ?? false,
        }
        entityOps.initializeLiveData(liveData)

        // Track as spawned
        spawnedEntities = HashSet.add(spawnedEntities, entityId)

        // Start entering animation
        entityOps.startEntering(entityId)

        // Auto-complete animation after 300ms
        setTimeout(() => {
          entityOps.completeAnimation(entityId)
        }, 300)

        return {
          entityId,
          entityType,
          label,
          traits,
        }
      })

    /**
     * Bulk hydrate from search results.
     */
    const hydrateFromSearch = (
      results: readonly SearchResultItem[]
    ): Effect.Effect<readonly SpawnResult[]> =>
      Effect.sync(() => {
        const spawned: SpawnResult[] = []

        for (const result of results) {
          const traits = mapSearchResultToTraits(result)
          const entityType = getEntityType(result)
          const label = getEntityLabel(result)
          const entityId = traits.entityId

          // Skip if already spawned
          if (HashSet.has(spawnedEntities, entityId)) {
            // Update existing entity with fresh data
            const position = extractPosition(result)
            entityOps.updateLiveData(entityId, {
              position,
              heading: extractHeading(result),
              speed: extractSpeed(result),
            })
            continue
          }

          // Initialize live data atom
          const position = extractPosition(result)
          const liveData: EntityLiveData = {
            entityId,
            entityType,
            position,
            heading: extractHeading(result),
            speed: extractSpeed(result),
            label,
            lastUpdated: new Date(),
            isLive: false,
          }
          entityOps.initializeLiveData(liveData)

          // Track as spawned
          spawnedEntities = HashSet.add(spawnedEntities, entityId)

          // Start entering animation (staggered)
          const delay = spawned.length * 30 // 30ms stagger
          setTimeout(() => {
            entityOps.startEntering(entityId)
            setTimeout(() => {
              entityOps.completeAnimation(entityId)
            }, 300)
          }, delay)

          spawned.push({
            entityId,
            entityType,
            label,
            traits,
          })
        }

        return spawned
      })

    /**
     * Start live tracking with a data stream.
     */
    const startLiveTracking = (
      entityId: EntityId,
      dataStream: Stream.Stream<LiveDataUpdate, unknown>
    ): Effect.Effect<StreamSubscription, never, Scope.Scope> =>
      Effect.gen(function* () {
        // Check if already tracking
        const existing = HashMap.get(activeStreams, entityId)
        if (Option.isSome(existing)) {
          return existing.value
        }

        // Mark entity as live
        entityOps.markLive(entityId)

        // Subscribe to stream
        const fiber = yield* pipe(
          dataStream,
          Stream.tap((update) =>
            Effect.sync(() => {
              // Update entity live data atom
              entityOps.updateLiveData(entityId, {
                position: update.position,
                heading: update.heading,
                speed: update.speed,
              })
            })
          ),
          Stream.runDrain,
          Effect.forkScoped
        )

        const subscription: StreamSubscription = {
          entityId,
          fiber,
          unsubscribe: Effect.sync(() => {
            activeStreams = HashMap.remove(activeStreams, entityId)
            entityOps.markStale(entityId)
          }),
        }

        activeStreams = HashMap.set(activeStreams, entityId, subscription)

        return subscription
      })

    /**
     * Stop live tracking.
     */
    const stopLiveTracking = (entityId: EntityId): Effect.Effect<void> =>
      Effect.gen(function* () {
        const subscription = HashMap.get(activeStreams, entityId)
        if (Option.isNone(subscription)) return

        // Interrupt the fiber
        yield* Fiber.interrupt(subscription.value.fiber)

        // Cleanup
        activeStreams = HashMap.remove(activeStreams, entityId)
        entityOps.markStale(entityId)
      })

    /**
     * Despawn an entity.
     */
    const despawn = (entityId: EntityId): Effect.Effect<void> =>
      Effect.gen(function* () {
        // Stop live tracking if active
        yield* stopLiveTracking(entityId)

        // Start exit animation
        entityOps.startExiting(entityId)

        // Wait for animation then cleanup
        yield* Effect.sleep('300 millis')

        // Dispose atoms
        entityOps.disposeEntity(entityId)

        // Remove from spawned set
        spawnedEntities = HashSet.remove(spawnedEntities, entityId)
      })

    /**
     * Clear stale entities.
     */
    const clearStaleEntities = (): Effect.Effect<void> =>
      Effect.sync(() => {
        // Get pinned and live entities
        const pinned = geointRegistry.get(pinnedEntityIds)
        const live = geointRegistry.get(liveEntityIds)

        // Find stale entities using functional approach
        const stale = pipe(
          spawnedEntities,
          HashSet.filter((entityId) => !HashSet.has(pinned, entityId) && !HashSet.has(live, entityId)),
          HashSet.toValues
        )

        // Despawn stale entities (no animation for bulk clear)
        for (const entityId of stale) {
          entityOps.disposeEntity(entityId)
          spawnedEntities = HashSet.remove(spawnedEntities, entityId)
        }
      })

    /**
     * Clear non-pinned entities.
     */
    const clearNonPinned = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        // Stop all streams first - get keys as array
        const streamIds = pipe(activeStreams, HashMap.keys, HashSet.fromIterable, HashSet.toValues)
        for (const entityId of streamIds) {
          yield* stopLiveTracking(entityId)
        }

        // Clear via entity ops
        entityOps.clearNonPinned()

        // Update spawned set
        const pinned = geointRegistry.get(pinnedEntityIds)
        spawnedEntities = pipe(
          spawnedEntities,
          HashSet.filter((id) => HashSet.has(pinned, id))
        )
      })

    /**
     * Get active streams.
     */
    const getActiveStreams = (): Effect.Effect<readonly EntityId[]> =>
      Effect.sync(() => pipe(activeStreams, HashMap.keys, HashSet.fromIterable, HashSet.toValues))

    /**
     * Get stats.
     */
    const getStats = (): Effect.Effect<{
      totalEntities: number
      liveEntities: number
      pinnedEntities: number
      selectedEntities: number
    }> =>
      Effect.sync(() => ({
        totalEntities: HashSet.size(spawnedEntities),
        liveEntities: HashMap.size(activeStreams),
        pinnedEntities: HashSet.size(geointRegistry.get(pinnedEntityIds)),
        selectedEntities: HashSet.size(geointRegistry.get(selectedEntityIds)),
      }))

    return {
      spawnFromSearchResult,
      hydrateFromSearch,
      startLiveTracking,
      stopLiveTracking,
      despawn,
      clearStaleEntities,
      clearNonPinned,
      getActiveStreams,
      getStats,
    } satisfies GeointKoriBridgeOps
  })
)

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract position from search result.
 */
function extractPosition(result: SearchResultItem): EntityPosition {
  switch (result._tag) {
    case 'SearchResultFlight':
    case 'SearchResultTrack':
      return {
        lon: result.position[0],
        lat: result.position[1],
        altitudeM: result.position[2],
      }
    case 'SearchResultPoi':
    case 'SearchResultFeature':
    case 'SearchResultWeather':
    case 'SearchResultImagery':
      return {
        lon: result.position[0],
        lat: result.position[1],
      }
  }
}

/**
 * Extract heading from search result (if applicable).
 */
function extractHeading(result: SearchResultItem): number | undefined {
  switch (result._tag) {
    case 'SearchResultFlight':
    case 'SearchResultTrack':
      return result.heading
    default:
      return undefined
  }
}

/**
 * Extract speed from search result (if applicable).
 */
function extractSpeed(result: SearchResultItem): number | undefined {
  switch (result._tag) {
    case 'SearchResultFlight':
      return result.velocity
    case 'SearchResultTrack':
      return result.speed
    default:
      return undefined
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Effects
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn entity from search result (requires GeointKoriBridge).
 */
export const spawnEntity = (
  result: SearchResultItem,
  options?: { startLiveTracking?: boolean }
) =>
  Effect.gen(function* () {
    const bridge = yield* GeointKoriBridge
    return yield* bridge.spawnFromSearchResult(result, options)
  })

/**
 * Hydrate entities from search results (requires GeointKoriBridge).
 */
export const hydrateEntities = (results: readonly SearchResultItem[]) =>
  Effect.gen(function* () {
    const bridge = yield* GeointKoriBridge
    return yield* bridge.hydrateFromSearch(results)
  })

/**
 * Get bridge stats (requires GeointKoriBridge).
 */
export const getBridgeStats = () =>
  Effect.gen(function* () {
    const bridge = yield* GeointKoriBridge
    return yield* bridge.getStats()
  })
