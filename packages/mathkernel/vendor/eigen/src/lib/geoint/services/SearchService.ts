/**
 * SearchService - Effect Service with Atom-based State
 *
 * Encapsulates search complexity and provides reactive atoms for UI consumption.
 * Wraps the SearchClient AtomRpc.Tag with additional state management:
 *
 * - Active searches tracking
 * - Search history
 * - Result caching and aggregation
 * - Error handling with recovery
 *
 * @module
 */

import { Effect, Context, Layer, Ref, HashMap } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import { SearchClient } from '../clients'
import {
  SearchId,
  SearchQuery,
  SearchResponse,
  SearchResultItem,
  IntelSource,
  GeoFilterBounds,
} from '../schemas'

// =============================================================================
// Error Type
// =============================================================================

export class SearchServiceError extends Error {
  readonly _tag = 'SearchServiceError'
  constructor(
    readonly operation: string,
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'SearchServiceError'
  }
}

// =============================================================================
// State Atoms
// =============================================================================

/** Currently active search ID */
export const activeSearchIdAtom = Atom.make<SearchId | null>(null)

/** Search status */
export type SearchStatus = 'idle' | 'searching' | 'completed' | 'error'
export const searchStatusAtom = Atom.make<SearchStatus>('idle')

/** Last search response */
export const lastSearchResponseAtom = Atom.make<SearchResponse | null>(null)

/** Search results by source */
export const resultsBySourceAtom = Atom.make<HashMap.HashMap<IntelSource, readonly SearchResultItem[]>>(
  HashMap.empty()
)

/** Last error */
export const searchErrorAtom = Atom.make<SearchServiceError | null>(null)

/** Search history for current session (last N queries) */
export const sessionHistoryAtom = Atom.make<readonly SearchQuery[]>([])
const MAX_HISTORY = 20

// =============================================================================
// Derived Atoms (using Atom.readable for computed values)
// =============================================================================

/** All results flattened */
export const allResultsAtom = Atom.readable((get): SearchResultItem[] => {
  const bySource = get(resultsBySourceAtom)
  const results: SearchResultItem[] = []
  for (const [, items] of HashMap.entries(bySource)) {
    results.push(...items)
  }
  return results
})

/** Results count */
export const resultsCountAtom = Atom.readable((get): number => get(allResultsAtom).length)

/** Is searching */
export const isSearchingAtom = Atom.readable((get): boolean => get(searchStatusAtom) === 'searching')

// =============================================================================
// Service Interface
// =============================================================================

export interface SearchService {
  /**
   * Execute a multi-source search
   */
  readonly search: (query: SearchQuery) => Effect.Effect<SearchResponse, SearchServiceError>

  /**
   * Search within bounds with default sources
   */
  readonly searchInBounds: (
    bounds: readonly [number, number, number, number],
    options?: {
      sources?: readonly IntelSource[]
      limit?: number
    }
  ) => Effect.Effect<SearchResponse, SearchServiceError>

  /**
   * Cancel the active search (if supported by backend)
   */
  readonly cancelActiveSearch: () => Effect.Effect<void>

  /**
   * Clear search results
   */
  readonly clearResults: () => Effect.Effect<void>

  /**
   * Get the atom registry for this service
   */
  readonly registry: Registry.Registry
}

export class SearchServiceTag extends Context.Tag('geoint/SearchService')<
  SearchServiceTag,
  SearchService
>() {}

// =============================================================================
// Implementation
// =============================================================================

