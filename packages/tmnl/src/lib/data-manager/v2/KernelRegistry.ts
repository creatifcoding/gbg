/**
 * TMNL DataManager v2 - KernelRegistry Service
 *
 * Effect.Service for kernel factory + lookup with namespaced atoms.
 * Implements the Registry pattern for kernel instance management.
 *
 * Pattern:
 * - Factory: Create kernel instances with namespace scoping
 * - Registry: Lookup existing instances by namespace key
 * - Lifecycle: Track active kernels for disposal
 *
 * Uses:
 * - Effect.fn for traced operations
 * - Effect.fnUntraced for hot paths
 * - Console for descriptive logging
 * - Spans for observability
 *
 * @experimental v2 API - Universal DAQ pattern
 */

import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import * as Console from "effect/Console"
import * as Scope from "effect/Scope"
import { Atom } from "@effect-atom/atom"
import { pipe } from "effect/Function"

import type {
  NamespaceKey,
  KernelType,
  KernelShape,
  KernelConfig,
  SearchKernelConfig,
  SearchQuery,
  SearchResult,
  StreamStats,
  ScoredResult,
} from "./types"
import {
  getNamespaceAtoms,
  makeNamespaceKey,
  resultsFamily,
  statusFamily,
  statsFamily,
  queryFamily,
  isProcessingFamily,
  lastErrorFamily,
  resetNamespaceAtoms,
  setNamespaceError,
} from "./atoms"
import type { Indexable, IndexConfig } from "@/lib/search/types"

// ─────────────────────────────────────────────────────────────────────────────
// Registry State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal kernel entry with metadata
 */
interface KernelEntry {
  readonly kernel: KernelShape<unknown, unknown>
  readonly createdAt: number
  readonly config: KernelConfig
}

/**
 * Registry state - HashMap of namespace keys to kernel entries
 */
type RegistryState = HashMap.HashMap<NamespaceKey, KernelEntry>

// ─────────────────────────────────────────────────────────────────────────────
// KernelRegistry Service Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KernelRegistry service shape
 */
export interface KernelRegistryShape {
  /**
   * Create or get a search kernel for a namespace
   */
  readonly getSearchKernel: <T extends Indexable>(
    config: SearchKernelConfig
  ) => Effect.Effect<SearchKernelInstance<T>>

  /**
   * Lookup kernel by namespace key (returns Option)
   */
  readonly lookup: (
    key: NamespaceKey
  ) => Effect.Effect<Option.Option<KernelShape<unknown, unknown>>>

  /**
   * Check if namespace exists
   */
  readonly has: (key: NamespaceKey) => Effect.Effect<boolean>

  /**
   * List all active namespace keys
   */
  readonly listNamespaces: () => Effect.Effect<readonly NamespaceKey[]>

  /**
   * List namespaces by kernel type
   */
  readonly listByType: (
    type: KernelType
  ) => Effect.Effect<readonly NamespaceKey[]>

  /**
   * Release a kernel (removes from registry, optionally disposes atoms)
   */
  readonly release: (key: NamespaceKey) => Effect.Effect<void>

  /**
   * Clear all kernels
   */
  readonly clear: () => Effect.Effect<void>

