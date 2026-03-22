/**
 * Tagged Entity Schema
 *
 * Extends Schema.TaggedClass pattern for kori entities.
 * Entities are Schema-backed with trait composition metadata.
 *
 * Pattern: Factory of factories — defineEntity() returns an entity factory
 * that produces instances with spec-driven trait composition.
 *
 * @module kori/schemas/tagged-entity
 */

import { Schema, Effect } from 'effect'
import type { ParseResult } from 'effect'
import type { TraitId } from './trait'
import type { EntitySpec, EntityTypeId } from './entity-spec'

// =============================================================================
// Core Types
// =============================================================================

/**
 * Entity instance ID — simple branded string for kori entities.
 */
export const EntityIdSchema = Schema.String.pipe(
  Schema.brand('EntityId'),
  Schema.minLength(1),
  Schema.annotations({
    identifier: '@gbg/kori/EntityId',
    description: 'Unique entity identifier within a kori World',
  })
)
export type EntityId = typeof EntityIdSchema.Type

/**
 * Convert a string to EntityId (for spawning).
 */
export const toEntityId = (id: string): EntityId => id as EntityId

/**
 * EntityTypeId schema.
 */
export const EntityTypeIdSchema = Schema.String.pipe(
  Schema.brand('EntityTypeId'),
  Schema.minLength(1)
)

/**
 * Base fields present on all entities.
 */
export const EntityBase = Schema.Struct({
  /** Unique entity ID */
  id: EntityIdSchema,

  /** Entity type (references EntitySpec.entityTypeId) */
  entityTypeId: EntityTypeIdSchema,

  /** Timestamp when entity was created */
  createdAt: Schema.Number,

  /** Timestamp when entity was last modified */
  updatedAt: Schema.Number,
})
export type EntityBase = typeof EntityBase.Type

// =============================================================================
// Tagged Entity Factory
// =============================================================================

/**
 * Configuration for defining a tagged entity.
 */
export interface DefineEntityConfig<Tag extends string> {
  /** Entity tag (becomes _tag field) */
  readonly tag: Tag

  /** Entity type ID (for spec lookup) */
  readonly entityTypeId: EntityTypeId

  /** Whether this entity type is singleton */
  readonly singleton?: boolean
}

// =============================================================================
// Dynamic Entity Factory (Spec-Driven)
// =============================================================================

/**
 * Dynamic entity instance — traits stored as Map for runtime flexibility.
 */
export const DynamicEntity = Schema.TaggedStruct('DynamicEntity', {
  /** Unique entity ID */
  id: EntityIdSchema,

  /** Entity type ID (references EntitySpec) */
  entityTypeId: Schema.String.pipe(Schema.brand('EntityTypeId')),

  /** Trait data keyed by TraitId */
  traits: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** Creation timestamp */
  createdAt: Schema.Number,

  /** Last update timestamp */
  updatedAt: Schema.Number,
})
export type DynamicEntity = typeof DynamicEntity.Type

/**
 * Dynamic entity factory — creates entities from EntitySpec at runtime.
 */
export interface DynamicEntityFactory {
  /** The spec this factory was created from */
  readonly spec: EntitySpec

  /** Create a new entity with trait defaults */
  readonly make: (
    id: string,
    traitOverrides?: Record<string, unknown>
  ) => DynamicEntity

  /** Spawn with auto-generated ID */
  readonly spawn: (
    traitOverrides?: Record<string, unknown>
  ) => Effect.Effect<DynamicEntity, never>

  /** Validate trait data against spec */
  readonly validateTraits: (
    traits: Record<string, unknown>
  ) => Effect.Effect<Record<string, unknown>, ParseResult.ParseError>

  /** Get default trait values from spec */
  readonly getDefaults: () => Record<string, unknown>
}

/**
 * Create a dynamic entity factory from an EntitySpec.
 *
 * This is the "factory factory" — given a spec, produces a factory.
 *
 * @example
 * ```ts
 * const spec = await loadSpecFromNats('scene3d_entity')
 * const factory = createDynamicEntityFactory(spec)
 *
 * // Create entity with defaults
 * const entity = factory.make('entity-1')
 *
 * // Create entity with overrides
 * const customEntity = factory.make('entity-2', {
 *   Position3D: { x: 10, y: 20, z: 30 },
 * })
 * ```
 */
export function createDynamicEntityFactory(
  spec: EntitySpec
): DynamicEntityFactory {
  // Extract defaults from spec
  const getDefaults = (): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {}
    for (const req of spec.traits) {
      if (req.defaults) {
        defaults[req.traitId as string] = {
          _tag: req.traitId,
          ...req.defaults,
        }
      }
    }
    return defaults
  }

  const factory: DynamicEntityFactory = {
    spec,

    make: (id, traitOverrides = {}) => {
      const now = Date.now()
      const defaults = getDefaults()

      // Merge defaults with overrides
      const traits: Record<string, unknown> = { ...defaults }
      for (const [traitId, data] of Object.entries(traitOverrides)) {
        if (defaults[traitId]) {
          // Merge with defaults
          traits[traitId] = { ...(defaults[traitId] as object), ...data as object }
        } else {
          traits[traitId] = data
        }
      }

      return {
        _tag: 'DynamicEntity',
        id: toEntityId(id),
        entityTypeId: spec.entityTypeId,
        traits,
        createdAt: now,
        updatedAt: now,
      }
    },

    spawn: (traitOverrides) =>
      Effect.sync(() => {
        const id = `${spec.entityTypeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        return factory.make(id, traitOverrides)
      }),

    validateTraits: (traits) => {
      // TODO: Validate each trait against its schema from registry
      // For now, passthrough
      return Effect.succeed(traits)
    },

    getDefaults,
  }

  return factory
}

// =============================================================================
// Entity Factory Registry
// =============================================================================

/**
 * Registry of dynamic entity factories keyed by entityTypeId.
 * The "factory of factories" pattern — stores all factories for lookup.
 */
export class EntityFactoryRegistry {
  private factories = new Map<string, DynamicEntityFactory>()

  /**
   * Register a factory for an entity type.
   */
  register(factory: DynamicEntityFactory): void {
    this.factories.set(factory.spec.entityTypeId as string, factory)
  }

  /**
   * Get factory for an entity type.
   */
  get(entityTypeId: string): DynamicEntityFactory | undefined {
    return this.factories.get(entityTypeId)
  }

  /**
   * Check if factory exists.
   */
  has(entityTypeId: string): boolean {
    return this.factories.has(entityTypeId)
  }

  /**
   * List all registered entity types.
   */
  list(): ReadonlyArray<string> {
    return Array.from(this.factories.keys())
  }

  /**
   * Create factory from spec and register it.
   */
  registerFromSpec(spec: EntitySpec): DynamicEntityFactory {
    const factory = createDynamicEntityFactory(spec)
    this.register(factory)
    return factory
  }

  /**
   * Clear all factories.
   */
  clear(): void {
    this.factories.clear()
  }
}

/**
 * Global entity factory registry.
 */
export const entityFactoryRegistry = new EntityFactoryRegistry()
