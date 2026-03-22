/**
 * EntitySpec Service
 *
 * Effect.Service that manages EntitySpecs with caching and factory creation.
 * Depends on KoriStorageService for persistence (NATS is fully opaque).
 *
 * Pattern: Cache + Factory registry over storage abstraction.
 *
 * @module kori/services/entity-spec
 */

import { Effect, Context, Layer, Ref, Stream, pipe } from 'effect'

import {
  KoriStorageService,
  type KoriStorageError,
  type KoriSpecNotFoundError,
  type SpecChangeEvent,
} from './storage'
import {
  EntitySpec,
  type EntityTypeId,
  BUILTIN_SPECS,
} from '../schemas/entity-spec'
import {
  EntityFactoryRegistry,
  createDynamicEntityFactory,
  type DynamicEntityFactory,
} from '../schemas/tagged-entity'

// =============================================================================
// Re-export SpecChangeEvent for consumers
// =============================================================================

export type { SpecChangeEvent } from './storage'

// =============================================================================
// Service Shape
// =============================================================================

/**
 * EntitySpecService shape — operations for spec management.
 */
export interface EntitySpecServiceShape {
  /**
   * Get a spec by entity type ID.
   * Returns from cache if available, else fetches from storage.
   */
  readonly get: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<EntitySpec | null, KoriStorageError>

  /**
   * List all registered entity type IDs.
   */
  readonly list: () => Effect.Effect<ReadonlyArray<EntityTypeId>, never>

  /**
   * Save a spec to storage.
   */
  readonly save: (
    spec: EntitySpec
  ) => Effect.Effect<void, KoriStorageError>

  /**
   * Delete a spec from storage.
   */
  readonly delete: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<void, KoriStorageError>

  /**
   * Watch for spec changes.
   * Returns a Stream of change events.
   */
  readonly watch: () => Stream.Stream<SpecChangeEvent, KoriStorageError>

  /**
   * Get factory for an entity type.
   * Creates factory from spec if not cached.
   */
  readonly getFactory: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<DynamicEntityFactory | null, KoriStorageError>

  /**
   * Sync all specs from storage into cache.
   */
  readonly syncAll: () => Effect.Effect<number, KoriStorageError>

  /**
   * Check if service is ready (initial sync complete).
   */
  readonly isReady: () => Effect.Effect<boolean, never>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * EntitySpecService tag for dependency injection.
 */
export class EntitySpecService extends Context.Tag('kori/EntitySpecService')<
  EntitySpecService,
  EntitySpecServiceShape
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Live implementation of EntitySpecService.
 * Depends on KoriStorageService.
 */
export const EntitySpecServiceLive = Layer.effect(
  EntitySpecService,
  Effect.gen(function* () {
    const storage = yield* KoriStorageService

    // Internal state
    const cacheRef = yield* Ref.make<Map<string, EntitySpec>>(new Map())
    const factoryRegistry = new EntityFactoryRegistry()
    const isReadyRef = yield* Ref.make(false)

    /**
     * Load spec from storage and cache it.
     */
    const loadAndCache = (
      entityTypeId: EntityTypeId
    ): Effect.Effect<EntitySpec | null, KoriStorageError> =>
      Effect.gen(function* () {
        const spec = yield* storage.getSpec(entityTypeId)

        if (spec) {
          yield* Ref.update(cacheRef, (cache) => {
            const newCache = new Map(cache)
            newCache.set(entityTypeId as string, spec)
            return newCache
          })

          // Update factory registry
          factoryRegistry.registerFromSpec(spec)
        }

        return spec
      })

    /**
     * Initialize with built-in specs.
     */
    const initBuiltins = Effect.gen(function* () {
      for (const spec of BUILTIN_SPECS) {
        yield* Ref.update(cacheRef, (cache) => {
          const newCache = new Map(cache)
          newCache.set(spec.entityTypeId as string, spec)
          return newCache
        })
        factoryRegistry.registerFromSpec(spec)
      }
    })

    // Initialize built-in specs on service creation
    yield* initBuiltins

    // Service implementation
    const service: EntitySpecServiceShape = {
      get: (entityTypeId) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(cacheRef)
          const cached = cache.get(entityTypeId as string)
          if (cached) return cached

          return yield* loadAndCache(entityTypeId)
        }),

      list: () =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(cacheRef)
          return Array.from(cache.keys()) as EntityTypeId[]
        }),

