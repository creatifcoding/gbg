/**
 * Query Parser
 *
 * Parses raw query strings into structured ParsedQuery objects.
 * Extracts operators, phrases, regex patterns, and search params.
 *
 * @example
 * ```typescript
 * const parsed = yield* parseQuery('category:grid -scope:debug "add row" limit:10')
 * // {
 * //   text: "",
 * //   fieldOperators: [
 * //     { _tag: "FieldOperator", field: "category", value: "grid", exclude: false },
 * //     { _tag: "FieldOperator", field: "scope", value: "debug", exclude: true },
 * //   ],
 * //   phraseOperators: [{ _tag: "PhraseOperator", phrase: "add row" }],
 * //   regexOperators: [],
 * //   limit: 10,
 * // }
 * ```
 *
 * @module
 */

import { Effect } from "effect"
import type {
  ParsedQuery,
  FieldOperator,
  RegexOperator,
  PhraseOperator,
  FieldName,
  MatchMode,
  SortField,
} from "./schemas"

// ─────────────────────────────────────────────────────────────
// Token Patterns
// ─────────────────────────────────────────────────────────────

/** Quoted phrases: "exact phrase" */
const QUOTED_PATTERN = /"([^"]+)"/g

/** Regex operator: regex:pattern */
const REGEX_PATTERN = /regex:(\S+)/g

/** Field operators: field:value or -field:value */
const FIELD_PATTERN = /(-?)(category|scope|name|desc|keys):(\S+)/g

/** Case sensitivity: case:sensitive or case:insensitive */
const CASE_PATTERN = /case:(sensitive|insensitive)/g

/** Match mode: exact:, prefix:, fuzzy: followed by optional text */
const MATCH_MODE_PATTERN = /(exact|prefix|fuzzy):(\S*)/g

/** Limit: limit:N */
const LIMIT_PATTERN = /limit:(\d+)/g

/** Sort: sort:score or sort:name */
const SORT_PATTERN = /sort:(score|name)/g

// ─────────────────────────────────────────────────────────────
// Valid Field Names
// ─────────────────────────────────────────────────────────────

const VALID_FIELDS = new Set<string>(["category", "scope", "name", "desc", "keys"])

const isValidField = (field: string): field is FieldName => VALID_FIELDS.has(field)

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

/**
 * Parse a raw query string into a structured ParsedQuery.
 *
 * Extraction order matters:
 * 1. Quoted phrases (to prevent splitting on spaces inside quotes)
 * 2. Regex patterns
 * 3. Field operators
 * 4. Search params (case, match mode, limit, sort)
 * 5. Remaining text is free-form search
 */
export const parseQuery = (input: string): Effect.Effect<ParsedQuery> =>
  Effect.sync(() => {
    let text = input
    const fieldOps: FieldOperator[] = []
    const regexOps: RegexOperator[] = []
    const phraseOps: PhraseOperator[] = []
    let matchMode: MatchMode | undefined
    let caseSensitive: boolean | undefined
    let limit: number | undefined
    let sort: SortField | undefined

    // 1. Extract quoted phrases FIRST (preserve spaces inside quotes)
    for (const match of input.matchAll(QUOTED_PATTERN)) {
      phraseOps.push({
        _tag: "PhraseOperator",
        phrase: match[1],
      })
      text = text.replace(match[0], " ")
    }

    // 2. Extract regex operators
    for (const match of text.matchAll(REGEX_PATTERN)) {
      regexOps.push({
        _tag: "RegexOperator",
        pattern: match[1],
      })
      text = text.replace(match[0], " ")
    }

    // 3. Extract field operators (including exclusions with -)
    for (const match of text.matchAll(FIELD_PATTERN)) {
      const [full, exclude, field, value] = match
      if (isValidField(field)) {
        fieldOps.push({
          _tag: "FieldOperator",
          field,
          value,
          exclude: exclude === "-",
        })
        text = text.replace(full, " ")
      }
    }

    // 4. Extract case sensitivity
    for (const match of text.matchAll(CASE_PATTERN)) {
      caseSensitive = match[1] === "sensitive"
      text = text.replace(match[0], " ")
    }

    // 5. Extract match mode (may have attached text like "exact:save")
    for (const match of text.matchAll(MATCH_MODE_PATTERN)) {
      matchMode = match[1] as MatchMode
      // If there's text after the colon, keep it as search text
      if (match[2]) {
        text = text.replace(match[0], ` ${match[2]} `)
      } else {
        text = text.replace(match[0], " ")
      }
    }

    // 6. Extract limit
    for (const match of text.matchAll(LIMIT_PATTERN)) {
      limit = parseInt(match[1], 10)
      text = text.replace(match[0], " ")
    }

    // 7. Extract sort
    for (const match of text.matchAll(SORT_PATTERN)) {
      sort = match[1] as SortField
      text = text.replace(match[0], " ")
    }

    // 8. Clean up remaining text
    text = text
      .replace(/\s+/g, " ")  // Collapse whitespace
      .trim()

    return {
      text,
      fieldOperators: fieldOps,
      regexOperators: regexOps,
      phraseOperators: phraseOps,
      matchMode,
      caseSensitive,
      limit,
      sort,
    }
  })

/**
 * Validate a regex pattern without throwing.
 * Returns true if the pattern is valid.
 */
export const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

/**
 * Validate all regex patterns in a parsed query.
 * Returns array of invalid patterns (empty if all valid).
 */
export const validateRegexPatterns = (
  query: ParsedQuery
): Effect.Effect<readonly string[]> =>
  Effect.sync(() =>
    query.regexOperators
      .filter((op) => !isValidRegex(op.pattern))
      .map((op) => op.pattern)
  )

/**
 * Format a ParsedQuery back to a string (for debugging/display).
 */
export const formatQuery = (query: ParsedQuery): string => {
  const parts: string[] = []

  // Field operators
  for (const op of query.fieldOperators) {
    const prefix = op.exclude ? "-" : ""
    parts.push(`${prefix}${op.field}:${op.value}`)
  }

  // Regex operators
  for (const op of query.regexOperators) {
    parts.push(`regex:${op.pattern}`)
  }

  // Phrase operators
  for (const op of query.phraseOperators) {
    parts.push(`"${op.phrase}"`)
  }

  // Params
  if (query.matchMode) {
    parts.push(`${query.matchMode}:`)
  }
  if (query.caseSensitive !== undefined) {
    parts.push(`case:${query.caseSensitive ? "sensitive" : "insensitive"}`)
  }
  if (query.limit !== undefined) {
    parts.push(`limit:${query.limit}`)
  }
  if (query.sort !== undefined) {
    parts.push(`sort:${query.sort}`)
  }

  // Free text
  if (query.text) {
    parts.push(query.text)
  }

  return parts.join(" ")
}
