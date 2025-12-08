/**
 * TMNL DataManager v1 - KernelRegistry Service
 *
 * Effect.Service for kernel factory + lookup with namespaced atoms.
 * Implements the Registry pattern for kernel instance management.
 *
 * Pattern:
 * - Factory: Create kernel instances with namespace scoping
 * - Registry: Lookup existing instances by namespace key
 * - Lifecycle: Track active kernels for disposal
 *
 * @experimental v1 API - additive extension to existing v1
 */

import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as HashMap from "effect/HashMap"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"
import { Atom } from "@effect-atom/atom"

import type {
  NamespaceKey,
  KernelType,
  KernelShape,
  KernelConfig,
  SearchKernelConfig,
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
} from "./atoms"
import { createSearchKernel } from "../kernels/SearchKernel"
import type { SearchQuery, SearchResult } from "../types"
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
  readonly lookup: (key: NamespaceKey) => Effect.Effect<Option.Option<KernelShape<unknown, unknown>>>

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
  readonly listByType: (type: KernelType) => Effect.Effect<readonly NamespaceKey[]>

  /**
   * Release a kernel (removes from registry, optionally disposes atoms)
   */
  readonly release: (key: NamespaceKey) => Effect.Effect<void>

  /**
   * Clear all kernels
   */
  readonly clear: () => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Kernel Instance (Extended KernelShape)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SearchKernelInstance - KernelShape with search-specific extensions
 */
export interface SearchKernelInstance<T extends Indexable> extends KernelShape<T, SearchQuery> {
  readonly type: "search"

  /**
   * Index items into this kernel's driver
   */
  readonly index: (items: readonly T[], config: IndexConfig<T>) => Effect.Effect<void>

  /**
   * Execute search and update namespaced atoms
   */
  readonly search: (query: SearchQuery) => Effect.Effect<readonly SearchResult<T>[]>

