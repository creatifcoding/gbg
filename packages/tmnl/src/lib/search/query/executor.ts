/**
 * Query Executor
 *
 * Executes ParsedQuery against a SearchServiceImpl driver.
 * Uses hybrid approach: driver handles fuzzy/prefix/fields, post-filter for regex/exclusions.
 *
 * @example
 * ```typescript
 * const parsed = yield* parseQuery('category:grid "add row" limit:10')
 * const results = yield* executeQuery(driver, parsed)
 * ```
 *
 * @module
 */

import { Effect, Stream, Chunk } from "effect"
import type { SearchServiceImpl, SearchResult, SearchOptions, SearchError, Indexable } from "../types"
import type { ParsedQuery, FieldOperator } from "./schemas"
import { isEmpty } from "./schemas"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Searchable item shape - must have these optional fields for filtering.
 */
export interface SearchableItem extends Indexable {
  readonly name: string
  readonly description?: string
  readonly category?: string
  readonly scope?: string
  readonly keys?: string
}

/**
 * Map field names from DSL to item properties.
 */
const fieldToProperty = (field: FieldOperator["field"]): keyof SearchableItem => {
  switch (field) {
    case "desc":
      return "description"
    default:
      return field
  }
}

// ─────────────────────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────────────────────

/**
 * Execute a ParsedQuery against a search driver.
 *
 * Hybrid approach:
 * 1. Driver handles: fuzzy/prefix/exact search, field boosting
 * 2. Post-filter handles: regex, exclusions, phrases, case sensitivity
 * 3. Post-sort handles: sort:score, sort:name (collects all results)
 *
 * @param driver - The search service implementation
 * @param query - Parsed query structure
 * @returns Array of search results (sorted if requested)
 */
export const executeQuery = <T extends SearchableItem>(
  driver: SearchServiceImpl<T>,
  query: ParsedQuery
): Effect.Effect<readonly SearchResult<T>[], SearchError> =>
  Effect.gen(function* () {
    // Handle empty query - return empty results
    if (isEmpty(query)) {
      return []
    }

    // Build SearchOptions from query params
    const options: SearchOptions = {
      limit: query.sort ? undefined : query.limit, // Don't limit if sorting (need all for sort)
      strategy: query.matchMode ?? "fuzzy",
    }

    let results: readonly SearchResult<T>[]

    // If we have operators but no free text, get ALL items first then filter
    // FlexSearch doesn't return all items for empty queries
    if (!query.text.trim() && (query.fieldOperators.length > 0 || query.regexOperators.length > 0 || query.phraseOperators.length > 0)) {
      // Use prefix search with empty string to get all items
      // This is a workaround since FlexSearch search("") returns nothing
      const stats = yield* driver.stats()
      results = yield* driver.search("", { ...options, limit: stats.itemCount + 100 }).pipe(
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )

      // If still empty, try fuzzy with common patterns
      if (results.length === 0) {
        // Get all by searching for common characters
        const allResults = yield* driver.prefix("", { limit: 1000 }).pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )
        results = allResults
      }
    } else {
      // Normal search with text
      results = yield* driver.search(query.text, options).pipe(
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray)
      )
    }

    // Post-filter: Field operators (include)
    const includes = query.fieldOperators.filter((op) => !op.exclude)
    for (const op of includes) {
      const prop = fieldToProperty(op.field)
      const lowerValue = op.value.toLowerCase()
      results = results.filter((r) => {
        const fieldValue = (r.item as Record<string, unknown>)[prop]
        if (typeof fieldValue !== "string") return false
        return fieldValue.toLowerCase().includes(lowerValue)
      })
    }

    // Post-filter: Field operators (exclude)
    const excludes = query.fieldOperators.filter((op) => op.exclude)
    for (const op of excludes) {
      const prop = fieldToProperty(op.field)
      const lowerValue = op.value.toLowerCase()
      results = results.filter((r) => {
        const fieldValue = (r.item as Record<string, unknown>)[prop]
        if (typeof fieldValue !== "string") return true // Keep if field doesn't exist
        return !fieldValue.toLowerCase().includes(lowerValue)
      })
    }

    // Post-filter: Regex operators
    for (const op of query.regexOperators) {
      const flags = query.caseSensitive ? "" : "i"
      let regex: RegExp
      try {
        regex = new RegExp(op.pattern, flags)
      } catch {
        // Invalid regex - skip this filter
        continue
      }
      results = results.filter((r) => {
        const item = r.item
        return regex.test(item.name) || regex.test(item.description ?? "")
      })
    }

    // Post-filter: Phrase operators
    for (const op of query.phraseOperators) {
      const phrase = query.caseSensitive ? op.phrase : op.phrase.toLowerCase()
      results = results.filter((r) => {
        const item = r.item
        const name = query.caseSensitive ? item.name : item.name.toLowerCase()
        const desc = query.caseSensitive
          ? (item.description ?? "")
          : (item.description ?? "").toLowerCase()
        return name.includes(phrase) || desc.includes(phrase)
      })
    }

    // Sort if requested (breaks streaming, but acceptable)
    if (query.sort === "score") {
      results = [...results].sort((a, b) => b.score - a.score)
    } else if (query.sort === "name") {
      results = [...results].sort((a, b) => a.item.name.localeCompare(b.item.name))
    }

    // Apply final limit (after sorting)
    if (query.limit !== undefined) {
      results = results.slice(0, query.limit)
    }

    return results
  })

