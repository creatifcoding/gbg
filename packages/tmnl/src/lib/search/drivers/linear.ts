/**
 * TMNL Search — Linear Driver
 *
 * Simple .includes() based search for testing and fallback.
 * Stream-first with progressive emission.
 */

import { Effect, Ref, Stream } from 'effect'
import type {
  SearchServiceImpl,
  SearchResult,
  SearchOptions,
  SearchStats,
  SearchError,
  IndexConfig,
  Indexable,
  FieldConfig,
} from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Linear Search State
// ─────────────────────────────────────────────────────────────────────────────

interface LinearState<T extends Indexable> {
  items: T[]
  config: IndexConfig<T> | null
  lastUpdated: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a simple linear search driver (for testing/fallback)
 */
export const createLinearDriver = <T extends Indexable>(): Effect.Effect<
  SearchServiceImpl<T>,
  never,
  never
> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<LinearState<T>>({
      items: [],
      config: null,
      lastUpdated: 0,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    const getFields = (config: IndexConfig<T> | null): string[] => {
      if (!config) return []
      return config.fields.map((f) =>
        typeof f === 'string' ? (f as string) : (f as FieldConfig).field
      )
    }

    const getFieldValue = (item: T, field: string): string => {
      const value = item[field as keyof T]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'number') return String(value)
      return String(value)
    }

    const scoreMatch = (
      item: T,
      query: string,
      fields: string[],
      options?: SearchOptions
    ): SearchResult<T> | null => {
      const lowerQuery = query.toLowerCase()
      const matches: { field: string }[] = []
      let totalScore = 0
      let matchCount = 0

      for (const field of fields) {
        const value = getFieldValue(item, field).toLowerCase()

        if (value.includes(lowerQuery)) {
          matches.push({ field })
          matchCount++

          // Score based on match quality
          let fieldScore = 0.5 // Base score for substring match

          // Exact match bonus
          if (value === lowerQuery) {
            fieldScore = 1.0
          }
          // Starts with bonus
          else if (value.startsWith(lowerQuery)) {
            fieldScore = 0.8
          }
          // Word boundary bonus
          else if (
            value.includes(` ${lowerQuery}`) ||
            value.startsWith(lowerQuery)
          ) {
            fieldScore = 0.7
          }

          // Apply boost if specified
          const boost = options?.boost?.[field] ?? 1
          totalScore += fieldScore * boost
        }
      }

      if (matchCount === 0) return null

      // Normalize score to 0-1
      const normalizedScore = Math.min(1, totalScore / matchCount)

      return {
        item,
        score: normalizedScore,
        matches,
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mutations (Effect - one-shot)
    // ─────────────────────────────────────────────────────────────────────────

    const index = (
      items: readonly T[],
      config: IndexConfig<T>
    ): Effect.Effect<void, SearchError> =>
      Ref.set(stateRef, {
        items: [...items],
        config,
        lastUpdated: Date.now(),
      })

    const add = (item: T): Effect.Effect<void, SearchError> =>
      Ref.update(stateRef, (s) => ({
        ...s,
        items: [...s.items, item],
        lastUpdated: Date.now(),
      }))

    const update = (item: T): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const idField = (state.config?.idField as string) ?? 'id'
        const id = item[idField as keyof T]

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          items: s.items.map((i) =>
            i[idField as keyof T] === id ? item : i
          ),
          lastUpdated: Date.now(),
        }))
      })

    const remove = (id: string | number): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const idField = (state.config?.idField as string) ?? 'id'

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          items: s.items.filter((i) => i[idField as keyof T] !== id),
          lastUpdated: Date.now(),
        }))
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Queries (Stream - progressive, cancellable)
    // ─────────────────────────────────────────────────────────────────────────

    const search = (
      query: string,
      options?: SearchOptions
    ): Stream.Stream<SearchResult<T>, SearchError> =>
      Stream.unwrap(
        Effect.gen(function* () {
          if (!query.trim()) {
            return Stream.empty
          }

          const state = yield* Ref.get(stateRef)
          const fields =
            options?.fields?.map(String) ?? getFields(state.config)
          const limit = options?.limit ?? 50
          const chunkSize = options?.chunkSize ?? 10

          // Score and filter items
          const results: SearchResult<T>[] = []

          for (const item of state.items) {
            const result = scoreMatch(item, query, fields, options)
            if (result) {
              results.push(result)
            }
            if (results.length >= limit) break
          }

          // Sort by score
          results.sort((a, b) => b.score - a.score)

          // Emit progressively
          return Stream.fromIterable(results).pipe(
            Stream.grouped(chunkSize),
            Stream.flatMap((chunk) => Stream.fromIterable(chunk))
          )
        })
      )

    const prefix = (
      query: string,
      options?: Omit<SearchOptions, 'strategy'>
    ): Stream.Stream<SearchResult<T>, SearchError> =>
      // For linear driver, prefix is same as search (startsWith is scored higher)
      search(query, { ...options, strategy: 'prefix' })

    const fuzzy = (
      query: string,
      options?: Omit<SearchOptions, 'strategy'>
    ): Stream.Stream<SearchResult<T>, SearchError> =>
      // Linear driver doesn't do true fuzzy, just includes
      search(query, { ...options, strategy: 'fuzzy' })

    // ─────────────────────────────────────────────────────────────────────────
    // Admin (Effect - one-shot)
    // ─────────────────────────────────────────────────────────────────────────

    const stats = (): Effect.Effect<SearchStats, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return {
          itemCount: state.items.length,
          fieldCount: getFields(state.config).length,
          lastUpdated: state.lastUpdated || undefined,
          memoryUsage: state.items.length * 512, // Rough estimate
        }
      })

    const clear = (): Effect.Effect<void, SearchError> =>
      Ref.set(stateRef, {
        items: [],
        config: null,
        lastUpdated: Date.now(),
      })

    return {
      index,
      add,
      update,
      remove,
      search,
      prefix,
      fuzzy,
      stats,
      clear,
    }
  })
