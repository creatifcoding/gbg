/**
 * Entity Atom Factory Service
 *
 * Effect.Service that creates atom families from EntitySpecs.
 * The "factory of factories" for reactive entity state.
 *
 * Pattern:
 *   EntitySpec (NATS KV) → EntityAtomFactory → Atom.family → Entity Atoms
 *
 * @module kori/services/entity-atoms
 */

import { Effect, Context, Layer, Ref, Option, pipe, Stream } from 'effect'
import { Atom, Registry } from '@effect-atom/atom'
import type { Writable } from '@effect-atom/atom/Atom'

import { EntitySpecService } from './entity-spec'
import type { KoriStorageError } from './storage'
import {
  EntitySpec,
  type EntityTypeId,
} from '../schemas/entity-spec'
import {
  DynamicEntity,
  createDynamicEntityFactory,
  toEntityId,
  type DynamicEntityFactory,
  type EntityId,
} from '../schemas/tagged-entity'
import type { TraitId } from '../schemas/trait'

// =============================================================================
// Atom Types
// =============================================================================

/**
 * Atom family key for entity lookup.
 */
export type EntityAtomKey = `${string}:${string}` // entityTypeId:entityId

/**
 * Per-entity atom bundle.
 * Contains atoms for the entity and each of its traits.
 */
export interface EntityAtoms {
  /** Full entity atom */
  readonly entityAtom: Writable<DynamicEntity | null, DynamicEntity | null>

  /** Individual trait atoms keyed by TraitId */
  readonly traitAtoms: ReadonlyMap<string, Writable<unknown, unknown>>

  /** Entity metadata */
  readonly metadata: {
    readonly entityTypeId: string
    readonly entityId: string
    readonly createdAt: number
  }

  /** Update a specific trait */
  readonly setTrait: (traitId: string, value: unknown) => void

  /** Get current entity state */
  readonly getEntity: () => DynamicEntity | null

  /** Dispose all atoms */
  readonly dispose: () => void
}

/**
 * Entity type atom bundle.
 * Contains atoms for a specific entity type (all instances).
 */
export interface EntityTypeAtoms {
  /** Spec this was created from */
  readonly spec: EntitySpec

  /** Factory for creating entities of this type */
  readonly factory: DynamicEntityFactory

  /** All entity IDs of this type */
  readonly entityIds: Set<string>

  /** Get or create atoms for an entity instance */
  readonly getEntityAtoms: (entityId: string) => EntityAtoms

  /** Check if entity exists */
  readonly hasEntity: (entityId: string) => boolean

  /** Remove entity atoms */
  readonly removeEntity: (entityId: string) => void

  /** Clear all entities of this type */
  readonly clear: () => void

  /** Get entity count */
  readonly count: () => number
}

// =============================================================================
// Service Shape
// =============================================================================

/**
 * EntityAtomFactory service shape.
 */
export interface EntityAtomFactoryShape {
  /**
   * Get or create atom bundle for an entity type.
   * Lazily creates from spec if not cached.
   */
  readonly getTypeAtoms: (
    entityTypeId: EntityTypeId
  ) => Effect.Effect<EntityTypeAtoms | null, never>

  /**
   * Get or create atoms for a specific entity instance.
   */
  readonly getEntityAtoms: (
    entityTypeId: EntityTypeId,
    entityId: string
  ) => Effect.Effect<EntityAtoms | null, never>

  /**
   * Create a new entity with atoms.
   * Returns the created entity and its atoms.
   */
  readonly spawnEntity: (
    entityTypeId: EntityTypeId,
    traitOverrides?: Record<string, unknown>
  ) => Effect.Effect<{ entity: DynamicEntity; atoms: EntityAtoms } | null, never>

  /**
   * Remove an entity and its atoms.
   */
  readonly despawnEntity: (
    entityTypeId: EntityTypeId,
    entityId: string
  ) => Effect.Effect<boolean, never>

  /**
   * List all entity type IDs with active atoms.
   */
  readonly listActiveTypes: () => Effect.Effect<ReadonlyArray<EntityTypeId>, never>

  /**
   * Get stats about active atoms.
   */
  readonly getStats: () => Effect.Effect<AtomFactoryStats, never>
}

/**
 * Statistics about the atom factory.
 */
export interface AtomFactoryStats {
  readonly typeCount: number
  readonly entityCount: number
  readonly atomCount: number
  readonly activeTypes: ReadonlyArray<{
    entityTypeId: string
    entityCount: number
  }>
}

