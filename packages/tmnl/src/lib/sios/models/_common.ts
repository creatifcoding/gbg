/**
 * SIOS Models — Common Transforms
 *
 * Shared transforms for Model.Class definitions.
 * Adapted from IIoT's _common.ts for SIOS-specific JSONB shapes.
 *
 * @module sios/models/_common
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'

// =============================================================================
// NUMERIC Column Transform
// =============================================================================

/**
 * PostgreSQL NUMERIC columns return strings to preserve precision.
 * Accepts both string and number inputs, normalizes to number.
 */
export const NumericFromPg = Schema.Union(Schema.Number, Schema.NumberFromString)

/** Optional NUMERIC field — handles NULL + string-to-number */
export const OptionalNumeric = Model.FieldOption(NumericFromPg)

// =============================================================================
// Metadata
// =============================================================================

export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/** Optional JSONB metadata — pg driver returns parsed objects */
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

// =============================================================================
// Timestamps
// =============================================================================

/** DateTime set on insert (created_at) */
export const CreatedAt = Model.DateTimeInsertFromDate

/** Nullable DateTime for updated_at (NULL until first update) */
export const UpdatedAtNullable = Model.FieldOption(Schema.DateFromSelf)

// =============================================================================
// JSONB Helpers
// =============================================================================

/** JSONB stored as text — wraps schema for JSON stringify/parse */
export const JsonFromString = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Model.JsonFromString(schema)

/** Optional nullable helper — NULL in DB maps to undefined */
export const optionalNullable = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.optionalWith(schema, { nullable: true })

// =============================================================================
// Re-export Model for convenience
// =============================================================================

export { Model }
