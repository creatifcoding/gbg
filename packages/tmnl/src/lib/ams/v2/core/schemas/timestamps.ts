/**
 * AMS v2 Timestamp Fields
 *
 * Standardized temporal fields for entities.
 *
 * @module @gbg/tmnl/ams/v2/core/schemas/timestamps
 */

import { Schema } from 'effect'

export const CreatedAt = Schema.DateTimeUtc.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Entity/fields/CreatedAt'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/CreatedAt',
    description: 'Timestamp when entity was created',
  })
)
export type CreatedAt = typeof CreatedAt.Type

export const UpdatedAt = Schema.DateTimeUtc.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Entity/fields/UpdatedAt'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/UpdatedAt',
    description: 'Timestamp when entity was last updated',
  })
)
export type UpdatedAt = typeof UpdatedAt.Type