// =============================================================================
// Service Tag
// =============================================================================

/**
 * EntityAtomFactory service tag.
 */
export class EntityAtomFactory extends Context.Tag('kori/EntityAtomFactory')<
  EntityAtomFactory,
  EntityAtomFactoryShape
>() {}

// =============================================================================
// Internal: Module-level Registry for Synchronous Atom Access
// =============================================================================

/**
 * Module-level registry for synchronous atom operations.
 * This is the "atom store" for entity atoms.
 */
const entityRegistry = Registry.make()

// =============================================================================
// Internal: Create Entity Atoms
// =============================================================================

/**
 * Create atoms for a single entity instance.
 */
function createEntityAtoms(
  spec: EntitySpec,
  entityId: string,
  initialEntity: DynamicEntity | null
): EntityAtoms {
  // Main entity atom
  const entityAtom = Atom.make<DynamicEntity | null>(initialEntity)

  // Per-trait atoms
  const traitAtoms = new Map<string, Writable<unknown, unknown>>()
  for (const traitReq of spec.traits) {
    const traitId = traitReq.traitId as string
    const initialValue = initialEntity?.traits[traitId] ?? null
    traitAtoms.set(traitId, Atom.make(initialValue))
  }

  const atoms: EntityAtoms = {
    entityAtom,
    traitAtoms,

    metadata: {
      entityTypeId: spec.entityTypeId as string,
      entityId,
      createdAt: Date.now(),
    },

    setTrait: (traitId, value) => {
      // Update trait atom via registry
      const traitAtom = traitAtoms.get(traitId)
      if (traitAtom) {
        entityRegistry.set(traitAtom, value)
      }

      // Update entity atom via registry
      entityRegistry.update(entityAtom, (entity) => {
        if (!entity) return entity
        return {
          ...entity,
          traits: {
            ...entity.traits,
            [traitId]: value,
          },
          updatedAt: Date.now(),
        }
      })
    },

    getEntity: () => entityRegistry.get(entityAtom),

    dispose: () => {
      // Clear atoms via registry
      entityRegistry.set(entityAtom, null)
      for (const traitAtom of Array.from(traitAtoms.values())) {
        entityRegistry.set(traitAtom, null)
      }
    },
  }

  return atoms
}

/**
 * Create atom bundle for an entity type.
 */
