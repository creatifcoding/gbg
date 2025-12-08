/**
 * TMNL Search — Schemas
 *
 * Light Schema definitions for search validation and filtering.
 * Schema as gatekeeper, not transformer.
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Core Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Character range tuple [start, end] for match highlighting
 */
export const CharRangeSchema = Schema.Tuple(Schema.Number, Schema.Number)

/**
 * Field match information
 */
export const FieldMatchSchema = Schema.Struct({
  field: Schema.String,
  ranges: Schema.optional(Schema.Array(CharRangeSchema)),
})

export type FieldMatch = typeof FieldMatchSchema.Type

/**
 * Search result with unknown item (generic)
 */
export const SearchResultSchema = Schema.Struct({
  item: Schema.Unknown,
  score: Schema.Number,
  matches: Schema.optional(Schema.Array(FieldMatchSchema)),
  index: Schema.optional(Schema.Number),
})

export type SearchResult = typeof SearchResultSchema.Type

/**
 * Validated search result — score is 0-1 range
 */
export const ValidSearchResultSchema = Schema.Struct({
  item: Schema.Unknown,
  score: Schema.Number.pipe(
    Schema.filter((n) => n >= 0 && n <= 1, {
      message: () => 'Score must be between 0 and 1',
    })
  ),
  matches: Schema.optional(Schema.Array(FieldMatchSchema)),
  index: Schema.optional(Schema.Number),
})

// ─────────────────────────────────────────────────────────────────────────────
// Search Options Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const SearchStrategySchema = Schema.Literal('exact', 'prefix', 'fuzzy', 'auto')

export type SearchStrategy = typeof SearchStrategySchema.Type

export const SearchOptionsSchema = Schema.Struct({
  limit: Schema.optional(Schema.Number.pipe(Schema.positive())),
  strategy: Schema.optional(SearchStrategySchema),
  fuzzyThreshold: Schema.optional(
    Schema.Number.pipe(Schema.filter((n) => n >= 0 && n <= 1))
  ),
  fields: Schema.optional(Schema.Array(Schema.String)),
  suggest: Schema.optional(Schema.Boolean),
  boost: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Number })),
  chunkSize: Schema.optional(Schema.Number.pipe(Schema.positive())),
})

export type SearchOptions = typeof SearchOptionsSchema.Type

// ─────────────────────────────────────────────────────────────────────────────
// Filter Factories (The Clever Part)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard: is this a valid search result?
 */
export const isValidResult = Schema.is(SearchResultSchema)

/**
 * Filter: score above threshold
 */
export const scoreAbove =
  (threshold: number) =>
  <T>(result: { score: number; item: T }): boolean =>
    result.score >= threshold

/**
 * Filter: score below threshold (for exclusion)
 */
export const scoreBelow =
  (threshold: number) =>
  <T>(result: { score: number; item: T }): boolean =>
    result.score < threshold

/**
 * Filter: has match in specific field
 */
export const hasFieldMatch =
  (field: string) =>
  <T>(result: { matches?: readonly { field: string }[]; item: T }): boolean =>
    result.matches?.some((m) => m.field === field) ?? false

/**
 * Filter: has any matches
 */
export const hasMatches = <T>(result: {
  matches?: readonly unknown[]
  item: T
}): boolean => (result.matches?.length ?? 0) > 0

/**
 * Filter: item has category (for command search)
 */
export const inCategory =
  (category: string) =>
  <T extends { category?: string }>(result: { item: T }): boolean =>
    result.item.category === category

/**
 * Filter: item has scope (for command search)
 */
export const inScope =
  (scope: string) =>
  <T extends { scope?: string }>(result: { item: T }): boolean =>
    result.item.scope === scope

/**
 * Filter: item name contains substring (case-insensitive)
 */
export const nameContains =
  (substring: string) =>
  <T extends { name?: string }>(result: { item: T }): boolean =>
    result.item.name?.toLowerCase().includes(substring.toLowerCase()) ?? false

// ─────────────────────────────────────────────────────────────────────────────
// Composable Filter Combinators
// ─────────────────────────────────────────────────────────────────────────────

type Predicate<T> = (value: T) => boolean

/**
 * Combine filters with AND logic
 */
export const allOf =
  <T>(...predicates: Predicate<T>[]): Predicate<T> =>
  (value) =>
    predicates.every((p) => p(value))

/**
 * Combine filters with OR logic
 */
export const anyOf =
  <T>(...predicates: Predicate<T>[]): Predicate<T> =>
  (value) =>
    predicates.some((p) => p(value))

/**
 * Negate a filter
 */
export const not =
  <T>(predicate: Predicate<T>): Predicate<T> =>
  (value) =>
    !predicate(value)

// ─────────────────────────────────────────────────────────────────────────────
// Command-Specific Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Command search item schema (for command palette)
 */
export const CommandSearchItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  category: Schema.String,
  scope: Schema.String,
  keys: Schema.optional(Schema.String),
})

export type CommandSearchItem = typeof CommandSearchItemSchema.Type

/**
 * Command search result with typed item
 */
export const CommandSearchResultSchema = Schema.Struct({
  item: CommandSearchItemSchema,
  score: Schema.Number,
  matches: Schema.optional(Schema.Array(FieldMatchSchema)),
  index: Schema.optional(Schema.Number),
})

export type CommandSearchResult = typeof CommandSearchResultSchema.Type

/**
 * Type guard for command search results
 */
export const isCommandResult = Schema.is(CommandSearchResultSchema)