  /**
   * Set active driver (flex or linear)
   */
  readonly setDriver: (driver: "flex" | "linear") => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Create KernelRegistry Implementation
// ─────────────────────────────────────────────────────────────────────────────

const createKernelRegistry = (): Effect.Effect<KernelRegistryShape> =>
  Effect.gen(function* () {
    // Internal registry state
    const registryRef = yield* Ref.make<RegistryState>(HashMap.empty())

    // ─────────────────────────────────────────────────────────────────────────
    // Search Kernel Factory
    // ─────────────────────────────────────────────────────────────────────────

    const getSearchKernel = <T extends Indexable>(
      config: SearchKernelConfig
    ): Effect.Effect<SearchKernelInstance<T>> =>
      Effect.gen(function* () {
        const namespaceKey = makeNamespaceKey("search", config.instance)

        // Check if already exists
        const registry = yield* Ref.get(registryRef)
        const existing = HashMap.get(registry, namespaceKey)

        if (Option.isSome(existing)) {
          // Return existing instance
          return existing.value.kernel as SearchKernelInstance<T>
        }

        // Create new kernel
        const baseKernel = yield* createSearchKernel<T>()

        // Get namespaced atoms
        const atoms = getNamespaceAtoms<T>(namespaceKey)

        // Create extended kernel instance
        const kernelInstance: SearchKernelInstance<T> = {
          type: "search",
          instance: config.instance,
          namespaceKey,
          atoms,

          // Stream method (delegates to base kernel)
          stream: (query) => baseKernel.search(query),

          // Index with atom updates
          index: (items, indexConfig) =>
            Effect.gen(function* () {
              // Set processing state
              Atom.set(isProcessingFamily(namespaceKey), true)
              Atom.set(lastErrorFamily(namespaceKey), null)

              try {
                yield* baseKernel.index(items, indexConfig)
              } catch (error) {
                Atom.set(lastErrorFamily(namespaceKey), error as Error)
                throw error
              } finally {
                Atom.set(isProcessingFamily(namespaceKey), false)
              }
            }).pipe(Effect.withSpan(`SearchKernel.index.${namespaceKey}`)),

          // Search with atom updates
          search: (query) =>
            Effect.gen(function* () {
              const startTime = Date.now()

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
                  const error = new Error("No search driver available. Index data first.")
                  Atom.set(statusFamily(namespaceKey), "error")
                  Atom.set(lastErrorFamily(namespaceKey), error)
                  return yield* Effect.fail(error)
                }

                // Collect results with progressive updates
                const allResults: SearchResult<T>[] = []

                yield* Effect.forEach(
                  Effect.succeed(driver.search(query)),
                  () => Effect.succeed(undefined), // placeholder - we'll use Stream
                  { discard: true }
                )

                // Use Stream.runForEach for actual streaming
                const { Stream } = yield* Effect.promise(() => import("effect/Stream"))

                yield* Stream.runForEach(
                  driver.search(query),
                  (result) =>
                    Effect.sync(() => {
                      allResults.push(result as SearchResult<T>)

                      // Progressive update every 50 results
                      if (allResults.length % 50 === 0) {
                        Atom.set(resultsFamily(namespaceKey), [...allResults])
                        Atom.set(statsFamily(namespaceKey), {
                          chunks: Math.ceil(allResults.length / 50),
                          items: allResults.length,
                          ms: Date.now() - startTime,
                        })
                      }
                    })
                )

                // Final update
                const finalMs = Date.now() - startTime
                Atom.set(resultsFamily(namespaceKey), allResults)
                Atom.set(statusFamily(namespaceKey), "complete")
                Atom.set(statsFamily(namespaceKey), {
                  chunks: Math.ceil(allResults.length / 50),
                  items: allResults.length,
                  ms: finalMs,
                  throughput: finalMs > 0 ? (allResults.length / finalMs) * 1000 : 0,
                })

                return allResults as readonly SearchResult<T>[]
              } catch (error) {
                Atom.set(statusFamily(namespaceKey), "error")
                Atom.set(lastErrorFamily(namespaceKey), error as Error)
                throw error
              }
            }).pipe(Effect.withSpan(`SearchKernel.search.${namespaceKey}`)),

          // Set driver
          setDriver: (driver) => baseKernel.setActiveDriver(driver),
        }

        // Register in registry
        yield* Ref.update(registryRef, (reg) =>
          HashMap.set(reg, namespaceKey, {
            kernel: kernelInstance as KernelShape<unknown, unknown>,
            createdAt: Date.now(),
            config,
          })
        )

        return kernelInstance
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Lookup Methods
    // ─────────────────────────────────────────────────────────────────────────

    const lookup = (key: NamespaceKey): Effect.Effect<Option.Option<KernelShape<unknown, unknown>>> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        const entry = HashMap.get(registry, key)
        return Option.map(entry, (e) => e.kernel)
      })

    const has = (key: NamespaceKey): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        return HashMap.has(registry, key)
      })

    const listNamespaces = (): Effect.Effect<readonly NamespaceKey[]> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        return Array.from(HashMap.keys(registry))
      })

    const listByType = (type: KernelType): Effect.Effect<readonly NamespaceKey[]> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        return Array.from(HashMap.keys(registry)).filter((key) =>
          key.startsWith(`${type}:`)
        )
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle Methods
    // ─────────────────────────────────────────────────────────────────────────

    const release = (key: NamespaceKey): Effect.Effect<void> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef)
        const entry = HashMap.get(registry, key)

        if (Option.isSome(entry) && entry.value.config.autoDispose) {
          // Reset atoms to initial state
          Atom.set(resultsFamily(key), [])
          Atom.set(statusFamily(key), "idle")
          Atom.set(statsFamily(key), { chunks: 0, items: 0, ms: 0 })
          Atom.set(queryFamily(key), "")
          Atom.set(isProcessingFamily(key), false)
          Atom.set(lastErrorFamily(key), null)
        }

        yield* Ref.update(registryRef, (reg) => HashMap.remove(reg, key))
      })

    const clear = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const keys = yield* listNamespaces()

        for (const key of keys) {
          yield* release(key)
        }
      })

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
  "tmnl/data-manager/KernelRegistry",
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
