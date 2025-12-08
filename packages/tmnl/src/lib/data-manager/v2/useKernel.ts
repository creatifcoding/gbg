/**
 * TMNL DataManager v2 - useKernel Hook
 *
 * React hook for consuming namespaced kernel instances.
 * Provides typed access to kernel atoms and operations.
 *
 * @experimental v2 API - Universal DAQ pattern
 */

import { useCallback, useEffect, useState, useMemo } from "react"
import { Atom } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"
import * as Effect from "effect/Effect"

import type {
  KernelType,
  NamespaceKey,
  NamespaceAtoms,
  ScoredResult,
  StreamStatus,
  StreamStats,
  SearchKernelConfig,
  SearchQuery,
  SearchResult,
} from "./types"
import {
  getNamespaceAtoms,
  getNamespaceDerivedAtoms,
  makeNamespaceKey,
} from "./atoms"
import { KernelRegistry, type SearchKernelInstance } from "./KernelRegistry"
import type { Indexable, IndexConfig } from "@/lib/search/types"

// ─────────────────────────────────────────────────────────────────────────────
// Hook Return Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base kernel hook return (all kernel types)
 */
export interface UseKernelBase<T = unknown> {
  /** Namespace key */
  readonly namespaceKey: NamespaceKey

  /** Whether the kernel is initialized */
  readonly isReady: boolean

  /** Atom accessors for this namespace */
  readonly atoms: NamespaceAtoms<T>

  /** Derived atoms (computed) */
  readonly derived: {
    readonly isStreaming: Atom.Atom<boolean>
    readonly isConnected: Atom.Atom<boolean>
    readonly hasResults: Atom.Atom<boolean>
    readonly resultCount: Atom.Atom<number>
    readonly throughput: Atom.Atom<number>
  }
}

/**
 * Search kernel hook return
 */
export interface UseSearchKernel<T extends Indexable> extends UseKernelBase<T> {
  /** Index items into the kernel */
  readonly index: (items: readonly T[], config: IndexConfig<T>) => Promise<void>

  /** Execute search (updates atoms automatically) */
  readonly search: (query: SearchQuery) => Promise<readonly SearchResult<T>[]>

  /** Set active driver */
  readonly setDriver: (driver: "flex" | "linear") => Promise<void>

  /** The underlying kernel instance (for advanced use) */
  readonly kernel: SearchKernelInstance<T> | null
}

// ─────────────────────────────────────────────────────────────────────────────
// useKernelAtoms Hook (Generic)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic kernel hook - returns atoms only (no operations)
 *
 * Use when you only need to read kernel state, not trigger operations.
 *
 * @param type - Kernel type ("search", "network", etc.)
 * @param instance - Instance name within type namespace
 */
