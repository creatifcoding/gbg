/**
 * QueryDSL Schemas
 *
 * Effect Schema definitions for the query DSL system.
 * Supports field operators, regex, phrases, and search params.
 *
 * @module
 */

import { Schema } from "effect"

// ─────────────────────────────────────────────────────────────
// Field Names
// ─────────────────────────────────────────────────────────────

/**
 * Valid field names for dorking operators.
 */
export const FieldName = Schema.Literal("category", "scope", "name", "desc", "keys")
export type FieldName = typeof FieldName.Type

// ─────────────────────────────────────────────────────────────
// Operator Schemas
// ─────────────────────────────────────────────────────────────

/**
 * Field operator: `field:value` or `-field:value` (exclusion)
 */
export const FieldOperator = Schema.Struct({
  _tag: Schema.Literal("FieldOperator"),
  field: FieldName,
  value: Schema.String,
  exclude: Schema.Boolean,
})
export type FieldOperator = typeof FieldOperator.Type

/**
 * Regex operator: `regex:pattern`
 */
export const RegexOperator = Schema.Struct({
  _tag: Schema.Literal("RegexOperator"),
  pattern: Schema.String,
})
export type RegexOperator = typeof RegexOperator.Type

/**
 * Phrase operator: `"exact phrase"`
 */
export const PhraseOperator = Schema.Struct({
  _tag: Schema.Literal("PhraseOperator"),
  phrase: Schema.String,
})
export type PhraseOperator = typeof PhraseOperator.Type

/**
 * Union of all operator types.
 */
export const QueryOperator = Schema.Union(FieldOperator, RegexOperator, PhraseOperator)
export type QueryOperator = typeof QueryOperator.Type

// ─────────────────────────────────────────────────────────────
// Search Params
// ─────────────────────────────────────────────────────────────

/**
 * Match mode: how the search engine matches text.
 */
export const MatchMode = Schema.Literal("exact", "prefix", "fuzzy")
export type MatchMode = typeof MatchMode.Type

/**
 * Sort field for results.
 */
export const SortField = Schema.Literal("score", "name")
export type SortField = typeof SortField.Type

// ─────────────────────────────────────────────────────────────
// Parsed Query
// ─────────────────────────────────────────────────────────────

/**
 * Fully parsed query structure.
 *
 * Contains the free-form text, all extracted operators, and search params.
 */
export const ParsedQuery = Schema.Struct({
  /** Free-form search text after operator extraction */
  text: Schema.String,

  /** Field operators: category:, scope:, name:, desc:, keys: */
  fieldOperators: Schema.Array(FieldOperator),

  /** Regex operators: regex:pattern */
  regexOperators: Schema.Array(RegexOperator),

  /** Quoted phrase operators: "exact phrase" */
  phraseOperators: Schema.Array(PhraseOperator),

  /** Match mode: exact, prefix, fuzzy (default: fuzzy) */
  matchMode: Schema.optional(MatchMode),

  /** Case sensitivity (default: insensitive) */
  caseSensitive: Schema.optional(Schema.Boolean),

  /** Result limit */
  limit: Schema.optional(Schema.Number),

  /** Sort order */
  sort: Schema.optional(SortField),
})
export type ParsedQuery = typeof ParsedQuery.Type

// ─────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────

/**
 * Create an empty parsed query.
 */
export const emptyQuery = (): ParsedQuery => ({
  text: "",
  fieldOperators: [],
  regexOperators: [],
  phraseOperators: [],
})

/**
 * Check if a parsed query has any operators or params.
 */
export const hasOperators = (query: ParsedQuery): boolean =>
  query.fieldOperators.length > 0 ||
  query.regexOperators.length > 0 ||
  query.phraseOperators.length > 0

/**
 * Check if a parsed query has any search params.
 */
export const hasParams = (query: ParsedQuery): boolean =>
  query.matchMode !== undefined ||
  query.caseSensitive !== undefined ||
  query.limit !== undefined ||
  query.sort !== undefined

/**
 * Check if a parsed query is effectively empty.
 */
export const isEmpty = (query: ParsedQuery): boolean =>
  query.text.trim() === "" && !hasOperators(query)
