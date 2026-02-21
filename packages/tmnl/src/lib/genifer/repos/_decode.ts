/**
 * Genifer Repo Decode Utilities
 *
 * Replicates iiot pattern: raw SQL rows → Model types,
 * Model updates → snake_case for sql.update().
 *
 * @module
 */

import { Effect, Schema, Option, ParseResult } from 'effect'

// =============================================================================
// Key Transform
// =============================================================================

const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

// =============================================================================
// Update Object Transformation
// =============================================================================

/**
 * Transform update object: camelCase → snake_case, Option → null/value.
 */
export const prepareUpdate = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    const snakeKey = camelToSnake(key)
    if (Option.isOption(value)) {
      result[snakeKey] = Option.getOrNull(value)
    } else {
      result[snakeKey] = value
    }
  }
  return result
}

// =============================================================================
// Decode Functions
// =============================================================================

export type DecodeError = ParseResult.ParseError

export const decodeRows =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

export const decodeOptional =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])
