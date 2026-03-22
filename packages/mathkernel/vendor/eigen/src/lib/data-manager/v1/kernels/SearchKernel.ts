/**
 * TMNL DataManager v1 - SearchKernel
 *
 * Kernel wrapper for FlexSearch driver with hybrid dispatch support.
 * Implements the Kernel interface for DataManager integration.
 *
 * @experimental v1 API may change. v2 when stable.
 */

import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as Stream from "effect/Stream"
import type {
  Kernel,
  Task,
  KernelResult,
  SearchResult,
  SearchQuery,
  DriverInstance,
} from "../types"
import type { SearchPayload, SearchResultPayload } from "./types"
import { createFlexSearchDriver } from "@/lib/search/drivers/flexsearch"
import { createLinearDriver } from "@/lib/search/drivers/linear"
import type { Indexable, IndexConfig, SearchServiceImpl } from "@/lib/search/types"

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
// SearchKernel Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a SearchKernel instance
 *
 * Wraps FlexSearch and Linear drivers with Kernel interface.
 * Provides execute (traced), executeHot (untraced), and executeInWorker modes.
 */
export const createSearchKernel = <T extends Indexable>(): Effect.Effect<
  Kernel<SearchResultPayload<T>, SearchPayload> & {
    readonly index: (items: readonly T[], config: IndexConfig<T>) => Effect.Effect<void>
    readonly setActiveDriver: (driver: "flex" | "linear") => Effect.Effect<void>
    readonly getDriverInstance: () => Effect.Effect<DriverInstance<T> | null>
    readonly search: (query: SearchQuery) => Stream.Stream<SearchResult<T>>
  }
> =>
  Effect.gen(function* () {
    // Internal state
    const stateRef = yield* Ref.make<SearchKernelState<T>>(initialState<T>())

    // ─────────────────────────────────────────────────────────────────────────
    // Driver Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Initialize drivers
     */
    const initDrivers = (): Effect.Effect<void> =>
      Effect.gen(function* () {
        const flex = yield* createFlexSearchDriver<T>()
        const linear = yield* createLinearDriver<T>()

        yield* Ref.update(stateRef, (s) => ({
          ...s,
          flexDriver: flex,
          linearDriver: linear,
        }))
      })

    // Initialize on creation
    yield* initDrivers()

    /**
     * Get active driver
     */
    const getActiveDriver = (): Effect.Effect<SearchServiceImpl<T>> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const driver = state.activeDriver === "flex"
          ? state.flexDriver
          : state.linearDriver

        if (!driver) {
          return yield* Effect.fail(new Error("Search driver not initialized"))
        }

        return driver
      })

    /**
     * Set active driver
     */
    const setActiveDriver = (driver: "flex" | "linear"): Effect.Effect<void> =>
      Ref.update(stateRef, (s) => ({ ...s, activeDriver: driver }))

    /**
     * Get driver instance (for DataManager atoms)
     */
    const getDriverInstance = (): Effect.Effect<DriverInstance<T> | null> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const driver = state.activeDriver === "flex"
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
              chunkSize: query.chunkSize,
            }) as Stream.Stream<SearchResult<T>>,
        }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Indexing
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Index items in both drivers
     */
    const index = (items: readonly T[], config: IndexConfig<T>): Effect.Effect<void> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (state.flexDriver) {
          yield* state.flexDriver.index(items, config)
        }

        if (state.linearDriver) {
          yield* state.linearDriver.index(items, config)
        }

        yield* Ref.update(stateRef, (s) => ({ ...s, indexed: true }))
      }).pipe(Effect.withSpan("SearchKernel.index"))

    // ─────────────────────────────────────────────────────────────────────────
    // Search Stream
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Search with streaming results
     */
    const search = (query: SearchQuery): Stream.Stream<SearchResult<T>> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const driver = yield* getActiveDriver()
          return driver.search(query.query, {
            limit: query.limit,
            chunkSize: query.chunkSize,
          }) as Stream.Stream<SearchResult<T>>
        })
      )

    // ─────────────────────────────────────────────────────────────────────────
    // Kernel Interface Implementation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Execute search task (traced)
     */
    const execute = (
      task: Task<SearchResultPayload<T>, SearchPayload>
    ): Effect.Effect<KernelResult<SearchResultPayload<T>>> =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const driver = yield* getActiveDriver()

        // Collect stream results
        const results = yield* Stream.runCollect(
          driver.search(task.payload.query, task.payload.options)
        )

        const durationMs = Date.now() - startTime

        return {
          taskId: task.id,
          value: {
            results: Array.from(results) as readonly SearchResult<T>[],
            totalMs: durationMs,
          },
          durationMs,
          executionMode: "fiber" as const,
        }
      }).pipe(Effect.withSpan(`SearchKernel.execute.${task.id}`))

    /**
     * Execute search task (untraced, hot path)
     */
    const executeHot = (
      task: Task<SearchResultPayload<T>, SearchPayload>
    ): Effect.Effect<KernelResult<SearchResultPayload<T>>> =>
      Effect.gen(function* () {
        const startTime = Date.now()
        const driver = yield* getActiveDriver()

        // Collect stream results (no tracing overhead)
        const results = yield* Stream.runCollect(
          driver.search(task.payload.query, task.payload.options)
        )

        const durationMs = Date.now() - startTime

        return {
          taskId: task.id,
          value: {
            results: Array.from(results) as readonly SearchResult<T>[],
            totalMs: durationMs,
          },
          durationMs,
          executionMode: "fiber-untraced" as const,
        }
      })

    /**
     * Execute in Web Worker
     *
     * Note: For search, workers add overhead due to serialization.
     * Only use for very large result sets or complex scoring.
     */
    const executeInWorker = (
      task: Task<SearchResultPayload<T>, SearchPayload>
    ): Effect.Effect<KernelResult<SearchResultPayload<T>>> =>
      Effect.gen(function* () {
        // TODO: Implement actual Worker dispatch
        // For now, fall back to fiber execution with worker flag
        yield* Effect.logWarning(
          "SearchKernel.executeInWorker: Worker dispatch not yet implemented, using fiber"
        )

        const startTime = Date.now()
        const driver = yield* getActiveDriver()

        const results = yield* Stream.runCollect(
          driver.search(task.payload.query, task.payload.options)
        )

        const durationMs = Date.now() - startTime

        return {
          taskId: task.id,
          value: {
            results: Array.from(results) as readonly SearchResult<T>[],
            totalMs: durationMs,
          },
          durationMs,
          executionMode: "worker" as const, // Mark as worker even though we're in fiber (for future)
        }
      }).pipe(Effect.withSpan(`SearchKernel.executeInWorker.${task.id}`))

    // ─────────────────────────────────────────────────────────────────────────
    // Return Kernel + Extensions
    // ─────────────────────────────────────────────────────────────────────────

    return {
      type: "search" as const,
      execute,
      executeHot,
      executeInWorker,
      // Extensions (not part of base Kernel interface)
      index,
      setActiveDriver,
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
export class SearchKernel extends Effect.Service<SearchKernel>()("tmnl/data-manager/SearchKernel", {
  effect: createSearchKernel(),
}) {}
