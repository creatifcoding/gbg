/**
 * TMNL DataManager v1 - Namespaces
 *
 * Kernel namespacing for reusable atom shapes across different kernel types.
 *
 * This module provides:
 * - Atom families keyed by namespace (e.g., "search:movies", "senml:telemetry")
 * - KernelRegistry Effect.Service for factory + lookup
 * - useKernel hooks for React integration
 * - Provider components for tree-scoped kernels
 *
 * @example Basic Usage
 * ```tsx
 * import { useSearchKernel } from '@/lib/data-manager/v1/namespaces'
 *
 * function MovieSearch() {
 *   const { atoms, search, index, isReady } = useSearchKernel<Movie>("movies")
 *
 *   // Index on mount
 *   useEffect(() => {
 *     index(movies, { fields: ["title", "cast"] })
 *   }, [])
 *
 *   // Search
 *   const handleSearch = () => search({ query: inputValue })
 *
 *   // Read atoms
 *   const results = useAtomValue(atoms.results)
 *   const status = useAtomValue(atoms.status)
 * }
 * ```
 *
 * @example Provider Pattern
 * ```tsx
 * import { SearchKernelProvider, useSearchOpsFromContext } from '@/lib/data-manager/v1/namespaces'
 *
 * function App() {
 *   return (
 *     <SearchKernelProvider instance="movies">
 *       <MovieSearch />
 *       <MovieResults />
 *     </SearchKernelProvider>
 *   )
 * }
 *
 * function MovieSearch() {
 *   const { search, isReady } = useSearchOpsFromContext()
 *   // ...
 * }
 * ```
 *
 * @example Multiple Namespaces
 * ```tsx
 * // Two independent search kernels
 * const movies = useSearchKernel<Movie>("movies")
 * const users = useSearchKernel<User>("users")
 *
 * // Each has isolated state
 * movies.atoms.results  // → ScoredResult<Movie>[]
 * users.atoms.results   // → ScoredResult<User>[]
 * ```
 *
 * @experimental v1 API - additive extension to existing v1
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  NamespaceKey,
  NamespaceParts,
  KernelType,
  StreamStatus,
  StreamStats,
  ScoredResult,
  NamespaceAtoms,
  KernelShape,
  KernelConfig,
  SearchKernelConfig,
  SenMLKernelConfig,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Atom Families
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Individual families
  resultsFamily,
  statusFamily,
  statsFamily,
  queryFamily,
  isProcessingFamily,
  lastErrorFamily,
  // Derived families
  isStreamingFamily,
  hasResultsFamily,
  resultCountFamily,
  throughputFamily,
  // Bundle accessors
  getNamespaceAtoms,
  getNamespaceDerivedAtoms,
  // Utilities
  makeNamespaceKey,
  parseNamespaceKey,
} from "./atoms"

// ─────────────────────────────────────────────────────────────────────────────
// KernelRegistry Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  KernelRegistry,
  KernelRegistryLayer,
  type KernelRegistryShape,
  type SearchKernelInstance,
} from "./KernelRegistry"

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Full kernel hooks
  useKernelAtoms,
  useSearchKernel,
  // Convenience hooks
  useKernelResults,
  useKernelStatus,
  useKernelStats,
  // Types
  type UseKernelBase,
  type UseSearchKernel,
} from "./useKernel"

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

export {
  KernelProvider,
  SearchKernelProvider,
  useKernelContext,
  useSearchKernelContext,
  useKernelAtomsFromContext,
  useSearchOpsFromContext,
} from "./KernelProvider"