export function useKernelAtoms<T = unknown>(
  type: KernelType,
  instance: string
): UseKernelBase<T> {
  const namespaceKey = useMemo(
    () => makeNamespaceKey(type, instance),
    [type, instance]
  )

  const atoms = useMemo(() => getNamespaceAtoms<T>(namespaceKey), [namespaceKey])

  const derived = useMemo(
    () => getNamespaceDerivedAtoms(namespaceKey),
    [namespaceKey]
  )

  // Check if kernel exists by reading status
  const status = useAtomValue(atoms.status)
  const isReady = status !== "idle" || Atom.get(atoms.isProcessing)

  return {
    namespaceKey,
    isReady,
    atoms,
    derived,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useSearchKernel Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search kernel hook with full operations
 *
 * Creates/retrieves a SearchKernel instance for the given namespace.
 * Automatically initializes the kernel on mount.
 *
 * @param instance - Instance name (e.g., "movies", "users")
 * @param config - Optional kernel configuration
 *
 * @example
 * ```tsx
 * function MovieSearch() {
 *   const { atoms, search, index, isReady } = useSearchKernel<Movie>("movies")
 *
 *   useEffect(() => {
 *     // Index data on mount
 *     index(movies, { fields: ["title", "cast", "genres"] })
 *   }, [])
 *
 *   const handleSearch = async () => {
 *     await search({ query: inputValue, limit: 100 })
 *   }
 *
 *   const results = useAtomValue(atoms.results)
 *   const status = useAtomValue(atoms.status)
 *
 *   return (
 *     <div>
 *       <input onChange={...} />
 *       <button onClick={handleSearch}>Search</button>
 *       <ResultsList results={results} status={status} />
 *     </div>
 *   )
 * }
 * ```
 */
export function useSearchKernel<T extends Indexable>(
  instance: string,
  config?: Omit<SearchKernelConfig, "instance">
): UseSearchKernel<T> {
  const namespaceKey = useMemo(
    () => makeNamespaceKey("search", instance),
    [instance]
  )

  const atoms = useMemo(() => getNamespaceAtoms<T>(namespaceKey), [namespaceKey])

  const derived = useMemo(
    () => getNamespaceDerivedAtoms(namespaceKey),
    [namespaceKey]
  )

  // Kernel instance state
  const [kernel, setKernel] = useState<SearchKernelInstance<T> | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Initialize kernel on mount
  useEffect(() => {
    let mounted = true

    const initKernel = async () => {
      try {
        const program = Effect.gen(function* () {
          const registry = yield* KernelRegistry
          return yield* registry.getSearchKernel<T>({
            instance,
            ...config,
          })
        }).pipe(Effect.provide(KernelRegistry.Default))

        const kernelInstance = await Effect.runPromise(program)

        if (mounted) {
          setKernel(kernelInstance)
          setIsReady(true)
        }
      } catch (error) {
        console.error(
          `[useSearchKernel] Failed to initialize kernel: ${instance}`,
          error
        )
      }
    }

    initKernel()

    return () => {
      mounted = false
    }
  }, [instance, config?.driver, config?.warmUp, config?.autoDispose])

  // Memoized operations
  const index = useCallback(
    async (items: readonly T[], indexConfig: IndexConfig<T>) => {
      if (!kernel) {
        throw new Error(`Kernel not initialized: search:${instance}`)
      }
      await Effect.runPromise(kernel.index(items, indexConfig))
    },
    [kernel, instance]
  )

  const search = useCallback(
    async (query: SearchQuery) => {
      if (!kernel) {
        throw new Error(`Kernel not initialized: search:${instance}`)
      }
      return await Effect.runPromise(kernel.search(query))
    },
    [kernel, instance]
  )

  const setDriver = useCallback(
    async (driver: "flex" | "linear") => {
      if (!kernel) {
        throw new Error(`Kernel not initialized: search:${instance}`)
      }
      await Effect.runPromise(kernel.setDriver(driver))
    },
    [kernel, instance]
  )

  return {
    namespaceKey,
    isReady,
    atoms,
    derived,
    kernel,
    index,
    search,
    setDriver,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Atom Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Direct access to results atom for a namespace
 */
export function useKernelResults<T = unknown>(
  type: KernelType,
  instance: string
): readonly ScoredResult<T>[] {
  const namespaceKey = makeNamespaceKey(type, instance)
  const atoms = getNamespaceAtoms<T>(namespaceKey)
  return useAtomValue(atoms.results)
}

/**
 * Direct access to status atom for a namespace
 */
export function useKernelStatus(type: KernelType, instance: string): StreamStatus {
  const namespaceKey = makeNamespaceKey(type, instance)
  const atoms = getNamespaceAtoms(namespaceKey)
  return useAtomValue(atoms.status)
}

/**
 * Direct access to stats atom for a namespace
 */
export function useKernelStats(type: KernelType, instance: string): StreamStats {
  const namespaceKey = makeNamespaceKey(type, instance)
  const atoms = getNamespaceAtoms(namespaceKey)
  return useAtomValue(atoms.stats)
}
