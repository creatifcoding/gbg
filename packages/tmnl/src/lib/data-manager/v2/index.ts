/**
 * TMNL DataManager v2 - Universal DAQ Kernel System
 *
 * Multi-instance kernel namespacing for universal Data Acquisition.
 * Adapts to ANY data source: network, filesystem, serial/hardware, search, custom.
 *
 * @experimental v2 API - Universal DAQ pattern
 *
 * @example Basic Usage
 * ```tsx
 * import { useSearchKernel } from '@/lib/data-manager/v2'
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
 * import { SearchKernelProvider, useSearchOpsFromContext } from '@/lib/data-manager/v2'
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
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Namespace types
  NamespaceKey,
  NamespaceParts,
  KernelType,
  // Stream types
  StreamStatus,
  StreamStats,
  ScoredResult,
  NamespaceAtoms,
  // Kernel types
  KernelShape,
  KernelConfig,
  KernelFactory,
  AnyKernelConfig,
  // Search types
  SearchKernelConfig,
  SearchQuery,
  SearchResult,
  FieldMatch,
  // Network types
  WebSocketKernelConfig,
  SSEKernelConfig,
  PollingKernelConfig,
  WebTransportKernelConfig,
  // Filesystem types
  FileWatchKernelConfig,
  DirectoryScanKernelConfig,
  LogTailKernelConfig,
  // Serial/Hardware types
  SerialKernelConfig,
  SerialPortFilter,
  USBKernelConfig,
  USBDeviceFilter,
  HIDKernelConfig,
  HIDDeviceFilter,
  // Custom kernel types
  CustomKernelConfig,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Atom Families
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Core atom families
  resultsFamily,
  statusFamily,
  statsFamily,
  queryFamily,
  isProcessingFamily,
  lastErrorFamily,
  // Connection atom families (network/serial)
  connectionStateFamily,
  reconnectAttemptsFamily,
  lastHeartbeatFamily,
  // Derived atom families
  isStreamingFamily,
  isConnectedFamily,
  hasResultsFamily,
  resultCountFamily,
  throughputFamily,
  // Bundle accessors
  getNamespaceAtoms,
  getNamespaceDerivedAtoms,
  getConnectionAtoms,
  // Utilities
  makeNamespaceKey,
  parseNamespaceKey,
  isValidNamespaceKey,
  // Effect operations
  resetNamespaceAtoms,
  setNamespaceError,
  updateNamespaceStats,
  appendNamespaceResults,
} from "./atoms"

export type { ConnectionState } from "./atoms"

// ─────────────────────────────────────────────────────────────────────────────
// KernelRegistry Service
// ─────────────────────────────────────────────────────────────────────────────

export {
  KernelRegistry,
  KernelRegistryLayer,
  type KernelRegistryShape,
  type SearchKernelInstance,
  type RegistryStats,
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

// ─────────────────────────────────────────────────────────────────────────────
// Kernels
// ─────────────────────────────────────────────────────────────────────────────

export {
  createSearchKernel,
  SearchKernel,
  type SearchKernelShape,
  type DriverInstance,
} from "./kernels"