  /**
   * Get registry statistics
   */
  readonly getStats: () => Effect.Effect<RegistryStats>
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  readonly totalKernels: number
  readonly byType: Record<KernelType, number>
  readonly oldestKernel: number | null
  readonly newestKernel: number | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Kernel Instance (Extended KernelShape)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SearchKernelInstance - KernelShape with search-specific extensions
 */
export interface SearchKernelInstance<T extends Indexable>
  extends KernelShape<T, SearchQuery> {
  readonly type: "search"

  /**
   * Index items into this kernel's driver
   */
  readonly index: (
    items: readonly T[],
    config: IndexConfig<T>
  ) => Effect.Effect<void>

  /**
   * Execute search and update namespaced atoms
   */
  readonly search: (query: SearchQuery) => Effect.Effect<readonly SearchResult<T>[]>

  /**
   * Set active driver (flex or linear)
   */
  readonly setDriver: (driver: "flex" | "linear") => Effect.Effect<void>

  /**
   * Get current driver name
   */
  readonly getDriver: () => Effect.Effect<"flex" | "linear">
}

// ─────────────────────────────────────────────────────────────────────────────
// Create KernelRegistry Implementation
// ─────────────────────────────────────────────────────────────────────────────

const createKernelRegistry = (): Effect.Effect<KernelRegistryShape> =>
  Effect.gen(function* () {
    // Internal registry state
    const registryRef = yield* Ref.make<RegistryState>(HashMap.empty())

    yield* Console.log("[v2/KernelRegistry] Initialized")

    // ─────────────────────────────────────────────────────────────────────────
    // Search Kernel Factory
    // ─────────────────────────────────────────────────────────────────────────

    const getSearchKernel = <T extends Indexable>(
      config: SearchKernelConfig
    ): Effect.Effect<SearchKernelInstance<T>> =>
      Effect.gen(function* () {
        const namespaceKey = makeNamespaceKey("search", config.instance)

        yield* Console.log(`[v2/KernelRegistry] getSearchKernel: ${namespaceKey}`)

        // Check if already exists
        const registry = yield* Ref.get(registryRef)
        const existing = HashMap.get(registry, namespaceKey)

        if (Option.isSome(existing)) {
          yield* Console.log(`[v2/KernelRegistry] Returning existing: ${namespaceKey}`)
          return existing.value.kernel as SearchKernelInstance<T>
        }

        yield* Console.log(`[v2/KernelRegistry] Creating new: ${namespaceKey}`)

        // Lazy import to avoid circular deps
        const { createSearchKernel } = yield* Effect.promise(
          () => import("./kernels/SearchKernel")
        )

        // Create new kernel
        const baseKernel = yield* createSearchKernel<T>()

        // Get namespaced atoms
        const atoms = getNamespaceAtoms<T>(namespaceKey)

        // Current driver tracking
        let currentDriver: "flex" | "linear" = config.driver ?? "flex"

        // Create extended kernel instance
        const kernelInstance: SearchKernelInstance<T> = {
          type: "search",
          instance: config.instance,
          namespaceKey,
          atoms,

          // Stream method (delegates to base kernel)
          stream: (query) => baseKernel.search(query),

          // Dispose method
          dispose: Effect.fn("SearchKernel.dispose")(
            () =>
              Effect.gen(function* () {
                yield* Console.log(`[SearchKernel:${namespaceKey}] Disposing`)
                yield* resetNamespaceAtoms(namespaceKey)
              })
          ),

          // Index with atom updates (traced)
          index: Effect.fn("SearchKernel.index")(
            (items: readonly T[], indexConfig: IndexConfig<T>) =>
              Effect.gen(function* () {
                yield* Console.log(
                  `[SearchKernel:${namespaceKey}] Indexing ${items.length} items`
                )

                // Set processing state
                Atom.set(isProcessingFamily(namespaceKey), true)
                Atom.set(lastErrorFamily(namespaceKey), null)

                const startTime = Date.now()

                try {
                  yield* baseKernel.index(items, indexConfig)

                  const ms = Date.now() - startTime
                  yield* Console.log(
                    `[SearchKernel:${namespaceKey}] Indexed ${items.length} items in ${ms}ms`
                  )
                } catch (error) {
                  yield* setNamespaceError(namespaceKey, error as Error)
                  return yield* Effect.fail(error)
                } finally {
                  Atom.set(isProcessingFamily(namespaceKey), false)
                }
              }).pipe(Effect.withSpan(`SearchKernel.index.${namespaceKey}`))
          ),

          // Search with atom updates (traced)
          search: Effect.fn("SearchKernel.search")(
            (query: SearchQuery) =>
              Effect.gen(function* () {
                const startTime = Date.now()

                yield* Console.log(
                  `[SearchKernel:${namespaceKey}] Search: "${query.query}"`
                )

                // Reset atoms
                Atom.set(resultsFamily(namespaceKey), [])
                Atom.set(statusFamily(namespaceKey), "streaming")
                Atom.set(statsFamily(namespaceKey), { chunks: 0, items: 0, ms: 0 })
                Atom.set(queryFamily(namespaceKey), query.query)
                Atom.set(lastErrorFamily(namespaceKey), null)

                try {
                  // Get driver and execute search
                  const driver = yield* baseKernel.getDriverInstance()

                  if (!driver) {
                    const error = new Error(
                      "No search driver available. Index data first."
                    )
                    yield* setNamespaceError(namespaceKey, error)
                    return yield* Effect.fail(error)
                  }

                  // Collect results with progressive updates
                  const allResults: SearchResult<T>[] = []
                  let chunkCount = 0

                  yield* pipe(
                    driver.search(query),
                    Stream.tap((result) =>
                      Effect.sync(() => {
                        allResults.push(result as SearchResult<T>)

                        // Progressive update every 50 results (untraced for hot path)
                        if (allResults.length % 50 === 0) {
                          chunkCount++
                          Atom.set(resultsFamily(namespaceKey), [...allResults])
                          Atom.set(statsFamily(namespaceKey), {
                            chunks: chunkCount,
                            items: allResults.length,
                            ms: Date.now() - startTime,
                          })
                        }
                      })
                    ),
                    Stream.runDrain
                  )

                  // Final update
                  const finalMs = Date.now() - startTime
                  const finalStats: StreamStats = {
                    chunks: chunkCount + 1,
                    items: allResults.length,
                    ms: finalMs,
                    throughput: finalMs > 0 ? (allResults.length / finalMs) * 1000 : 0,
                  }

                  Atom.set(resultsFamily(namespaceKey), allResults)
                  Atom.set(statusFamily(namespaceKey), "complete")
                  Atom.set(statsFamily(namespaceKey), finalStats)

                  yield* Console.log(
                    `[SearchKernel:${namespaceKey}] Search complete: ${allResults.length} results in ${finalMs}ms`
                  )

                  return allResults as readonly SearchResult<T>[]
                } catch (error) {
                  yield* setNamespaceError(namespaceKey, error as Error)
                  return yield* Effect.fail(error)
                }
              }).pipe(Effect.withSpan(`SearchKernel.search.${namespaceKey}`))
          ),

          // Set driver (traced)
          setDriver: Effect.fn("SearchKernel.setDriver")(
            (driver: "flex" | "linear") =>
              Effect.gen(function* () {
                yield* Console.log(
                  `[SearchKernel:${namespaceKey}] Setting driver: ${driver}`
                )
                currentDriver = driver
                yield* baseKernel.setActiveDriver(driver)
              })
          ),

          // Get driver (untraced - simple getter)
          getDriver: Effect.fnUntraced(() => Effect.succeed(currentDriver)),
        }

        // Register in registry
        yield* Ref.update(registryRef, (reg) =>
          HashMap.set(reg, namespaceKey, {
            kernel: kernelInstance as KernelShape<unknown, unknown>,
            createdAt: Date.now(),
            config,
          })
        )

        yield* Console.log(`[v2/KernelRegistry] Registered: ${namespaceKey}`)

        return kernelInstance
      }).pipe(Effect.withSpan("KernelRegistry.getSearchKernel"))

    // ─────────────────────────────────────────────────────────────────────────
    // Lookup Methods
    // ─────────────────────────────────────────────────────────────────────────

    const lookup = Effect.fn("KernelRegistry.lookup")(
      (key: NamespaceKey): Effect.Effect<Option.Option<KernelShape<unknown, unknown>>> =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          const entry = HashMap.get(registry, key)
          return Option.map(entry, (e) => e.kernel)
        })
    )

