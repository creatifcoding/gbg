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
 */
export const UpdatedAt = Model.DateTimeUpdateFromDate

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { Model }
