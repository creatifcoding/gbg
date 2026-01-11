/**
 * ECS Base Entity Schema - Foundation for All Canonical Entities
 *
 * BaseEntity provides the common structure for all entities in the system.
 * Concrete entity types extend this with specific trait compositions.
 *
 * Pattern:
 * - BaseEntity contains provenance, lifecycle, and core identity
 * - Concrete entities extend BaseEntity and embed relevant traits
 * - Traits are optional fields, allowing flexible composition
 *
 * @module ecs/schemas/base
 */

import { Schema } from 'effect'
import { EntityId, EntityType } from './core'
import { EntityProvenance } from './provenance'

// =============================================================================
// Base Entity
// =============================================================================

/**
 * Base entity schema - all canonical entities extend this.
 *
 * Contains:
 * - Identity (id, entityType)
 * - Provenance (multi-source lineage)
 * - Lifecycle (created, updated, version)
 */
export class BaseEntity extends Schema.TaggedClass<BaseEntity>()(
  'BaseEntity',
  {
    /**
     * Unique entity identifier (type-prefixed UUID).
     */
    id: EntityId,

    /**
     * Entity type discriminator.
     * Used for routing, querying, and polymorphic handling.
     */
    entityType: EntityType,

    /**
     * Complete provenance metadata.
     * Tracks all sources, contributions, and confidence.
     */
    provenance: EntityProvenance,

    /**
     * Arbitrary metadata as key-value pairs.
     * Use for domain-specific extensions without schema changes.
     */
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
        Schema.annotations({
          description: 'Arbitrary key-value metadata for extensibility.',
        })
      ),
      { default: () => ({}) }
    ),
  },
  {
    identifier: 'BaseEntity',
    title: 'Base Entity',
    description: 'Foundation for all canonical entities. Provides identity, provenance, and extensible metadata.',
  }
) {
  /**
   * Get aggregate confidence score.
   */
  get confidence(): number {
    return this.provenance.aggregateConfidence as unknown as number
  }

  /**
   * Check if entity is stale.
   */
  get isStale(): boolean {
    return this.provenance.isStale
  }

  /**
   * Get revision number.
   */
  get revision(): number {
    return this.provenance.revision
  }

  /**
   * Get creation timestamp.
   */
  get createdAt(): Date {
    return this.provenance.createdAt
  }

  /**
   * Get last update timestamp.
   */
  get updatedAt(): Date {
    return this.provenance.updatedAt
  }
}

// =============================================================================
// Entity Factory Helpers
// =============================================================================

/**
 * Generate a new EntityId (UUID v4).
 * @deprecated Use EntityIdService.generate() instead
 */
export const generateEntityId = (): EntityId => {
  const uuid = crypto.randomUUID()
  return uuid as EntityId
}

/**
 * Parse a string as EntityId (with validation).
 * @deprecated Use EntityIdService.parse() instead
 */
export const parseEntityId = (id: string): EntityId => {
  return Schema.decodeSync(EntityId)(id)
}