const make = Effect.gen(function* () {
  // Create isolated registry for this service instance
  const registry = Registry.make()

  // Access SearchClient
  const searchClient = yield* SearchClient

  // Generate unique search IDs
  const searchIdCounter = yield* Ref.make(0)
  const generateSearchId = Effect.gen(function* () {
    const count = yield* Ref.updateAndGet(searchIdCounter, (n) => n + 1)
    return `search-${Date.now()}-${count}` as SearchId
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Core Search Implementation
  // ─────────────────────────────────────────────────────────────────────────

  const search: SearchService['search'] = (query) =>
    Effect.gen(function* () {
      // Set searching state
      registry.set(activeSearchIdAtom, query.id)
      registry.set(searchStatusAtom, 'searching')
      registry.set(searchErrorAtom, null)

      // Add to history
      const history = registry.get(sessionHistoryAtom)
      registry.set(
        sessionHistoryAtom,
        [query, ...history.slice(0, MAX_HISTORY - 1)]
      )

      // Execute search via RPC
      const response = yield* searchClient('search', query).pipe(
        Effect.catchAll((error) => {
          registry.set(searchStatusAtom, 'error')
          const searchError = new SearchServiceError(
            'search',
            error instanceof Error ? error.message : String(error),
            error
          )
          registry.set(searchErrorAtom, searchError)
          return Effect.fail(searchError)
        })
      )

      // Update state with results
      registry.set(lastSearchResponseAtom, response)
      registry.set(searchStatusAtom, 'completed')

      // Group results by source
      const grouped = new Map<IntelSource, SearchResultItem[]>()
      for (const result of response.results) {
        const existing = grouped.get(result.source) ?? []
        existing.push(result)
        grouped.set(result.source, existing)
      }
      let finalMap = HashMap.empty<IntelSource, readonly SearchResultItem[]>()
      for (const [source, items] of grouped) {
        finalMap = HashMap.set(finalMap, source, items)
      }
      registry.set(resultsBySourceAtom, finalMap)

      return response
    })

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience Methods
  // ─────────────────────────────────────────────────────────────────────────

  const searchInBounds: SearchService['searchInBounds'] = (bounds, options) =>
    Effect.gen(function* () {
      const searchId = yield* generateSearchId
      const query = new SearchQuery({
        id: searchId,
        geoFilter: new GeoFilterBounds({
          bounds: bounds as [number, number, number, number],
        }),
        sources: [...(options?.sources ?? ['track', 'osm', 'opensky', 'feature'])],
        limitPerSource: options?.limit ?? 100,
      })
      return yield* search(query)
    })

  const cancelActiveSearch: SearchService['cancelActiveSearch'] = () =>
    Effect.gen(function* () {
      // Note: Cancel is a client-side operation for now
      // Backend support would require streaming cancellation
      registry.set(searchStatusAtom, 'idle')
      registry.set(activeSearchIdAtom, null)
    })

  const clearResults: SearchService['clearResults'] = () =>
    Effect.gen(function* () {
      registry.set(lastSearchResponseAtom, null)
      registry.set(resultsBySourceAtom, HashMap.empty())
      registry.set(searchStatusAtom, 'idle')
      registry.set(activeSearchIdAtom, null)
      registry.set(searchErrorAtom, null)
    })

  return {
    search,
    searchInBounds,
    cancelActiveSearch,
    clearResults,
    registry,
  } satisfies SearchService
})

// =============================================================================
// Layers
// =============================================================================

/**
 * SearchService live layer
 * Requires SearchClient to be provided
 */
export const SearchServiceLive = Layer.effect(SearchServiceTag, make)

/**
 * SearchService with mock for testing
 */
export const SearchServiceTest = Layer.effect(
  SearchServiceTag,
  Effect.gen(function* () {
    const registry = Registry.make()

    return {
      search: (_query) =>
        Effect.succeed(
          new SearchResponse({
            queryId: 'test-query' as SearchId,
            totalCount: 0,
            results: [],
            sourceCounts: {},
            executionTimeMs: 0,
            truncated: false,
          })
        ),
      searchInBounds: (_bounds, _options) =>
        Effect.succeed(
          new SearchResponse({
            queryId: 'test-query' as SearchId,
            totalCount: 0,
            results: [],
            sourceCounts: {},
            executionTimeMs: 0,
            truncated: false,
          })
        ),
      cancelActiveSearch: () => Effect.void,
      clearResults: () => Effect.void,
      registry,
    } satisfies SearchService
  })
)
