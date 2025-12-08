/**
 * TMNL DataManager v1 - Public Exports
 *
 * @experimental v1 API may change. v2 when stable.
 *
 * @example
 * ```ts
 * import {
 *   DataManager,
 *   useDataManager,
 *   type SearchQuery
 * } from '@/lib/data-manager/v1'
 *
 * // Effect usage
 * const program = Effect.gen(function*() {
 *   const dm = yield* DataManager
 *   const stream = dm.search({ query: "matrix", limit: 100 })
 *   yield* Stream.runForEach(stream, (result) => Effect.log(result.item))
 * })
 *
 * // React usage
 * function SearchUI() {
 *   const { results, search, isSearching } = useDataManager<MovieItem>()
 *   // ...
 * }
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Service
// ─────────────────────────────────────────────────────────────────────────────

export { DataManager, DataManagerLive } from "./DataManager"

// ─────────────────────────────────────────────────────────────────────────────
// Kernels
// ─────────────────────────────────────────────────────────────────────────────

export {
  SearchKernel,
  createSearchKernel,
} from "./kernels"

export type {
  SearchPayload,
  SearchResultPayload,
  IndexPayload,
  IndexResultPayload,
} from "./kernels"

// ─────────────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Runtime
  dataManagerRuntimeAtom,
  // State atoms
  resultsAtom,
  statusAtom,
  statsAtom,
  driversAtom,
  isIndexingAtom,
  queryAtom,
  // Derived atoms
  isSearchingAtom,
  hasResultsAtom,
  resultCountAtom,
  throughputAtom,
  // Operation atoms
  searchOps,
  indexOps,
} from "./atoms"

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export { useDataManager } from "./hooks"
export type { UseDataManagerResult } from "./hooks"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Kernel types
  KernelType,
  Task,
  KernelResult,
  Kernel,
  // Stream types
  StreamStatus,
  StreamStats,
  // Search types
  SearchResult,
  FieldMatch,
  SearchQuery,
  // Driver types
  DriverState,
  DriverInstance,
  // Stats types
  DataManagerStats,
  // Atom types
  DataManagerAtoms,
  // Main interface
  DataManagerOps,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Namespace/Multi-instance support moved to v2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Namespace support has moved to v2.
 *
 * For multi-instance kernel management, use:
 * ```tsx
 * import { useSearchKernel, SearchKernelProvider } from '@/lib/data-manager/v2'
 * ```
 *
 * v1 remains as the singular DataManager pattern for simpler use cases.
 */
