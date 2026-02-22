/**
 * TMNL DataManager v1 - useDataManager Hook
 *
 * Main React hook for DataManager integration.
 * Provides access to atoms and operations.
 *
 * @experimental v1 API may change. v2 when stable.
 */

import { useCallback } from "react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"

import {
  resultsAtom,
  statusAtom,
  statsAtom,
  driversAtom,
  isIndexingAtom,
  queryAtom,
  isSearchingAtom,
  hasResultsAtom,
  resultCountAtom,
  throughputAtom,
  searchOps,
  indexOps,
} from "../atoms"
import type {
  SearchResult,
  SearchQuery,
  StreamStatus,
  StreamStats,
  DriverState,
} from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseDataManagerResult<T = unknown> {
  // State (from atoms)
  readonly results: readonly SearchResult<T>[]
  readonly status: StreamStatus
  readonly stats: StreamStats
  readonly drivers: DriverState<T>
  readonly isIndexing: boolean
  readonly query: string

  // Derived state
  readonly isSearching: boolean
  readonly hasResults: boolean
  readonly resultCount: number
  readonly throughput: number

  // Operations
  readonly search: (query: SearchQuery) => Promise<readonly SearchResult<T>[]>
  readonly indexData: (items: readonly T[], config: { fields: readonly string[] }) => Promise<void>
  readonly setDriver: (driver: "flex" | "linear") => Promise<void>
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useDataManager - Main hook for DataManager integration
 *
 * Provides reactive access to search state and operations.
 * All state updates are automatic via effect-atom subscriptions.
 *
 * @example
 * ```tsx
 * function SearchUI() {
 *   const {
 *     results,
 *     isSearching,
 *     search,
 *     index
 *   } = useDataManager<MovieItem>()
 *
 *   useEffect(() => {
 *     index(movies, ["title", "cast", "genres"])
 *   }, [movies])
 *
 *   const handleSearch = async (query: string) => {
 *     await search({ query, limit: 100 })
 *   }
 *
 *   return (
 *     <div>
 *       {isSearching && <Spinner />}
 *       {results.map((r) => <Result key={r.item.id} result={r} />)}
 *     </div>
 *   )
 * }
 * ```
 */
export function useDataManager<T = unknown>(): UseDataManagerResult<T> {
  // ─────────────────────────────────────────────────────────────────────────
  // Atom Subscriptions (plain Atom.make atoms return values directly)
  // ─────────────────────────────────────────────────────────────────────────

  const results = useAtomValue(resultsAtom) as readonly SearchResult<T>[]
  const status = useAtomValue(statusAtom)
  const stats = useAtomValue(statsAtom)
  const drivers = useAtomValue(driversAtom) as DriverState<T>
  const isIndexing = useAtomValue(isIndexingAtom)
  const query = useAtomValue(queryAtom)

  // Derived atoms (also return values directly)
  const isSearching = useAtomValue(isSearchingAtom)
  const hasResults = useAtomValue(hasResultsAtom)
  const resultCount = useAtomValue(resultCountAtom)
  const throughput = useAtomValue(throughputAtom)

  // ─────────────────────────────────────────────────────────────────────────
  // Operation Setters (fn atoms return promises)
  // ─────────────────────────────────────────────────────────────────────────

  const doSearch = useAtomSet(searchOps.search, { mode: "promise" })
  const doSetDriver = useAtomSet(searchOps.setDriver, { mode: "promise" })
  const doIndex = useAtomSet(indexOps.index, { mode: "promise" })

  // ─────────────────────────────────────────────────────────────────────────
  // Wrapped Operations
  // ─────────────────────────────────────────────────────────────────────────

  const search = useCallback(
    async (searchQuery: SearchQuery): Promise<readonly SearchResult<T>[]> => {
      const result = await doSearch(searchQuery)
      return result as readonly SearchResult<T>[]
    },
    [doSearch]
  )

  const indexData = useCallback(
    async (items: readonly T[], config: { fields: readonly string[] }): Promise<void> => {
      await doIndex({ items: items as readonly unknown[], fields: config.fields })
    },
    [doIndex]
  )

  const setDriver = useCallback(
    async (driver: "flex" | "linear"): Promise<void> => {
      await doSetDriver(driver)
    },
    [doSetDriver]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Return Interface
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // State
    results,
    status,
    stats,
    drivers,
    isIndexing,
    query,

    // Derived
    isSearching,
    hasResults,
    resultCount,
    throughput,

    // Operations
    search,
    indexData,
    setDriver,
  }
}