      save: (spec) =>
        Effect.gen(function* () {
          yield* storage.saveSpec(spec)

          // Update cache
          yield* Ref.update(cacheRef, (cache) => {
            const newCache = new Map(cache)
            newCache.set(spec.entityTypeId as string, spec)
            return newCache
          })

          // Update factory
          factoryRegistry.registerFromSpec(spec)
        }),

      delete: (entityTypeId) =>
        Effect.gen(function* () {
          yield* storage.deleteSpec(entityTypeId)

          // Remove from cache
          yield* Ref.update(cacheRef, (cache) => {
            const newCache = new Map(cache)
            newCache.delete(entityTypeId as string)
            return newCache
          })
        }),

      watch: () =>
        pipe(
          storage.watchSpecs(),
          // Side effect: update cache on changes
          Stream.tap((event) =>
            Effect.gen(function* () {
              if (event.type === 'put' && event.spec) {
                yield* Ref.update(cacheRef, (cache) => {
                  const newCache = new Map(cache)
                  newCache.set(event.entityTypeId as string, event.spec!)
                  return newCache
                })
                factoryRegistry.registerFromSpec(event.spec)
              } else if (event.type === 'delete') {
                yield* Ref.update(cacheRef, (cache) => {
                  const newCache = new Map(cache)
                  newCache.delete(event.entityTypeId as string)
                  return newCache
                })
              }
            })
          )
        ),

      getFactory: (entityTypeId) =>
        Effect.gen(function* () {
          // Check factory registry first
          const existing = factoryRegistry.get(entityTypeId as string)
          if (existing) return existing

          // Load spec and create factory
          const spec = yield* service.get(entityTypeId)
          if (!spec) return null

          return factoryRegistry.registerFromSpec(spec)
        }),

      syncAll: () =>
        Effect.gen(function* () {
          const specIds = yield* storage.listSpecIds()

          let count = 0
          for (const specId of specIds) {
            yield* loadAndCache(specId as EntityTypeId)
            count++
          }

          yield* Ref.set(isReadyRef, true)
          return count
        }),

      isReady: () => Ref.get(isReadyRef),
    }

    return service
  })
)

// =============================================================================
// Convenience Layers
// =============================================================================

/**
 * Full layer with KoriStorageService dependency.
 */
export const EntitySpecServiceLayer = EntitySpecServiceLive

/**
 * Mock layer for testing.
 */
export const EntitySpecServiceMock = Layer.effect(
  EntitySpecService,
  Effect.gen(function* () {
    const cacheRef = yield* Ref.make<Map<string, EntitySpec>>(new Map())
    const factoryRegistry = new EntityFactoryRegistry()

    // Initialize with built-ins
    for (const spec of BUILTIN_SPECS) {
      const cache = yield* Ref.get(cacheRef)
      cache.set(spec.entityTypeId as string, spec)
      factoryRegistry.registerFromSpec(spec)
    }

    const service: EntitySpecServiceShape = {
      get: (entityTypeId) =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(cacheRef)
          return cache.get(entityTypeId as string) ?? null
        }),

      list: () =>
        Effect.gen(function* () {
          const cache = yield* Ref.get(cacheRef)
          return Array.from(cache.keys()) as EntityTypeId[]
        }),

      save: (spec) =>
        Effect.gen(function* () {
          yield* Ref.update(cacheRef, (cache) => {
            cache.set(spec.entityTypeId as string, spec)
            return cache
          })
          factoryRegistry.registerFromSpec(spec)
        }),

      delete: (entityTypeId) =>
        Effect.gen(function* () {
          yield* Ref.update(cacheRef, (cache) => {
            cache.delete(entityTypeId as string)
            return cache
          })
        }),

      watch: () => Stream.empty,

      getFactory: (entityTypeId) =>
        Effect.gen(function* () {
          const existing = factoryRegistry.get(entityTypeId as string)
          if (existing) return existing

          const cache = yield* Ref.get(cacheRef)
          const spec = cache.get(entityTypeId as string)
          if (!spec) return null

          return factoryRegistry.registerFromSpec(spec)
        }),

      syncAll: () => Effect.succeed(BUILTIN_SPECS.length),

      isReady: () => Effect.succeed(true),
    }

    return service
  })
)
