/**
 * QueryDSL Module
 *
 * Unified query DSL for TMNL search system.
 * Supports regex, dorking operators, phrases, and search params.
 *
 * @example
 * ```typescript
 * import { parseQuery, executeQuery } from "@/lib/search/query"
 *
 * const parsed = yield* parseQuery('category:grid -scope:debug "add row" regex:^nav.* limit:10')
 * const results = yield* executeQuery(driver, parsed)
 * ```
 *
 * Query Syntax:
 * - Field operators: `category:value`, `scope:value`, `name:value`, `desc:value`, `keys:value`
 * - Exclusion: `-field:value` (e.g., `-scope:debug`)
 * - Quoted phrases: `"exact phrase"`
 * - Regex: `regex:pattern`
 * - Case sensitivity: `case:sensitive` or `case:insensitive`
 * - Match mode: `exact:`, `prefix:`, `fuzzy:` (default: fuzzy)
 * - Limit: `limit:N`
 * - Sort: `sort:score` or `sort:name`
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

export {
  // Types
  type FieldName,
  type FieldOperator,
  type RegexOperator,
  type PhraseOperator,
  type QueryOperator,
  type MatchMode,
  type SortField,
  type ParsedQuery,

  // Schemas
  FieldName,
  FieldOperator,
  RegexOperator,
  PhraseOperator,
  QueryOperator,
  MatchMode,
  SortField,
  ParsedQuery,

  // Factories
  emptyQuery,
  hasOperators,
  hasParams,
  isEmpty,
} from "./schemas"

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

export {
  parseQuery,
  isValidRegex,
  validateRegexPatterns,
  formatQuery,
} from "./parser"

// ─────────────────────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────────────────────

export {
  type SearchableItem,
  executeQuery,
  executeQueryStream,
  applyFilters,
  hasOperatorsOnly,
  applyFieldFilter,
  applyRegexFilter,
  applyPhraseFilter,
} from "./executor"

// ─────────────────────────────────────────────────────────────
// Stream Operators
// ─────────────────────────────────────────────────────────────

export {
  // Field operators
  withFieldMatch,
  withCategory,
  withScope,

  // Regex operators
  withRegexFilter,
  withRegexFieldFilter,

  // Phrase operators
  withPhraseMatch,
  withPhraseFieldMatch,

  // Sort operators
  sortedBy,
  sortedByScore,
  sortedByName,

  // Composite operators
  withFieldOperators,
} from "./operators"
