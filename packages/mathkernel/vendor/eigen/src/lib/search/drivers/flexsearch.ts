/**
 * TMNL Search — FlexSearch Driver
 *
 * Stream-first search implementation using FlexSearch Document index.
 * Optimized for 5000+ item collections with progressive result emission.
 */

import { Effect, Ref, Stream } from 'effect'
import { Document, Charset } from 'flexsearch'
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
// FlexSearch State
// ─────────────────────────────────────────────────────────────────────────────

interface FlexSearchState<T extends Indexable> {
  index: Document<T> | null
  config: IndexConfig<T> | null
  items: Map<string | number, T>
  itemCount: number
  lastUpdated: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a FlexSearch-backed search service with Stream emission
 */
export const createFlexSearchDriver = <T extends Indexable>(): Effect.Effect<
  SearchServiceImpl<T>,
  never,
  never
> =>
  Effect.gen(function* () {
    // Internal state
    const stateRef = yield* Ref.make<FlexSearchState<T>>({
      index: null,
      config: null,
      items: new Map(),
      itemCount: 0,
      lastUpdated: 0,
    })

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    const getIndex = (): Effect.Effect<Document<T>, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        if (!state.index) {
          return yield* Effect.fail({
            _tag: 'IndexNotReady' as const,
            message: 'Index not initialized. Call index() first.',
          })
        }
        return state.index
      })

