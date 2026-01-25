/**
 * Model Decoding & Encoding Utilities
 *
 * Generic functions for transforming SQL results through Model schemas
 * and preparing update objects for sql.update() helper.
 *
 * Decoding: Raw SQL results → Model types (null → Option.none())
 * Encoding: Model update objects → sql.update() compatible (Option → null/value)
 *
 * @module
 */

import { Effect, Schema, Option, ParseResult } from 'effect'

// =============================================================================
// Update Object Transformation
// =============================================================================

/**
 * Transform an update object for use with sql.update().
 *
 * Converts Option fields to their primitive form:
 * - undefined → undefined (sql.update skips these)
 * - Option.none() → null (sets DB field to NULL)
 * - Option.some(v) → v (sets DB field to value)
 *
 * Non-Option fields are passed through as-is.
 *
 * @example
 * ```ts
 * const changes = prepareUpdate({
 *   id: 'foo',
 *   name: 'New Name',           // string → string
 *   model: Option.none(),       // Option.none() → null
 *   description: Option.some('x') // Option.some('x') → 'x'
 *   // location: undefined      // omitted → sql.update skips
 * })
 * sql`UPDATE t SET ${sql.update(changes, ['id'])} WHERE id = ${id}`
 * ```
 */
export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      // Skip undefined - sql.update will omit this field
      continue
    }

    if (Option.isOption(value)) {
      // Convert Option to primitive: none → null, some → value
      result[key] = Option.getOrNull(value)
    } else {
      // Pass through non-Option values as-is
      result[key] = value
    }
  }

  return result
}

// =============================================================================
// Types
// =============================================================================

/**
 * Combined error type for repository operations
 */
export type DecodeError = ParseResult.ParseError

// =============================================================================
// Generic Decode Functions
// =============================================================================

/**
 * Decode a single row through a Model schema.
 *
 * Usage:
 * ```ts
 * const rows = yield* sql`SELECT ... LIMIT 1`
 * const decoded = yield* decodeRow(PlantModel)(rows[0])
 * ```
 */
export const decodeRow =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (row: unknown): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(row)

/**
 * Decode multiple rows through a Model schema.
 *
 * Usage:
 * ```ts
 * const rows = yield* sql`SELECT ...`
 * const decoded = yield* decodeRows(PlantModel)(rows)
 * ```
 */
export const decodeRows =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

/**
 * Decode a single row, returning Option.none() if no rows.
 *
 * Usage:
 * ```ts
 * const rows = yield* sql`SELECT ... WHERE id = ${id} LIMIT 1`
 * return yield* decodeOptional(PlantModel)(rows)
 * ```
 */
export const decodeOptional =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

/**
 * Decode first row or fail with custom error.
 *
 * Usage:
 * ```ts
 * const rows = yield* sql`INSERT ... RETURNING ...`
 * return yield* decodeFirst(PlantModel)(rows)
 * ```
 */
export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])
