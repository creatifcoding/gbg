/**
 * KORI World Service
 *
 * Effect.Service wrapper for koota's createWorld().
 * Validates trait data via Effect Schema before storing in koota.
 *
 * Architecture:
 * - koota: actual ECS storage (entities, traits, queries)
 * - Effect Schema: validation layer for trait data
 * - Effect.Service: error handling, DI, lifecycle
 *
 * @module
 */

import { Context, Effect, Layer, Schema, Scope, pipe } from "effect"
import { createWorld, trait, type World, type Entity } from "koota"
import { nanoid } from "nanoid"
import type { TraitId } from "../schemas/trait"
import { isUniqueTrait } from "../schemas/trait"
import {
  EntityNotFound,
  EntityDestroyed,
  WorldDisposed,
  WorldLocked,
  TraitMissing,
  TraitAlreadyAttached,
  TraitValidationFailed,
  TraitValueNotUnique,
  type SpawnError,
  type AddTraitError,
  type SetTraitError,
  type RemoveTraitError,
} from "../errors"
import { UniqueIndex, UniqueIndexLive, type UniqueIndexOps } from "./unique-index"
import {
  Position2D as Position2DSchema,
  Position3D as Position3DSchema,
  Velocity2D as Velocity2DSchema,
  Velocity3D as Velocity3DSchema,
  Health as HealthSchema,
  Name as NameSchema,
  Lifetime as LifetimeSchema,
  ParentOf as ParentOfSchema,
  ChildOf as ChildOfSchema,
  IsPlayer as IsPlayerSchema,
  IsEnemy as IsEnemySchema,
  IsActive as IsActiveSchema,
  IsDestroyed as IsDestroyedSchema,
} from "../schemas/trait"

// ─────────────────────────────────────────────────────────────────────────────
// koota Trait Definitions (Storage Layer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * koota traits mirror Effect Schema shapes for storage.
 * These are the actual ECS components stored in koota's world.
 */
const KootaPosition2D = trait({ _tag: "Position2D" as const, x: 0, y: 0 })
const KootaPosition3D = trait({ _tag: "Position3D" as const, x: 0, y: 0, z: 0 })
const KootaVelocity2D = trait({ _tag: "Velocity2D" as const, vx: 0, vy: 0 })
const KootaVelocity3D = trait({ _tag: "Velocity3D" as const, vx: 0, vy: 0, vz: 0 })
const KootaHealth = trait({ _tag: "Health" as const, current: 100, max: 100 })
const KootaName = trait({ _tag: "Name" as const, value: "" })
const KootaLifetime = trait({ _tag: "Lifetime" as const, spawnedAt: 0, ttlMs: 5000 })
const KootaParentOf = trait(() => ({ _tag: "ParentOf" as const, children: [] as string[] }))
const KootaChildOf = trait({ _tag: "ChildOf" as const, parentId: "" })

// Tag traits (markers with _tag only)
const KootaIsPlayer = trait({ _tag: "IsPlayer" as const })
const KootaIsEnemy = trait({ _tag: "IsEnemy" as const })
const KootaIsActive = trait({ _tag: "IsActive" as const })
const KootaIsDestroyed = trait({ _tag: "IsDestroyed" as const })

/**
 * Registry mapping TraitId → koota trait + Effect Schema
 */
const TraitRegistry = {
  Position2D: { koota: KootaPosition2D, schema: Position2DSchema, isTag: false },
  Position3D: { koota: KootaPosition3D, schema: Position3DSchema, isTag: false },
  Velocity2D: { koota: KootaVelocity2D, schema: Velocity2DSchema, isTag: false },
  Velocity3D: { koota: KootaVelocity3D, schema: Velocity3DSchema, isTag: false },
  Health: { koota: KootaHealth, schema: HealthSchema, isTag: false },
  Name: { koota: KootaName, schema: NameSchema, isTag: false },
  Lifetime: { koota: KootaLifetime, schema: LifetimeSchema, isTag: false },
  ParentOf: { koota: KootaParentOf, schema: ParentOfSchema, isTag: false },
  ChildOf: { koota: KootaChildOf, schema: ChildOfSchema, isTag: false },
  IsPlayer: { koota: KootaIsPlayer, schema: IsPlayerSchema, isTag: true },
  IsEnemy: { koota: KootaIsEnemy, schema: IsEnemySchema, isTag: true },
  IsActive: { koota: KootaIsActive, schema: IsActiveSchema, isTag: true },
  IsDestroyed: { koota: KootaIsDestroyed, schema: IsDestroyedSchema, isTag: true },
} as const