function createEntityTypeAtoms(
  spec: EntitySpec,
  factory: DynamicEntityFactory
): EntityTypeAtoms {
  // Track all entity IDs
  const entityIds = new Set<string>()

  // Cache entity atoms
  const entityAtomsCache = new Map<string, EntityAtoms>()

  const typeAtoms: EntityTypeAtoms = {
    spec,
    factory,
    entityIds,

    getEntityAtoms: (entityId) => {
      // Return cached if exists
      const cached = entityAtomsCache.get(entityId)
      if (cached) return cached

      // Create new atoms (entity doesn't exist yet)
      const atoms = createEntityAtoms(spec, entityId, null)
      entityAtomsCache.set(entityId, atoms)
      entityIds.add(entityId)

      return atoms
    },

    hasEntity: (entityId) => entityAtomsCache.has(entityId),

    removeEntity: (entityId) => {
      const atoms = entityAtomsCache.get(entityId)
      if (atoms) {
        atoms.dispose()
        entityAtomsCache.delete(entityId)
        entityIds.delete(entityId)
      }
    },

    clear: () => {
      for (const atoms of entityAtomsCache.values()) {
        atoms.dispose()
      }
      entityAtomsCache.clear()
      entityIds.clear()
    },

    count: () => entityIds.size,
  }

  return typeAtoms
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Live implementation of EntityAtomFactory.
 */
export const EntityAtomFactoryLive = Layer.effect(
  EntityAtomFactory,
  Effect.gen(function* () {
    const specService = yield* EntitySpecService

    // Cache of type atoms
    const typeAtomsCache = new Map<string, EntityTypeAtoms>()

    /**
     * Get or create type atoms from spec.
     */
    const ensureTypeAtoms = (
      entityTypeId: EntityTypeId
    ): Effect.Effect<EntityTypeAtoms | null, never> =>
      Effect.gen(function* () {
        // Check cache
        const cached = typeAtomsCache.get(entityTypeId as string)
        if (cached) return cached

        // Get factory from spec service
        const factory = yield* pipe(
          specService.getFactory(entityTypeId),
          Effect.catchAll(() => Effect.succeed(null))
        )
        if (!factory) return null

        // Create type atoms
        const typeAtoms = createEntityTypeAtoms(factory.spec, factory)

        // Cache it
        typeAtomsCache.set(entityTypeId as string, typeAtoms)

        return typeAtoms
      })

    const service: EntityAtomFactoryShape = {
      getTypeAtoms: ensureTypeAtoms,

      getEntityAtoms: (entityTypeId, entityId) =>
        Effect.gen(function* () {
          const typeAtoms = yield* ensureTypeAtoms(entityTypeId)
          if (!typeAtoms) return null
          return typeAtoms.getEntityAtoms(entityId)
        }),

      spawnEntity: (entityTypeId, traitOverrides) =>
        Effect.gen(function* () {
          const typeAtoms = yield* ensureTypeAtoms(entityTypeId)
          if (!typeAtoms) return null

          // Create entity via factory
          const entity = yield* typeAtoms.factory.spawn(traitOverrides)

          // Get/create atoms and populate with entity
          const atoms = typeAtoms.getEntityAtoms(entity.id as string)
          entityRegistry.set(atoms.entityAtom, entity)

          // Sync trait atoms
          for (const [traitId, value] of Object.entries(entity.traits)) {
            const traitAtom = atoms.traitAtoms.get(traitId)
            if (traitAtom) {
              entityRegistry.set(traitAtom, value)
            }
          }

          return { entity, atoms }
        }),

      despawnEntity: (entityTypeId, entityId) =>
        Effect.gen(function* () {
          const typeAtoms = typeAtomsCache.get(entityTypeId as string)
          if (!typeAtoms) return false

          if (typeAtoms.hasEntity(entityId)) {
            typeAtoms.removeEntity(entityId)
            return true
          }
          return false
        }),

      listActiveTypes: () =>
        Effect.succeed(Array.from(typeAtomsCache.keys()) as EntityTypeId[]),

      getStats: () =>
        Effect.sync(() => {
          let entityCount = 0
          let atomCount = 0
          const activeTypes: Array<{ entityTypeId: string; entityCount: number }> = []

          for (const [typeId, typeAtoms] of typeAtomsCache) {
            const count = typeAtoms.count()
            entityCount += count
            atomCount += count * (1 + typeAtoms.spec.traits.length) // entity + traits
            activeTypes.push({
              entityTypeId: typeId,
              entityCount: count,
            })
          }

          return {
            typeCount: typeAtomsCache.size,
            entityCount,
            atomCount,
            activeTypes,
          }
        }),
    }

    return service
  })
)

// =============================================================================
// Convenience Layers
// =============================================================================

/**
 * Full layer with EntitySpecService dependency.
 */
export const EntityAtomFactoryLayer = EntityAtomFactoryLive

/**
 * Mock layer for testing.
 */
export const EntityAtomFactoryMock = Layer.succeed(
  EntityAtomFactory,
  {
    getTypeAtoms: () => Effect.succeed(null),
    getEntityAtoms: () => Effect.succeed(null),
    spawnEntity: () => Effect.succeed(null),
    despawnEntity: () => Effect.succeed(false),
    listActiveTypes: () => Effect.succeed([]),
    getStats: () =>
      Effect.succeed({
        typeCount: 0,
        entityCount: 0,
        atomCount: 0,
        activeTypes: [],
      }),
  } satisfies EntityAtomFactoryShape
)

// =============================================================================
// Operation Helpers
// =============================================================================

/**
 * Operation effects for entity management.
 */
export const entityOps = {
  /**
   * Spawn a new entity of a given type.
   */
  spawn: (entityTypeId: EntityTypeId, traitOverrides?: Record<string, unknown>) =>
    Effect.gen(function* () {
      const factory = yield* EntityAtomFactory
      return yield* factory.spawnEntity(entityTypeId, traitOverrides)
    }),

  /**
   * Despawn an entity.
   */
  despawn: (entityTypeId: EntityTypeId, entityId: string) =>
    Effect.gen(function* () {
      const factory = yield* EntityAtomFactory
      return yield* factory.despawnEntity(entityTypeId, entityId)
    }),

  /**
   * Get stats.
   */
  stats: () =>
    Effect.gen(function* () {
      const factory = yield* EntityAtomFactory
      return yield* factory.getStats()
    }),
}
