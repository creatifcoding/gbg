/**
 * SearchProvider - React Context for GEOINT Search Execution
 *
 * Provides search functionality to SearchPanel and other components.
 * Uses Atom.runtime + runtimeAtom.fn pattern for Effect integration.
 *
 * Features:
 * - Executes search via SearchClient (real WebSocket RPC)
 * - Updates geointRegistry atoms directly via ctx.set()
 * - Provides search operations via context
 * - Supports mock layers for testing via searchClientLayer prop
 *
 * Pattern: Atom.runtime(Layer) → runtimeAtom.fn<Input>() → ctx.effect.gen()
 *
 * @module geoint/components/SearchProvider
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { Atom, Registry } from '@effect-atom/atom'
import { useAtomSet } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { SearchClient } from '../clients'
import {
  geointRegistry,
  searchQueryAtom,
  resultsAtom,
  searchStatusAtom,
  searchErrorAtom,
  searchTypedErrorAtom,
  searchRetryCountAtom,
  lastSearchTimeAtom,
} from '../atoms'
import { parseError } from '../schemas'
import { SearchQuery, GeoFilterBounds, SearchId } from '../schemas'
import type { BBox, IntelSource, SearchResultItem } from '../schemas'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Search runtime atom with SearchClient layer.
 * This creates the Effect runtime for search operations.
 */
export const searchRuntimeAtom = Atom.runtime(SearchClient.layer)

// =============================================================================
// Search Operations (runtimeAtom.fn pattern)
// =============================================================================

/**
 * Search operations using runtimeAtom.fn pattern.
 * These execute Effect programs and update atoms via ctx.set().
 */
export const searchOps = {
  /**
   * Execute search with full SearchQuery object.
   * Updates status → executes RPC → sets results or error.
   * Uses typed errors for proper error classification and retry logic.
   */
  executeQuery: searchRuntimeAtom.fn<SearchQuery>()((query, ctx) =>
    Effect.gen(function* () {
      // Set searching state and clear previous error
      ctx.set(searchStatusAtom, 'searching')
      ctx.set(searchErrorAtom, null)
      ctx.set(searchTypedErrorAtom, null)
      ctx.set(searchQueryAtom, query)

      // Get client from context and execute RPC
      const client = yield* SearchClient
      const response = yield* client('search', query)

      // Success: update atoms with results and reset retry count
      ctx.set(resultsAtom, response.results as readonly SearchResultItem[])
      ctx.set(lastSearchTimeAtom, Date.now())
      ctx.set(searchStatusAtom, 'completed')
      ctx.set(searchRetryCountAtom, 0)

      return response
    }).pipe(
      Effect.catchAll((error) => {
        // Parse error into typed SearchError
        const typedError = parseError(error)

        // Update atoms with both string message and typed error
        ctx.set(searchErrorAtom, typedError.userMessage)
        ctx.set(searchTypedErrorAtom, typedError)
        ctx.set(searchStatusAtom, 'error')

        // Log for debugging
        console.error('[SearchProvider] Search failed:', {
          category: typedError.category,
          message: typedError.message,
          recoverable: typedError.recoverable,
          tag: typedError._tag,
        })

        return Effect.fail(typedError)
      })
    )
  ),

  /**
   * Retry the last failed search (increments retry count).
   * Must read from geointRegistry since FnContext doesn't have get().
   */
  retrySearch: searchRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      // Read current state from registry (sync)
      const query = geointRegistry.get(searchQueryAtom)
      const typedError = geointRegistry.get(searchTypedErrorAtom)
      const currentRetries = geointRegistry.get(searchRetryCountAtom)

      // Check if we can retry
      const canRetry = typedError !== null &&
        typedError.recoverable &&
        currentRetries < 3

      if (!query || !canRetry) {
        return
      }

      // Increment retry count
      ctx.set(searchRetryCountAtom, currentRetries + 1)

      // Execute the search again
      ctx.set(searchStatusAtom, 'searching')
      ctx.set(searchErrorAtom, null)
      ctx.set(searchTypedErrorAtom, null)

      const client = yield* SearchClient
      const response = yield* client('search', query)

      // Success
      ctx.set(resultsAtom, response.results as readonly SearchResultItem[])
      ctx.set(lastSearchTimeAtom, Date.now())
      ctx.set(searchStatusAtom, 'completed')
      ctx.set(searchRetryCountAtom, 0)

      return response
    }).pipe(
      Effect.catchAll((error) => {
        const typedError = parseError(error)
        ctx.set(searchErrorAtom, typedError.userMessage)
        ctx.set(searchTypedErrorAtom, typedError)
        ctx.set(searchStatusAtom, 'error')
        return Effect.fail(typedError)
      })
    )
  ),

  /**
   * Clear all search results and reset state.
   */
  clearResults: searchRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      ctx.set(resultsAtom, [])
      ctx.set(searchQueryAtom, null)
      ctx.set(searchStatusAtom, 'idle')
      ctx.set(searchErrorAtom, null)
      ctx.set(searchTypedErrorAtom, null)
      ctx.set(searchRetryCountAtom, 0)
    })
  ),

  /**
   * Cancel ongoing search (set status to idle).
   * Note: Actual fiber cancellation is handled by effect-atom's useAtomSet.
   */
  cancelSearch: searchRuntimeAtom.fn()((_, ctx) =>
    Effect.gen(function* () {
      ctx.set(searchStatusAtom, 'idle')
    })
  ),
}

// =============================================================================
// Types
// =============================================================================

