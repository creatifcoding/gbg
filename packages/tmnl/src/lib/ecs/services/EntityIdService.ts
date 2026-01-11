/**
 * EntityIdService - Unique Entity Identifier Generation
 *
 * Generates type-prefixed UUIDs for canonical entities.
 * Uses Effect.Service pattern with accessors for convenient access.
 *
 * @module ecs/services/EntityIdService
 */

import { Effect, Schema } from 'effect'
import { EntityId, EntityType } from '../schemas/core'

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error parsing an entity ID
 */
export class EntityIdParseError extends Schema.TaggedError<EntityIdParseError>()(
  'EntityIdParseError',
  {
    input: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// Helper Functions (pure, no service dependency)
// =============================================================================

const VALID_TYPES: readonly EntityType[] = [
  'flight',
  'poi',
  'track',
  'weather',
  'imagery',
  'feature',
  'vessel',
  'vehicle',
]

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const parseEntityIdImpl = (
  id: string
): Effect.Effect<{ type: EntityType; uuid: string }, EntityIdParseError> =>
  Effect.gen(function* () {
    const dashIndex = id.indexOf('-')

    if (dashIndex === -1) {
      return yield* Effect.fail(
        new EntityIdParseError({
          input: id,
          message: 'Invalid EntityId format: missing type prefix',
        })
      )
    }

    const typeCandidate = id.substring(0, dashIndex)
    const uuid = id.substring(dashIndex + 1)

    if (!VALID_TYPES.includes(typeCandidate as EntityType)) {
      return yield* Effect.fail(
        new EntityIdParseError({
          input: id,
          message: `Invalid entity type: ${typeCandidate}`,
        })
      )
    }

    if (!UUID_REGEX.test(uuid)) {
      return yield* Effect.fail(
        new EntityIdParseError({
          input: id,
          message: `Invalid UUID format: ${uuid}`,
        })
      )
    }

    return { type: typeCandidate as EntityType, uuid }
  })

const getTypeImpl = (id: EntityId): EntityType => {
  const dashIndex = id.indexOf('-')
  return id.substring(0, dashIndex) as EntityType
}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * EntityIdService - generates and parses entity identifiers.
 *
 * Usage:
 * ```typescript
 * const id = yield* EntityIdService.generate('flight')
 * const { type, uuid } = yield* EntityIdService.parse(id)
 * ```
 */
export class EntityIdService extends Effect.Service<EntityIdService>()(
  'ecs/EntityIdService',
  {
    accessors: true,
    sync: () => ({
      /**
       * Generate a new EntityId with the given type prefix.
       */
      generate: (entityType: EntityType): Effect.Effect<EntityId> =>
        Effect.sync(() => {
          const uuid = crypto.randomUUID()
          return `${entityType}-${uuid}` as EntityId
        }),

      /**
       * Parse an EntityId to extract its components.
       */
      parse: parseEntityIdImpl,

      /**
       * Validate that a string is a valid EntityId.
       */
      validate: (id: string): Effect.Effect<boolean, EntityIdParseError> =>
        parseEntityIdImpl(id).pipe(Effect.map(() => true)),

      /**
       * Extract just the type from an EntityId (fast path).
       */
      getType: getTypeImpl,
    }),
  }
) {}
