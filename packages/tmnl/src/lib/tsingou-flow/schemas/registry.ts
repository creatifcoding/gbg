/**
 * Schema Registry Types
 *
 * Runtime schema registry for dynamic signal types stored in NATS KV buckets.
 * Known signal types get compile-time schemas; unknown types get validated
 * dynamically against registry entries.
 *
 * @see NatsKVService (src/lib/nats/NatsKVService.ts) — underlying KV operations
 * @module tsingou-flow/schemas/registry
 */

import { Schema } from 'effect'

// =============================================================================
// Schema Registry Entry
// =============================================================================

/**
 * A registered schema in the NATS KV bucket `tsingou-schemas`.
 *
 * Key:   signal kind string (e.g. "custom-sensor-xyz")
 * Value: This struct, JSON-encoded
 */
export const SchemaRegistryEntry = Schema.Struct({
  /** Signal kind this schema validates */
  kind: Schema.String.pipe(Schema.minLength(1)),

  /** Schema version (monotonically increasing) */
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),

  /**
   * Serialized schema definition.
   * Stored as JSON Schema output from Schema.JSONSchema.make().
   * Used for runtime validation of dynamic signal payloads.
   */
  jsonSchema: Schema.Unknown,

  /** Human-readable description */
  description: Schema.optional(Schema.String),

  /** When this schema version was registered */
  createdAt: Schema.DateFromSelf,

  /** Who registered this schema (adapter ID, user, system) */
  createdBy: Schema.String,

  /** Whether this schema version is deprecated */
  deprecated: Schema.optional(Schema.Boolean),

  /** Optional: previous schema version for migration reference */
  previousVersion: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  ),
})
export type SchemaRegistryEntry = typeof SchemaRegistryEntry.Type

// =============================================================================
// Schema Compatibility
// =============================================================================

export const SchemaCompatibility = Schema.Literal(
  'backward',      // New schema can read old data
  'forward',       // Old schema can read new data
  'full',          // Both directions
  'none',          // No compatibility check
)
export type SchemaCompatibility = typeof SchemaCompatibility.Type
