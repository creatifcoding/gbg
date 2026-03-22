/**
 * Genifer Models — Shared transforms for Model.Class definitions
 *
 * Reuses iiot patterns: CreatedAt, UpdatedAt, OptionalMetadata, NumericFromPg.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'

// =============================================================================
// Numeric
// =============================================================================

/** PostgreSQL NUMERIC → number (pg returns strings for precision) */
export const NumericFromPg = Schema.Union(Schema.Number, Schema.NumberFromString)

// =============================================================================
// Timestamps
// =============================================================================

/** created_at: set on insert, read as Date */
export const CreatedAt = Model.DateTimeInsertFromDate

/** updated_at: set on insert + update, read as Date */
export const UpdatedAt = Model.DateTimeUpdateFromDate

// =============================================================================
// JSONB
// =============================================================================

/** Arbitrary metadata record (JSONB column, pg returns parsed objects) */
export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })

/** Optional nullable metadata */
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

// =============================================================================
// Identifiers
// =============================================================================

/** UUID branded type for genifer entities */
export const GeniferTreeId = Schema.String.pipe(Schema.brand("GeniferTreeId"))
export type GeniferTreeId = typeof GeniferTreeId.Type

export const GeniferElementId = Schema.String.pipe(Schema.brand("GeniferElementId"))
export type GeniferElementId = typeof GeniferElementId.Type

export const GeniferCompositeId = Schema.String.pipe(Schema.brand("GeniferCompositeId"))
export type GeniferCompositeId = typeof GeniferCompositeId.Type

export const GeniferSignalId = Schema.String.pipe(Schema.brand("GeniferSignalId"))
export type GeniferSignalId = typeof GeniferSignalId.Type

// =============================================================================
// Enums
// =============================================================================

export const SignalTargetType = Schema.Literal("element", "tree", "composite")
export type SignalTargetType = typeof SignalTargetType.Type

export const SignalType = Schema.Literal(
  "pipeline_score", "human_rating", "usage",
  "repair", "reuse", "promote", "deprecate"
)
export type SignalType = typeof SignalType.Type

export const CompositeCreator = Schema.Literal("system", "agent", "human")
export type CompositeCreator = typeof CompositeCreator.Type

// =============================================================================
// Re-exports
// =============================================================================

export { Model }