    const has = Effect.fn("KernelRegistry.has")(
      (key: NamespaceKey): Effect.Effect<boolean> =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          return HashMap.has(registry, key)
        })
    )

    const listNamespaces = Effect.fn("KernelRegistry.listNamespaces")(
      (): Effect.Effect<readonly NamespaceKey[]> =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          return Array.from(HashMap.keys(registry))
        })
    )

    const listByType = Effect.fn("KernelRegistry.listByType")(
      (type: KernelType): Effect.Effect<readonly NamespaceKey[]> =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          return Array.from(HashMap.keys(registry)).filter((key) =>
            key.startsWith(`${type}:`)
          )
        })
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle Methods
    // ─────────────────────────────────────────────────────────────────────────

    const release = Effect.fn("KernelRegistry.release")(
      (key: NamespaceKey): Effect.Effect<void> =>
        Effect.gen(function* () {
          yield* Console.log(`[v2/KernelRegistry] Releasing: ${key}`)

          const registry = yield* Ref.get(registryRef)
          const entry = HashMap.get(registry, key)

          if (Option.isSome(entry)) {
            // Dispose kernel
            yield* entry.value.kernel.dispose()

            // Reset atoms if autoDispose
            if (entry.value.config.autoDispose) {
              yield* resetNamespaceAtoms(key)
            }
          }

          yield* Ref.update(registryRef, (reg) => HashMap.remove(reg, key))

          yield* Console.log(`[v2/KernelRegistry] Released: ${key}`)
        })
    )

    const clear = Effect.fn("KernelRegistry.clear")(
      (): Effect.Effect<void> =>
        Effect.gen(function* () {
          yield* Console.log("[v2/KernelRegistry] Clearing all kernels")

          const keys = yield* listNamespaces()

          for (const key of keys) {
            yield* release(key)
          }

          yield* Console.log("[v2/KernelRegistry] Cleared all kernels")
        })
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Stats
    // ─────────────────────────────────────────────────────────────────────────

    const getStats = Effect.fn("KernelRegistry.getStats")(
      (): Effect.Effect<RegistryStats> =>
        Effect.gen(function* () {
          const registry = yield* Ref.get(registryRef)
          const entries = Array.from(HashMap.values(registry))

          const byType: Record<KernelType, number> = {
            search: 0,
            network: 0,
            filesystem: 0,
            serial: 0,
            hardware: 0,
            custom: 0,
          }

          let oldest: number | null = null
          let newest: number | null = null

          for (const entry of entries) {
            const type = entry.kernel.type
            byType[type] = (byType[type] || 0) + 1

            if (oldest === null || entry.createdAt < oldest) {
              oldest = entry.createdAt
            }
            if (newest === null || entry.createdAt > newest) {
              newest = entry.createdAt
            }
          }

          return {
            totalKernels: entries.length,
            byType,
            oldestKernel: oldest,
            newestKernel: newest,
          }
        })
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Return Service Shape
    // ─────────────────────────────────────────────────────────────────────────

    return {
      getSearchKernel,
      lookup,
      has,
      listNamespaces,
      listByType,
      release,
      clear,
      getStats,
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Effect.Service Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KernelRegistry as Effect.Service
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function*() {
 *   const registry = yield* KernelRegistry
 *   const searchKernel = yield* registry.getSearchKernel({ instance: "movies" })
 *   yield* searchKernel.index(movies, { fields: ["title", "cast"] })
 *   const results = yield* searchKernel.search({ query: "matrix" })
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(KernelRegistry.Default)))
 * ```
 */
export class KernelRegistry extends Effect.Service<KernelRegistry>()(
  "tmnl/data-manager/v2/KernelRegistry",
  {
    effect: createKernelRegistry(),
  }
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KernelRegistry Layer
 *
 * Compose with other layers for runtime:
 * ```ts
 * const AppLayer = Layer.mergeAll(
 *   KernelRegistry.Default,
 *   OtherService.Default
 * )
 * ```
 */
export const KernelRegistryLayer = KernelRegistry.Default