    const getItems = (): Effect.Effect<Map<string | number, T>, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.items
      })

    const normalizeFieldConfig = (
      field: keyof T | FieldConfig
    ): { field: string; tokenize: string; weight: number } => {
      if (typeof field === 'string') {
        return { field: field as string, tokenize: 'forward', weight: 1 }
      }
      return {
        field: field.field,
        tokenize: field.tokenize ?? 'forward',
        weight: field.weight ?? 1,
      }
    }

    /**
     * Map FlexSearch results to SearchResult format
     */
    const mapFlexSearchResults = (
      results: unknown,
      items: Map<string | number, T>
    ): SearchResult<T>[] => {
      if (!Array.isArray(results)) return []

      const seen = new Set<string | number>()
      const mapped: SearchResult<T>[] = []

      for (const fieldResult of results) {
        const fr = fieldResult as {
          field: string
          result: Array<{ id: string | number; doc?: T } | string | number>
        }
        if (!fr.result) continue

        for (let i = 0; i < fr.result.length; i++) {
          const entry = fr.result[i]
          const id =
            typeof entry === 'object' && entry !== null
              ? (entry as { id: string | number }).id
              : entry
          const doc =
            typeof entry === 'object' && entry !== null
              ? (entry as { doc?: T }).doc
              : undefined

          if (seen.has(id)) continue
          seen.add(id)

          const item = doc ?? items.get(id)
          if (!item) continue

          // Score based on position (higher position = better match)
          const score = 1 - i / Math.max(fr.result.length, 1)

          mapped.push({
            item,
            score,
            matches: [{ field: fr.field }],
          })
        }
      }

      // Sort by score descending
      return mapped.sort((a, b) => b.score - a.score)
    }

    /**
     * Execute FlexSearch and return results as Effect
     */
    const executeSearch = (
      query: string,
      options?: SearchOptions
    ): Effect.Effect<SearchResult<T>[], SearchError> =>
      Effect.gen(function* () {
        if (!query.trim()) {
          return []
        }

        const flexIndex = yield* getIndex()
        const items = yield* getItems()

        // Build search options
        const searchOpts: Record<string, unknown> = {
          query,
          limit: options?.limit ?? 100,
          enrich: true,
          suggest: options?.suggest ?? false,
        }

        // Field filtering
        if (options?.fields && options.fields.length > 0) {
          searchOpts.index = options.fields
        }

        const results = flexIndex.search(searchOpts)
        let mapped = mapFlexSearchResults(results, items)

        // Apply boost weights
        if (options?.boost) {
          mapped = mapped.map((r) => {
            let boostMultiplier = 1
            for (const match of r.matches ?? []) {
              const boost = options.boost?.[match.field]
              if (boost) boostMultiplier *= boost
            }
            return { ...r, score: r.score * boostMultiplier }
          })
          mapped = [...mapped].sort((a, b) => b.score - a.score)
        }

        // Apply limit
        if (options?.limit) {
          mapped = mapped.slice(0, options.limit)
        }

        return mapped
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Mutations (Effect - one-shot)
    // ─────────────────────────────────────────────────────────────────────────

    const index = (
      inputItems: readonly T[],
      config: IndexConfig<T>
    ): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const fields = config.fields.map(normalizeFieldConfig)
        const idField = (config.idField as string) ?? 'id'

        // Build FlexSearch document descriptor
        const documentDescriptor = {
          id: idField,
          store: config.store ?? true,
          index: fields.map((f) => ({
            field: f.field,
            tokenize: f.tokenize as 'strict' | 'forward' | 'reverse' | 'full',
            encoder: Charset.LatinBalance,
          })),
        }

        const flexIndex = new Document<T>({
          // @ts-expect-error - FlexSearch types are incomplete
          fastupdate: true,
          document: documentDescriptor,
        })

        // Build lookup map
        const itemMap = new Map<string | number, T>()

        // Index all items
        for (const item of inputItems) {
          const id = item[idField as keyof T] as string | number
          itemMap.set(id, item)
          flexIndex.add(item)
        }

        yield* Ref.set(stateRef, {
          index: flexIndex,
          config,
          items: itemMap,
          itemCount: inputItems.length,
          lastUpdated: Date.now(),
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail({
            _tag: 'IndexError' as const,
            message: 'Failed to create index',
            cause: error,
          })
        )
      )

    const add = (item: T): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const flexIndex = yield* getIndex()
        const state = yield* Ref.get(stateRef)
        const idField = (state.config?.idField as string) ?? 'id'
        const id = item[idField as keyof T] as string | number

        flexIndex.add(item)
        state.items.set(id, item)

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          itemCount: s.itemCount + 1,
          lastUpdated: Date.now(),
        }))
      })

    const update = (item: T): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const flexIndex = yield* getIndex()
        const state = yield* Ref.get(stateRef)
        const idField = (state.config?.idField as string) ?? 'id'
        const id = item[idField as keyof T] as string | number

        flexIndex.update(item)
        state.items.set(id, item)

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          lastUpdated: Date.now(),
        }))
      })

    const remove = (id: string | number): Effect.Effect<void, SearchError> =>
      Effect.gen(function* () {
        const flexIndex = yield* getIndex()
        const state = yield* Ref.get(stateRef)

        flexIndex.remove(id)
        state.items.delete(id)

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          itemCount: Math.max(0, s.itemCount - 1),
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
          const results = yield* executeSearch(query, options)
          const chunkSize = options?.chunkSize ?? 10

          // Emit results progressively in chunks
          return Stream.fromIterable(results).pipe(
            // Group into chunks for batched UI updates
            Stream.grouped(chunkSize),
            // Flatten chunks back to individual results
            Stream.flatMap((chunk) => Stream.fromIterable(chunk))
          )
        })
      )

    const prefix = (
      query: string,
      options?: Omit<SearchOptions, 'strategy'>
    ): Stream.Stream<SearchResult<T>, SearchError> =>
      // FlexSearch with forward tokenizer naturally supports prefix
      search(query, { ...options, strategy: 'prefix' })

    const fuzzy = (
      query: string,
      options?: Omit<SearchOptions, 'strategy'>
    ): Stream.Stream<SearchResult<T>, SearchError> =>
      // FlexSearch suggest mode provides fuzzy-like behavior
      search(query, { ...options, suggest: true, strategy: 'fuzzy' })

    // ─────────────────────────────────────────────────────────────────────────
    // Admin (Effect - one-shot)
    // ─────────────────────────────────────────────────────────────────────────

    const stats = (): Effect.Effect<SearchStats, SearchError> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const config = state.config

        return {
          itemCount: state.itemCount,
          fieldCount: config?.fields.length ?? 0,
          lastUpdated: state.lastUpdated || undefined,
          // Memory estimation: ~1KB per item for moderate-sized documents
          memoryUsage: state.itemCount * 1024,
        }
      })

    const clear = (): Effect.Effect<void, SearchError> =>
      Ref.set(stateRef, {
        index: null,
        config: null,
        items: new Map(),
        itemCount: 0,
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
