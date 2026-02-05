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
 * Convert camelCase to snake_case for SQL column names.
 *
 * @example
 * camelToSnake('operatorId') // 'operator_id'
 * camelToSnake('machineId') // 'machine_id'
 */
const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

/**
 * Transform an update object for use with sql.update().
 *
 * Performs two transformations:
 * 1. camelCase keys → snake_case (for SQL column names)
 * 2. Option fields → primitive values:
 *    - undefined → undefined (sql.update skips these)
 *    - Option.none() → null (sets DB field to NULL)
 *    - Option.some(v) → v (sets DB field to value)
 *
 * Non-Option fields are passed through as-is.
 *
 * @example
 * ```ts
 * const changes = prepareUpdate({
 *   id: 'foo',
 *   name: 'New Name',           // string → string
 *   modelNumber: Option.none(), // Option.none() → null, key → model_number
 *   operatorId: Option.some('x') // Option.some('x') → 'x', key → operator_id
 *   // location: undefined      // omitted → sql.update skips
 * })
 * sql`UPDATE t SET ${sql.update(changes, ['id'])} WHERE id = ${id}`
 * ```
 */
export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T,
  options?: { jsonbFields?: readonly string[] }
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  const jsonbSet = new Set(options?.jsonbFields ?? [])

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      // Skip undefined - sql.update will omit this field
      continue
    }

    // Convert key to snake_case for SQL
    const snakeKey = camelToSnake(key)
    const isJsonb = jsonbSet.has(key)

    if (Option.isOption(value)) {
      // Convert Option to primitive: none → null, some → value
      const rawValue = Option.getOrNull(value)
      // JSON.stringify JSONB fields (including strings)
      result[snakeKey] = isJsonb && rawValue !== null ? JSON.stringify(rawValue) : rawValue
    } else {
      // JSON.stringify JSONB fields
      result[snakeKey] = isJsonb ? JSON.stringify(value) : value
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
