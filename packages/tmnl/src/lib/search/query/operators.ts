/**
 * QueryDSL Stream Operators
 *
 * Composable Stream operators for QueryDSL features.
 * Use these for fine-grained control over result filtering.
 *
 * @example
 * ```typescript
 * const results = yield* driver.search(query).pipe(
 *   withFieldMatch("category", "grid"),
 *   withRegexFilter("^nav.*"),
 *   withPhraseMatch("add row"),
 *   Stream.take(10)
 * )
 * ```
 *
 * @module
 */

import { Stream, Chunk, Effect } from "effect"
import type { SearchResult, SearchError } from "../types"
import type { SearchableItem } from "./executor"
import type { FieldOperator, SortField } from "./schemas"

// ─────────────────────────────────────────────────────────────
// Field Operators
// ─────────────────────────────────────────────────────────────

/**
 * Map DSL field names to item property names.
 */
const fieldToProperty = (field: FieldOperator["field"]): string => {
  switch (field) {
    case "desc":
      return "description"
    default:
      return field
  }
}

/**
 * Filter results by field value match (include or exclude).
 */
export const withFieldMatch = <T extends SearchableItem>(
  field: FieldOperator["field"],
  value: string,
  exclude = false
) =>
  Stream.filter<SearchResult<T>, SearchError>((r) => {
    const prop = fieldToProperty(field)
    const fieldValue = (r.item as Record<string, unknown>)[prop]
    if (typeof fieldValue !== "string") return exclude
    const matches = fieldValue.toLowerCase().includes(value.toLowerCase())
    return exclude ? !matches : matches
  })

/**
 * Filter results by category.
 */
export const withCategory = <T extends SearchableItem>(category: string, exclude = false) =>
  withFieldMatch<T>("category", category, exclude)

/**
 * Filter results by scope.
 */
export const withScope = <T extends SearchableItem>(scope: string, exclude = false) =>
  withFieldMatch<T>("scope", scope, exclude)

// ─────────────────────────────────────────────────────────────
// Regex Operators
// ─────────────────────────────────────────────────────────────

/**
 * Filter results by regex pattern.
 *
 * Matches against name and description fields.
 * Invalid patterns are silently ignored (pass-through).
 */
export const withRegexFilter = <T extends SearchableItem>(
  pattern: string,
  caseSensitive = false
) => {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, caseSensitive ? "" : "i")
  } catch {
    // Invalid regex - pass through all results
    return Stream.identity<SearchResult<T>, SearchError>()
  }

  return Stream.filter<SearchResult<T>, SearchError>((r) => {
    const item = r.item
    return regex.test(item.name) || regex.test(item.description ?? "")
  })
}

/**
 * Filter results by regex pattern on a specific field.
 */
export const withRegexFieldFilter = <T extends SearchableItem>(
  field: FieldOperator["field"],
  pattern: string,
  caseSensitive = false
) => {
  let regex: RegExp
  try {
    regex = new RegExp(pattern, caseSensitive ? "" : "i")
  } catch {
    return Stream.identity<SearchResult<T>, SearchError>()
  }

  const prop = fieldToProperty(field)

  return Stream.filter<SearchResult<T>, SearchError>((r) => {
    const fieldValue = (r.item as Record<string, unknown>)[prop]
    if (typeof fieldValue !== "string") return false
    return regex.test(fieldValue)
  })
}

// ─────────────────────────────────────────────────────────────
// Phrase Operators
// ─────────────────────────────────────────────────────────────

/**
 * Filter results by exact phrase match.
 *
 * Matches against name and description fields.
 */
export const withPhraseMatch = <T extends SearchableItem>(
  phrase: string,
  caseSensitive = false
) =>
  Stream.filter<SearchResult<T>, SearchError>((r) => {
    const item = r.item
    const p = caseSensitive ? phrase : phrase.toLowerCase()
    const name = caseSensitive ? item.name : item.name.toLowerCase()
    const desc = caseSensitive ? (item.description ?? "") : (item.description ?? "").toLowerCase()
    return name.includes(p) || desc.includes(p)
  })

/**
 * Filter results by exact phrase match on a specific field.
 */
export const withPhraseFieldMatch = <T extends SearchableItem>(
  field: FieldOperator["field"],
  phrase: string,
  caseSensitive = false
) => {
  const prop = fieldToProperty(field)

  return Stream.filter<SearchResult<T>, SearchError>((r) => {
    const fieldValue = (r.item as Record<string, unknown>)[prop]
    if (typeof fieldValue !== "string") return false
    const p = caseSensitive ? phrase : phrase.toLowerCase()
    const fv = caseSensitive ? fieldValue : fieldValue.toLowerCase()
    return fv.includes(p)
  })
}

// ─────────────────────────────────────────────────────────────
// Sort Operators
// ─────────────────────────────────────────────────────────────

/**
 * Collect all results and sort by field.
 *
 * Note: This breaks streaming - all results are collected before emission.
 */
export const sortedBy = <T extends SearchableItem>(
  field: SortField
): (<E>(stream: Stream.Stream<SearchResult<T>, E>) => Stream.Stream<SearchResult<T>, E>) =>
  <E>(stream: Stream.Stream<SearchResult<T>, E>) =>
    stream.pipe(
      Stream.runCollect,
      Effect.map((chunk) => {
        const arr = Chunk.toReadonlyArray(chunk)
        const sorted =
          field === "score"
            ? [...arr].sort((a, b) => b.score - a.score)
            : [...arr].sort((a, b) => a.item.name.localeCompare(b.item.name))
        return sorted
      }),
      Stream.fromEffect,
      Stream.flatMap(Stream.fromIterable)
    )

/**
 * Sort results by score (highest first).
 */
export const sortedByScore = <T extends SearchableItem>() => sortedBy<T>("score")

/**
 * Sort results by name (alphabetical).
 */
export const sortedByName = <T extends SearchableItem>() => sortedBy<T>("name")

// ─────────────────────────────────────────────────────────────
// Composite Operators
// ─────────────────────────────────────────────────────────────

/**
 * Apply all operators from a FieldOperator array.
 */
export const withFieldOperators = <T extends SearchableItem>(
  ops: readonly FieldOperator[]
): (<E>(stream: Stream.Stream<SearchResult<T>, E>) => Stream.Stream<SearchResult<T>, E>) =>
  <E>(stream: Stream.Stream<SearchResult<T>, E>) =>
    ops.reduce(
      (s, op) => s.pipe(withFieldMatch<T>(op.field, op.value, op.exclude)),
      stream
    )
