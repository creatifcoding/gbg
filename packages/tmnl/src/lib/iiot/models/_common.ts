/**
 * IIoT Models Common Transforms
 *
 * Shared transforms for Model.Class definitions.
 * These handle PostgreSQL-specific type conversions.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'

// =============================================================================
// NUMERIC Column Transform
// =============================================================================

/**
 * PostgreSQL NUMERIC columns return strings to preserve precision.
 * This schema accepts both string and number inputs, normalizes to number.
 *
 * Uses Schema.Union(Number, NumberFromString) per Effect-TS best practices.
 */
export const NumericFromPg = Schema.Union(Schema.Number, Schema.NumberFromString)

/**
 * Optional NUMERIC field - handles NULL and string-to-number conversion.
 */
export const OptionalNumeric = Model.FieldOption(NumericFromPg)

// =============================================================================
// JSON Transforms
// =============================================================================

/**
 * JSONB stored as text in PostgreSQL (for TEXT columns storing JSON).
 * Wraps a schema to handle JSON stringify/parse.
 * NOTE: For actual JSONB columns, pg driver returns parsed objects - use schema directly.
 */
export const JsonFromString = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Model.JsonFromString(schema)

/**
 * Metadata record schema for arbitrary key-value storage.
 */
export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/**
 * Optional nullable metadata field for JSONB columns.
 * NOTE: pg driver returns JSONB as parsed objects, not strings.
 * So we use the schema directly, not JsonFromString.
 */
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

// =============================================================================
// Optional with Nullable
// =============================================================================

/**
 * Helper for optional fields that are NULL in the database.
 * Maps NULL → undefined on read, undefined → NULL on write.
 */
export const optionalNullable = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.optionalWith(schema, { nullable: true })

// =============================================================================
// Timestamp Helpers
// =============================================================================

/**
 * DateTime that's set on insert (created_at pattern).
 * Uses Model.DateTimeInsertFromDate for pg driver Date objects.
 */
export const CreatedAt = Model.DateTimeInsertFromDate

/**
 * DateTime that's updated on each modification (updated_at pattern).
 * Uses Model.DateTimeUpdateFromDate for pg driver Date objects.
 *
 * @deprecated Use UpdatedAtNullable for nullable updated_at columns
 */
export const UpdatedAt = Model.DateTimeUpdateFromDate

/**
 * Nullable DateTime for updated_at columns.
 * Handles NULL values from DB when record hasn't been updated yet.
 * Uses DateFromSelf to match pg driver's native Date return type.
 */
export const UpdatedAtNullable = Model.FieldOption(Schema.DateFromSelf)

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { Model }
