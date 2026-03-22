/**
 * TMNL DataManager v2 - SearchKernel
 *
 * Kernel wrapper for FlexSearch driver with hybrid dispatch support.
 * Implements the Kernel interface for DataManager integration.
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
import * as Stream from "effect/Stream"
import * as Console from "effect/Console"
import type {
  SearchResult,
  SearchQuery,
} from "../types"
import { createFlexSearchDriver } from "@/lib/search/drivers/flexsearch"
import { createLinearDriver } from "@/lib/search/drivers/linear"
import type { Indexable, IndexConfig, SearchServiceImpl } from "@/lib/search/types"

// ─────────────────────────────────────────────────────────────────────────────
// Driver Instance Type
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverInstance<T> {
  readonly type: "flex" | "linear"
  readonly itemCount: number
  readonly indexedAt: number
  readonly search: (query: SearchQuery) => Stream.Stream<SearchResult<T>>
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchKernel State
// ─────────────────────────────────────────────────────────────────────────────

interface SearchKernelState<T extends Indexable = Indexable> {
  readonly flexDriver: SearchServiceImpl<T> | null
  readonly linearDriver: SearchServiceImpl<T> | null
  readonly activeDriver: "flex" | "linear"
  readonly indexed: boolean
}

const initialState = <T extends Indexable>(): SearchKernelState<T> => ({
  flexDriver: null,
  linearDriver: null,
  activeDriver: "flex",
  indexed: false,
})

// ─────────────────────────────────────────────────────────────────────────────
// SearchKernel Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchKernelShape<T extends Indexable> {
  readonly type: "search"
  readonly index: (items: readonly T[], config: IndexConfig<T>) => Effect.Effect<void>
  readonly setActiveDriver: (driver: "flex" | "linear") => Effect.Effect<void>
  readonly getActiveDriver: () => Effect.Effect<"flex" | "linear">
  readonly getDriverInstance: () => Effect.Effect<DriverInstance<T> | null>
  readonly search: (query: SearchQuery) => Stream.Stream<SearchResult<T>>
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchKernel Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a SearchKernel instance
 *
 * Wraps FlexSearch and Linear drivers with Kernel interface.
 * Uses Effect.fn for traced operations and Effect.fnUntraced for hot paths.
 */
export const createSearchKernel = <T extends Indexable>(): Effect.Effect<
  SearchKernelShape<T>
> =>
  Effect.gen(function* () {
    yield* Console.log("[v2/SearchKernel] Creating kernel")

    // Internal state
    const stateRef = yield* Ref.make<SearchKernelState<T>>(initialState<T>())

    // ─────────────────────────────────────────────────────────────────────────
    // Driver Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Initialize drivers (traced)
     */
    const initDrivers = Effect.fn("SearchKernel.initDrivers")(
      () =>
        Effect.gen(function* () {
          yield* Console.log("[v2/SearchKernel] Initializing drivers")

          const flex = yield* createFlexSearchDriver<T>()
          const linear = yield* createLinearDriver<T>()

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            flexDriver: flex,
            linearDriver: linear,
          }))

          yield* Console.log("[v2/SearchKernel] Drivers initialized")
        })
    )

    // Initialize on creation
    yield* initDrivers()

    /**
     * Get active driver (untraced - hot path)
     */
    const getActiveDriverImpl = Effect.fnUntraced(
      () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const driver =
            state.activeDriver === "flex"
              ? state.flexDriver
              : state.linearDriver

          if (!driver) {
            return yield* Effect.fail(new Error("Search driver not initialized"))
          }

          return driver
        })
    )

    /**
     * Set active driver (traced)
     */
    const setActiveDriver = Effect.fn("SearchKernel.setActiveDriver")(
      (driver: "flex" | "linear") =>
        Effect.gen(function* () {
          yield* Console.log(`[v2/SearchKernel] Setting active driver: ${driver}`)
          yield* Ref.update(stateRef, (s) => ({ ...s, activeDriver: driver }))
        })
    )

    /**
     * Get active driver name (untraced - simple getter)
     */
    const getActiveDriver = Effect.fnUntraced(
      () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return state.activeDriver
        })
    )

    /**
     * Get driver instance for external use (untraced - hot path)
     */
    const getDriverInstance = Effect.fnUntraced(
      () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const driver =
            state.activeDriver === "flex"
              ? state.flexDriver
              : state.linearDriver

          if (!driver || !state.indexed) {
            return null
          }

          const stats = yield* driver.stats()

          return {
            type: state.activeDriver,
            itemCount: stats.itemCount,
            indexedAt: stats.lastUpdated ?? Date.now(),
            search: (query: SearchQuery) =>
              driver.search(query.query, {
                limit: query.limit,
              }) as Stream.Stream<SearchResult<T>>,
          }
        })
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Indexing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Index items in both drivers (traced)
     */
    const index = Effect.fn("SearchKernel.index")(
      (items: readonly T[], config: IndexConfig<T>) =>
        Effect.gen(function* () {
          yield* Console.log(`[v2/SearchKernel] Indexing ${items.length} items`)

          const state = yield* Ref.get(stateRef)

          if (state.flexDriver) {
            yield* state.flexDriver.index(items, config)
            yield* Console.log("[v2/SearchKernel] FlexSearch indexed")
          }

          if (state.linearDriver) {
            yield* state.linearDriver.index(items, config)
            yield* Console.log("[v2/SearchKernel] Linear indexed")
          }

          yield* Ref.update(stateRef, (s) => ({ ...s, indexed: true }))

          yield* Console.log(`[v2/SearchKernel] Index complete: ${items.length} items`)
        }).pipe(Effect.withSpan("SearchKernel.index"))
    )

    // ─────────────────────────────────────────────────────────────────────────
    // Search Stream
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Search with streaming results
     *
     * Returns a Stream - untraced for hot path performance.
     */
    const search = (query: SearchQuery): Stream.Stream<SearchResult<T>> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const driver = yield* getActiveDriverImpl()
          return driver.search(query.query, {
            limit: query.limit,
          }) as Stream.Stream<SearchResult<T>>
        })
      )

    // ─────────────────────────────────────────────────────────────────────────
    // Return Kernel Shape
    // ─────────────────────────────────────────────────────────────────────────

    yield* Console.log("[v2/SearchKernel] Kernel created")

    return {
      type: "search" as const,
      index,
      setActiveDriver,
      getActiveDriver,
      getDriverInstance,
      search,
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SearchKernel as Effect.Service
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function*() {
 *   const kernel = yield* SearchKernel
 *   yield* kernel.index(items, config)
 *   const stream = kernel.search({ query: "matrix" })
 * })
 * ```
 */
export class SearchKernel extends Effect.Service<SearchKernel>()(
  "tmnl/data-manager/v2/SearchKernel",
  {
    effect: createSearchKernel(),
  }
) {}
