/**
 * SIOS — Common Schema Types
 *
 * Shared field spreads and base types used across all SIOS entities.
 * Equivalent to IIoT's BaseAssetFields — spread into every entity TaggedClass.
 *
 * API references (verified via effect-docs):
 *   Schema.TaggedClass<Self>()("Tag", { ...fields }) — adds _tag field + methods
 *   Schema.optionalWith(schema, { as: 'Option' }) — maps to Option<T> in Type
 *   Schema.DateTimeUtc — Effect DateTime type for timestamps
 *
 * @module sios/schemas/common/types
 */

import { Schema } from 'effect'

// =============================================================================
// Metadata
// =============================================================================

/** Extensible metadata for custom attributes. Stored as JSONB in the database. */
export const SiosMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type SiosMetadata = typeof SiosMetadata.Type

// =============================================================================
// Base Fields — spread into every entity TaggedClass
// =============================================================================

/**
 * Common fields shared by all SIOS entities.
 *
 * Usage pattern (from IIoT's BaseAssetFields):
 * ```typescript
 * class WorkPackage extends Schema.TaggedClass<WorkPackage>()('WorkPackage', {
 *   id: WorkPackageId,
 *   ...BaseSiosFields,
 *   // entity-specific fields...
 * }) {
 *   // entity methods...
 * }
 * ```
 *
 * Timestamps use Schema.DateTimeUtc (Effect DateTime).
 * updatedAt uses { as: 'Option' } — absent until first mutation.
 * metadata defaults to {} if not provided.
 */
export const BaseSiosFields = {
  /** Timestamp when entity was created */
  createdAt: Schema.DateTimeUtc,
  /** Timestamp of last update — Option.none() until first mutation */
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** Extensible metadata for custom attributes (JSONB in DB) */
  metadata: Schema.optionalWith(SiosMetadata, { default: () => ({}) }),
} as const