type RegisteredTraitId = keyof typeof TraitRegistry

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entity identifier (branded string wrapping koota's numeric ID).
 */
export type EntityId = string & { readonly _brand: unique symbol }

/**
 * World identifier (branded string).
 */
export type WorldId = string & { readonly _brand: unique symbol }

/**
 * Entity instance exposed to consumers.
 * Wraps koota entity with typed trait access.
 */
export interface KoriEntity {
  readonly id: EntityId
  readonly worldId: WorldId
  readonly traits: ReadonlyMap<TraitId, unknown>
  readonly createdAt: Date
  readonly isDestroyed: boolean
  /** Internal koota entity reference */
  readonly _kootaEntity: Entity
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI World operations.
 */
export interface KoriWorldOps {
  /**
   * Get the world ID.
   */
  readonly id: Effect.Effect<WorldId>

  /**
   * Spawn a new entity with optional initial traits.
   * Validates trait data via Effect Schema before storing.
   * Enforces uniqueness constraints on unique traits.
   * Uses Effect.acquireRelease — entity auto-destroys on scope close.
   */
  readonly spawn: (
    traits?: ReadonlyArray<{ id: TraitId; data: unknown }>
  ) => Effect.Effect<KoriEntity, SpawnError, Scope.Scope>

  /**
   * Get an entity by ID.
   */
  readonly get: (entityId: EntityId) => Effect.Effect<KoriEntity, EntityNotFound | EntityDestroyed | WorldDisposed>

  /**
   * Check if entity exists.
   */
  readonly has: (entityId: EntityId) => Effect.Effect<boolean>

  /**
   * Destroy an entity.
   */
  readonly destroy: (entityId: EntityId) => Effect.Effect<void, EntityNotFound>

  /**
   * Query all entities (returns immutable snapshot).
   */
  readonly queryAll: () => Effect.Effect<ReadonlyArray<KoriEntity>>

  /**
   * Query entities with specific trait.
   */
  readonly queryWith: (traitId: TraitId) => Effect.Effect<ReadonlyArray<KoriEntity>>

  /**
   * Query entities without specific trait.
   */
  readonly queryWithout: (traitId: TraitId) => Effect.Effect<ReadonlyArray<KoriEntity>>

  /**
   * Add trait to entity. Validates data via Effect Schema.
   * Enforces uniqueness constraints on unique traits.
   */
  readonly addTrait: (
    entityId: EntityId,
    traitId: TraitId,
    data: unknown
  ) => Effect.Effect<void, AddTraitError>

  /**
   * Remove trait from entity.
   * Unregisters unique trait values from index.
   */
  readonly removeTrait: (
    entityId: EntityId,
    traitId: TraitId
  ) => Effect.Effect<void, RemoveTraitError>

  /**
   * Get trait data from entity.
   */
  readonly getTrait: <T>(
    entityId: EntityId,
    traitId: TraitId
  ) => Effect.Effect<T, EntityNotFound | EntityDestroyed | TraitMissing | WorldDisposed>

  /**
   * Set trait data on entity. Validates via Effect Schema.
   * Updates unique trait values in index (unregister old, register new).
   */
  readonly setTrait: (
    entityId: EntityId,
    traitId: TraitId,
    data: unknown
  ) => Effect.Effect<void, SetTraitError>

  /**
   * Lock the world for modifications.
   */
  readonly lock: (reason: string) => Effect.Effect<void>

  /**
   * Unlock the world.
   */
  readonly unlock: () => Effect.Effect<void>

  /**
   * Dispose the world (cleanup all entities).
   */
  readonly dispose: () => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KORI World service tag.
 */
export class KoriWorld extends Context.Tag("kori/World")<
  KoriWorld,
  KoriWorldOps
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a KORI World layer backed by koota.
 * Requires UniqueIndex service for unique trait enforcement.
 */
export const makeKoriWorld: Effect.Effect<KoriWorldOps, never, UniqueIndex> = Effect.gen(function* () {
  const uniqueIndex = yield* UniqueIndex
  const worldId = nanoid(12) as WorldId

  // Create the koota world
  const kootaWorld: World = createWorld()

  // Entity registry: maps our string EntityId → koota Entity + metadata
  const entityRegistry = new Map<string, {
    entity: Entity
    createdAt: Date
    isDestroyed: boolean
  }>()

  // World state
  let isDisposed = false
  let isLocked = false
  let lockReason: string | null = null

  /**
   * Guard against disposed world.
   */
  const guardDisposed: Effect.Effect<void, WorldDisposed> = Effect.suspend(() => {
    if (isDisposed) {
      return Effect.fail(new WorldDisposed({ worldId: worldId as string }))
    }
    return Effect.void
  })

  /**
   * Guard against locked world (for mutations).
   */
  const guardLocked: Effect.Effect<void, WorldLocked> = Effect.suspend(() => {
    if (isLocked) {
      return Effect.fail(
        new WorldLocked({
          worldId: worldId as string,
          reason: lockReason ?? "Unknown",
        })
      )
    }
    return Effect.void
  })

  /**
   * Validate trait data via Effect Schema.
   */
  const validateTraitData = (
    traitId: string,
    data: unknown
  ): Effect.Effect<unknown, TraitValidationFailed> => {
    const registry = TraitRegistry[traitId as RegisteredTraitId]
    if (!registry) {
      return Effect.fail(
        new TraitValidationFailed({
          traitId,
          reason: `Unknown trait: ${traitId}`,
          data,
        })
      )
    }

    return pipe(
      Schema.decodeUnknown(registry.schema)(data),
      Effect.mapError((parseError) =>
        new TraitValidationFailed({
          traitId,
          reason: `Validation failed: ${JSON.stringify(parseError.issue)}`,
          data,
        })
      )
    )
  }

  /**
   * Convert koota entity to KoriEntity snapshot.
   */
  const toSnapshot = (entityId: EntityId, entry: { entity: Entity; createdAt: Date; isDestroyed: boolean }): KoriEntity => {
    const traits = new Map<TraitId, unknown>()

    // Check each registered trait
    for (const [traitIdStr, registry] of Object.entries(TraitRegistry)) {
      const traitId = traitIdStr as TraitId
      if (entry.entity.has(registry.koota)) {
        const data = entry.entity.get(registry.koota)
        traits.set(traitId, data)
      }
    }

    return {
      id: entityId,
      worldId,
      traits,
      createdAt: entry.createdAt,
      isDestroyed: entry.isDestroyed,
      _kootaEntity: entry.entity,
    }
  }

  /**
   * Get entity entry or fail.
   */
  const getEntityOrFail = (
    entityId: EntityId
  ): Effect.Effect<{ entity: Entity; createdAt: Date; isDestroyed: boolean }, EntityNotFound | EntityDestroyed | WorldDisposed> =>
    pipe(
      guardDisposed,
      Effect.flatMap(() => {
        const entry = entityRegistry.get(entityId as string)
        if (!entry) {
          return Effect.fail(
            new EntityNotFound({ entityId: entityId as string, worldId: worldId as string })
          )
        }
        if (entry.isDestroyed) {
          return Effect.fail(new EntityDestroyed({ entityId: entityId as string }))
        }
        return Effect.succeed(entry)
      })
    )

  const ops: KoriWorldOps = {
    id: Effect.succeed(worldId),

    spawn: (traits = []) =>
      Effect.acquireRelease(
        // Acquire: create entity in koota, register, add traits
        pipe(
          guardDisposed,
          Effect.flatMap(() => guardLocked),
          Effect.flatMap(() =>
            Effect.gen(function* () {
              // Generate our string EntityId
              const entityId = nanoid(12) as EntityId

              // Phase 1: Validate ALL traits first (schema + uniqueness)
              const validatedTraits: Array<{ id: TraitId; data: unknown; validated: unknown }> = []
              for (const { id, data } of traits) {
                const registry = TraitRegistry[id as RegisteredTraitId]
                if (registry) {
                  // Validate schema
                  const validated = yield* validateTraitData(id as string, data)
                  // Validate uniqueness (check only, don't register yet)
                  yield* uniqueIndex.validateUnique(id, data, entityId as string)
                  validatedTraits.push({ id, data, validated })
                }
              }

              // Phase 2: Create entity and add traits (all validated)
              const kootaEntity = kootaWorld.spawn()
              const entry = {
                entity: kootaEntity,
                createdAt: new Date(),
                isDestroyed: false,
              }
              entityRegistry.set(entityId as string, entry)

              // Phase 3: Add traits and register unique values
              for (const { id, data, validated } of validatedTraits) {
                const registry = TraitRegistry[id as RegisteredTraitId]
                if (registry) {
                  kootaEntity.add(registry.koota)
                  kootaEntity.set(registry.koota, validated as Record<string, unknown>)
                  // Register unique value in index
                  yield* uniqueIndex.registerFromData(id, data, entityId as string)
                }
              }

              return toSnapshot(entityId, entry)
            })
          )
        ),
        // Release: destroy entity on scope close, unregister unique values
        (entity) =>
          pipe(
            uniqueIndex.unregisterEntity(entity.id as string),
            Effect.flatMap(() =>
              Effect.sync(() => {
                const entry = entityRegistry.get(entity.id as string)
                if (entry && !entry.isDestroyed) {
                  entry.isDestroyed = true
                  entry.entity.destroy()
                }
              })
            ),
            Effect.orDie
          )
      ),

    get: (entityId) =>
      pipe(
        getEntityOrFail(entityId),
        Effect.map((entry) => toSnapshot(entityId, entry))
      ),

    has: (entityId) =>
      pipe(
        guardDisposed,
        Effect.map(() => {
          const entry = entityRegistry.get(entityId as string)
          return entry !== undefined && !entry.isDestroyed
        }),
        Effect.orElse(() => Effect.succeed(false))
      ),

    destroy: (entityId) =>
      pipe(
        guardDisposed,
        Effect.flatMap(() => guardLocked),
        Effect.flatMap(() =>
          Effect.gen(function* () {
            const entry = entityRegistry.get(entityId as string)
            if (!entry) {
              yield* Effect.fail(
                new EntityNotFound({ entityId: entityId as string, worldId: worldId as string })
              )
              return
            }
            // Unregister all unique values for this entity
            yield* uniqueIndex.unregisterEntity(entityId as string)
            // Mark as destroyed
            entry.isDestroyed = true
            // Destroy in koota
            entry.entity.destroy()
          })
        ),
        Effect.catchTag("WorldLocked", () => Effect.void),
        Effect.catchTag("WorldDisposed", () => Effect.void)
      ),

    queryAll: () =>
      pipe(
        guardDisposed,
        Effect.map(() => {
          const results: KoriEntity[] = []
          for (const [id, entry] of entityRegistry) {
            if (!entry.isDestroyed) {
              results.push(toSnapshot(id as EntityId, entry))
            }
          }
          return results
        }),
        Effect.orElse(() => Effect.succeed([] as ReadonlyArray<KoriEntity>))
      ),

    queryWith: (traitId) =>
      pipe(
        guardDisposed,
        Effect.map(() => {
          const registry = TraitRegistry[traitId as RegisteredTraitId]
          if (!registry) return []

          const results: KoriEntity[] = []
          for (const [id, entry] of entityRegistry) {
            if (!entry.isDestroyed && entry.entity.has(registry.koota)) {
              results.push(toSnapshot(id as EntityId, entry))
            }
          }
          return results
        }),
        Effect.orElse(() => Effect.succeed([] as ReadonlyArray<KoriEntity>))
      ),

    queryWithout: (traitId) =>
      pipe(
        guardDisposed,
        Effect.map(() => {
          const registry = TraitRegistry[traitId as RegisteredTraitId]
          if (!registry) return []

          const results: KoriEntity[] = []
          for (const [id, entry] of entityRegistry) {
            if (!entry.isDestroyed && !entry.entity.has(registry.koota)) {
              results.push(toSnapshot(id as EntityId, entry))
            }
          }
          return results
        }),
        Effect.orElse(() => Effect.succeed([] as ReadonlyArray<KoriEntity>))
      ),

    addTrait: (entityId, traitId, data) =>
      pipe(
        guardLocked,
        Effect.flatMap(() => getEntityOrFail(entityId)),
        Effect.flatMap((entry) =>
          Effect.gen(function* () {
            const registry = TraitRegistry[traitId as RegisteredTraitId]
            if (!registry) {
              yield* Effect.fail(
                new TraitValidationFailed({
                  traitId: traitId as string,
                  reason: `Unknown trait: ${traitId}`,
                  data,
                })
              )
              return
            }

            if (entry.entity.has(registry.koota)) {
              yield* Effect.fail(
                new TraitAlreadyAttached({
                  entityId: entityId as string,
                  traitId: traitId as string,
                })
              )
              return
            }

            // Validate schema
            const validated = yield* validateTraitData(traitId as string, data)

            // Validate uniqueness (will fail if key already taken)
            yield* uniqueIndex.validateUnique(traitId, data, entityId as string)

            // Add trait to koota entity, then set the data
            entry.entity.add(registry.koota)
            entry.entity.set(registry.koota, validated as Record<string, unknown>)

            // Register unique value in index
            yield* uniqueIndex.registerFromData(traitId, data, entityId as string)
          })
        )
      ),

    removeTrait: (entityId, traitId) =>
      pipe(
        guardLocked,
        Effect.flatMap(() => getEntityOrFail(entityId)),
        Effect.flatMap((entry) =>
          Effect.gen(function* () {
            const registry = TraitRegistry[traitId as RegisteredTraitId]
            if (!registry) {
              yield* Effect.fail(
                new TraitMissing({
                  entityId: entityId as string,
                  traitId: traitId as string,
                })
              )
              return
            }

            if (!entry.entity.has(registry.koota)) {
              yield* Effect.fail(
                new TraitMissing({
                  entityId: entityId as string,
                  traitId: traitId as string,
                })
              )
              return
            }

            // Get current data to unregister unique value
            const currentData = entry.entity.get(registry.koota)

            // Unregister from unique index before removing
            yield* uniqueIndex.unregisterFromData(traitId, currentData)

            // Remove trait from koota entity
            entry.entity.remove(registry.koota)
          })
        )
      ),

    getTrait: <T>(entityId: EntityId, traitId: TraitId) =>
      pipe(
        getEntityOrFail(entityId),
        Effect.flatMap((entry) => {
          const registry = TraitRegistry[traitId as RegisteredTraitId]
          if (!registry || !entry.entity.has(registry.koota)) {
            return Effect.fail(
              new TraitMissing({
                entityId: entityId as string,
                traitId: traitId as string,
              })
            )
          }

          const data = entry.entity.get(registry.koota)
          return Effect.succeed(data as T)
        })
      ),

    setTrait: (entityId, traitId, data) =>
      pipe(
        guardLocked,
        Effect.flatMap(() => getEntityOrFail(entityId)),
        Effect.flatMap((entry) =>
          Effect.gen(function* () {
            const registry = TraitRegistry[traitId as RegisteredTraitId]
            if (!registry || !entry.entity.has(registry.koota)) {
              yield* Effect.fail(
                new TraitMissing({
                  entityId: entityId as string,
                  traitId: traitId as string,
                })
              )
              return
            }

            // Validate schema
            const validated = yield* validateTraitData(traitId as string, data)

            // Handle unique trait update: unregister old, validate new, register new
            if (isUniqueTrait(traitId)) {
              const oldData = entry.entity.get(registry.koota)
              // Unregister old value
              yield* uniqueIndex.unregisterFromData(traitId, oldData)
              // Validate new value (will fail if taken by another entity)
              yield* uniqueIndex.validateUnique(traitId, data, entityId as string)
              // Register new value
              yield* uniqueIndex.registerFromData(traitId, data, entityId as string)
            }

            // Update the trait data in koota
            entry.entity.set(registry.koota, validated as Record<string, unknown>)
          })
        )
      ),

    lock: (reason) =>
      Effect.sync(() => {
        isLocked = true
        lockReason = reason
      }),

    unlock: () =>
      Effect.sync(() => {
        isLocked = false
        lockReason = null
      }),

    dispose: () =>
      pipe(
        // Clear unique index first
        uniqueIndex.clearAll(),
        Effect.flatMap(() =>
          Effect.sync(() => {
            isDisposed = true
            // Destroy all entities in koota
            for (const [_, entry] of entityRegistry) {
              if (!entry.isDestroyed) {
                entry.entity.destroy()
              }
            }
            entityRegistry.clear()
          })
        )
      ),
  }

  return ops
})

/**
 * Default KORI World layer.
 * Provides UniqueIndex as a dependency.
 */
export const KoriWorldLive = Layer.effect(KoriWorld, makeKoriWorld).pipe(
  Layer.provide(UniqueIndexLive)
)