/**
 * Execute a query and return as a Stream (for progressive emission).
 *
 * Note: If sort is specified, all results are collected before emission.
 */
export const executeQueryStream = <T extends SearchableItem>(
  driver: SearchServiceImpl<T>,
  query: ParsedQuery
): Stream.Stream<SearchResult<T>, SearchError> =>
  Stream.fromEffect(executeQuery(driver, query)).pipe(Stream.flatMap(Stream.fromIterable))

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Apply all QueryDSL filters to a pre-loaded array of items.
 * Use this when you have operators but no free text search.
 *
 * @param items - Array of items to filter
 * @param query - Parsed query with operators
 * @returns Filtered and optionally sorted items as SearchResults
 */
export const applyFilters = <T extends SearchableItem>(
  items: readonly T[],
  query: ParsedQuery
): readonly SearchResult<T>[] => {
  // Convert items to SearchResults with score=1
  let results: SearchResult<T>[] = items.map((item) => ({
    item,
    score: 1,
  }))

  // Apply field operators (include)
  const includes = query.fieldOperators.filter((op) => !op.exclude)
  for (const op of includes) {
    const prop = fieldToProperty(op.field)
    const lowerValue = op.value.toLowerCase()
    results = results.filter((r) => {
      const fieldValue = (r.item as Record<string, unknown>)[prop]
      if (typeof fieldValue !== "string") return false
      return fieldValue.toLowerCase().includes(lowerValue)
    })
  }

  // Apply field operators (exclude)
  const excludes = query.fieldOperators.filter((op) => op.exclude)
  for (const op of excludes) {
    const prop = fieldToProperty(op.field)
    const lowerValue = op.value.toLowerCase()
    results = results.filter((r) => {
      const fieldValue = (r.item as Record<string, unknown>)[prop]
      if (typeof fieldValue !== "string") return true
      return !fieldValue.toLowerCase().includes(lowerValue)
    })
  }

  // Apply regex operators
  for (const op of query.regexOperators) {
    const flags = query.caseSensitive ? "" : "i"
    let regex: RegExp
    try {
      regex = new RegExp(op.pattern, flags)
    } catch {
      continue
    }
    results = results.filter((r) => {
      const item = r.item
      return regex.test(item.name) || regex.test(item.description ?? "")
    })
  }

  // Apply phrase operators
  for (const op of query.phraseOperators) {
    const phrase = query.caseSensitive ? op.phrase : op.phrase.toLowerCase()
    results = results.filter((r) => {
      const item = r.item
      const name = query.caseSensitive ? item.name : item.name.toLowerCase()
      const desc = query.caseSensitive
        ? (item.description ?? "")
        : (item.description ?? "").toLowerCase()
      return name.includes(phrase) || desc.includes(phrase)
    })
  }

  // Sort if requested
  if (query.sort === "score") {
    results = [...results].sort((a, b) => b.score - a.score)
  } else if (query.sort === "name") {
    results = [...results].sort((a, b) => a.item.name.localeCompare(b.item.name))
  }

  // Apply limit
  if (query.limit !== undefined) {
    results = results.slice(0, query.limit)
  }

  return results
}

/**
 * Check if a parsed query has operators but no free text.
 */
export const hasOperatorsOnly = (query: ParsedQuery): boolean =>
  !query.text.trim() &&
  (query.fieldOperators.length > 0 ||
    query.regexOperators.length > 0 ||
    query.phraseOperators.length > 0)

/**
 * Apply a single field filter to results.
 */
export const applyFieldFilter = <T extends SearchableItem>(
  results: readonly SearchResult<T>[],
  op: FieldOperator
): readonly SearchResult<T>[] => {
  const prop = fieldToProperty(op.field)
  const lowerValue = op.value.toLowerCase()

  return results.filter((r) => {
    const fieldValue = (r.item as Record<string, unknown>)[prop]
    if (typeof fieldValue !== "string") return op.exclude // Keep if exclude and no field
    const matches = fieldValue.toLowerCase().includes(lowerValue)
    return op.exclude ? !matches : matches
  })
}

/**
 * Apply a regex filter to results.
 */
export const applyRegexFilter = <T extends SearchableItem>(
  results: readonly SearchResult<T>[],
  pattern: string,
  caseSensitive = false
): readonly SearchResult<T>[] => {
  const flags = caseSensitive ? "" : "i"
  let regex: RegExp
  try {
    regex = new RegExp(pattern, flags)
  } catch {
    return results // Invalid regex - return unchanged
  }

  return results.filter((r) => {
    const item = r.item
    return regex.test(item.name) || regex.test(item.description ?? "")
  })
}

/**
 * Apply a phrase filter to results.
 */
export const applyPhraseFilter = <T extends SearchableItem>(
  results: readonly SearchResult<T>[],
  phrase: string,
  caseSensitive = false
): readonly SearchResult<T>[] => {
  const p = caseSensitive ? phrase : phrase.toLowerCase()

  return results.filter((r) => {
    const item = r.item
    const name = caseSensitive ? item.name : item.name.toLowerCase()
    const desc = caseSensitive ? (item.description ?? "") : (item.description ?? "").toLowerCase()
    return name.includes(p) || desc.includes(p)
  })
}