export interface SearchContextValue {
  /** Execute search with bounds and sources */
  executeSearch: (bounds: BBox, sources: IntelSource[]) => Promise<void>
  /** Execute search with full query object */
  executeQuery: (query: SearchQuery) => Promise<void>
  /** Cancel ongoing search */
  cancelSearch: () => void
  /** Clear search results */
  clearResults: () => void
  /** Registry for direct atom access if needed */
  registry: Registry.Registry
}

const SearchContext = createContext<SearchContextValue | null>(null)

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access search context from within SearchProvider.
 * @throws Error if used outside SearchProvider
 */
export const useSearchContext = (): SearchContextValue => {
  const ctx = useContext(SearchContext)
  if (!ctx) {
    throw new Error('useSearchContext must be used within a SearchProvider')
  }
  return ctx
}

/**
 * Access search context, returns null if outside provider.
 * Useful for components that can work with or without provider.
 */
export const useSearchContextOptional = (): SearchContextValue | null => {
  return useContext(SearchContext)
}

// =============================================================================
// Provider Props
// =============================================================================

export interface SearchProviderProps {
  children: ReactNode
  /** Registry to use for atom state (defaults to geointRegistry) */
  registry?: Registry.Registry
}

// =============================================================================
// Helper: Generate Search ID
// =============================================================================

const generateSearchId = (): SearchId => {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as SearchId
}

// =============================================================================
// Provider Implementation
// =============================================================================

/**
 * SearchProvider - Provides search execution context to child components.
 *
 * Uses Atom.runtime + runtimeAtom.fn pattern for idiomatic Effect integration.
 * Operations are executed via useAtomSet which handles:
 * - Layer provision (via searchRuntimeAtom)
 * - Automatic state updates (via ctx.set())
 * - Result handling (via mode: "promiseExit")
 *
 * @example
 * ```tsx
 * <SearchProvider>
 *   <SearchPanel />
 *   <SearchResults />
 * </SearchProvider>
 * ```
 */
export const SearchProvider = ({
  children,
  registry = geointRegistry,
}: SearchProviderProps) => {
  // Use useAtomSet with promiseExit mode for proper Effect execution
  const executeQueryFn = useAtomSet(searchOps.executeQuery, { mode: 'promiseExit' })
  const clearResultsFn = useAtomSet(searchOps.clearResults, { mode: 'promiseExit' })
  const cancelSearchFn = useAtomSet(searchOps.cancelSearch, { mode: 'promiseExit' })

  /**
   * Execute search with full SearchQuery.
   */
  const executeQuery = useCallback(async (query: SearchQuery): Promise<void> => {
    const exit = await executeQueryFn(query)
    if (exit._tag === 'Failure') {
      // Error already set in atom by searchOps.executeQuery
      console.error('[SearchProvider] Search failed:', exit.cause)
    }
  }, [executeQueryFn])

  /**
   * Convenience method: Execute search with bounds and sources.
   */
  const executeSearch = useCallback(async (
    bounds: BBox,
    sources: IntelSource[]
  ): Promise<void> => {
    const query = new SearchQuery({
      id: generateSearchId(),
      geoFilter: new GeoFilterBounds({ bounds }),
      sources: [...sources],
      limitPerSource: 100,
    })
    return executeQuery(query)
  }, [executeQuery])

  /**
   * Cancel any active search.
   */
  const cancelSearch = useCallback(() => {
    // Note: useAtomSet handles fiber interruption automatically
    // We just need to update the status
    cancelSearchFn(undefined).catch(() => {
      // Ignore cancellation errors
    })
  }, [cancelSearchFn])

  /**
   * Clear results.
   */
  const handleClearResults = useCallback(() => {
    clearResultsFn(undefined).catch(() => {
      // Ignore errors during clear
    })
  }, [clearResultsFn])

  // Memoized context value
  const contextValue = useMemo<SearchContextValue>(() => ({
    executeSearch,
    executeQuery,
    cancelSearch,
    clearResults: handleClearResults,
    registry,
  }), [executeSearch, executeQuery, cancelSearch, handleClearResults, registry])

  return (
    <SearchContext.Provider value={contextValue}>
      {children}
    </SearchContext.Provider>
  )
}

// =============================================================================
// Integration Test Utilities
// =============================================================================

/**
 * Mount the search runtime on a registry for integration tests.
 * This wires up the real SearchClient with WebSocket RPC.
 *
 * @example
 * ```typescript
 * import { it } from '@effect/vitest'
 * import { Registry } from '@effect-atom/atom'
 * import { mountSearchRuntime, searchOps, geointRegistry } from './SearchProvider'
 *
 * // Mount runtime before tests
 * mountSearchRuntime(geointRegistry)
 *
 * it.effect('executes real search', () =>
 *   Effect.gen(function* () {
 *     // Run the operation
 *     const exit = yield* geointRegistry.get(searchOps.executeQuery(testQuery))
 *     expect(Exit.isSuccess(exit)).toBe(true)
 *   })
 * )
 * ```
 *
 * @see __tests__/integration/real-apis.test.ts for full integration tests
 */
export const mountSearchRuntime = (registry: Registry.Registry = geointRegistry) => {
  registry.mount(searchRuntimeAtom)
  registry.mount(searchStatusAtom)
  registry.mount(resultsAtom)
  registry.mount(searchQueryAtom)
  registry.mount(searchErrorAtom)
  registry.mount(lastSearchTimeAtom)
}

export default SearchProvider
