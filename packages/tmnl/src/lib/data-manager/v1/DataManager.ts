/**
 * TMNL DataManager v1 - Core Service
 *
 * Top-level orchestrator with hybrid dispatch (fibers + workers),
 * service-scoped atoms, and kernel pooling.
 *
 * @experimental v1 API may change. v2 when stable.
 */

import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as Stream from "effect/Stream"
import * as Array from "effect/Array"
import * as Option from "effect/Option"
import { Atom } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import * as Layer from "effect/Layer"

import type {
  KernelType,
  Task,
  KernelResult,
  Kernel,
  StreamStatus,
  StreamStats,
  SearchResult,
  SearchQuery,
  DriverState,
  DataManagerStats,
  DataManagerAtoms,
  DataManagerOps,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Internal State Types
// ─────────────────────────────────────────────────────────────────────────────

interface DataManagerState<T = unknown> {
  readonly kernels: Map<KernelType, Kernel<unknown, unknown>>
  readonly tasksQueued: number
  readonly tasksCompleted: number
  readonly totalDurationMs: number
  readonly drivers: DriverState<T>
  readonly isIndexing: boolean
  readonly currentQuery: string
}

const initialState = <T>(): DataManagerState<T> => ({
  kernels: new Map(),
  tasksQueued: 0,
  tasksCompleted: 0,
  totalDurationMs: 0,
  drivers: {
    flex: null,
    linear: null,
    active: "flex",
  },
  isIndexing: false,
  currentQuery: "",
})

// ─────────────────────────────────────────────────────────────────────────────
// DataManager Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DataManager Service - Top-level data orchestrator
 *
 * Pattern: Effect.Service<>() with Effect.Ref for state
 *
 * @template T - Item type being managed
 */
export class DataManager<T = unknown> extends Effect.Service<DataManager<T>>()("tmnl/data-manager/DataManager", {
  effect: Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // Canonical State (Effect.Ref)
    // ─────────────────────────────────────────────────────────────────────────

    const stateRef = yield* Ref.make<DataManagerState<T>>(initialState<T>())

    // Search results (streaming, progressive)
    const resultsRef = yield* Ref.make<readonly SearchResult<T>[]>([])

    // Stream status
    const statusRef = yield* Ref.make<StreamStatus>("idle")

    // Stream stats
    const statsRef = yield* Ref.make<StreamStats>({ chunks: 0, items: 0, ms: 0 })

    // ─────────────────────────────────────────────────────────────────────────
    // Kernel Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Register a kernel
     */
    const registerKernel = (kernel: Kernel<unknown, unknown>): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => ({
        ...state,
        kernels: new Map(state.kernels).set(kernel.type, kernel),
      }))

    /**
     * Get kernel by type
     */
    const getKernel = (type: KernelType): Effect.Effect<Kernel<unknown, unknown> | undefined> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        return state.kernels.get(type)
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Dispatch Operations (Effect.fn pattern for tracing)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Dispatch task to kernel (traced, fiber)
     *
     * Use for: service methods, lifecycle ops, error paths
     */
    const dispatch = <R>(
      kernelType: KernelType,
      task: Task<R>
    ): Effect.Effect<KernelResult<R>> =>
      Effect.gen(function* () {
        const kernel = yield* getKernel(kernelType)

        if (!kernel) {
          return yield* Effect.fail(new Error(`Kernel not found: ${kernelType}`))
        }

        // Update queued count
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tasksQueued: s.tasksQueued + 1,
        }))

        // Execute with tracing
        const result = yield* kernel.execute(task as Task<unknown, unknown>) as Effect.Effect<KernelResult<R>>

        // Update completed stats
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tasksQueued: s.tasksQueued - 1,
          tasksCompleted: s.tasksCompleted + 1,
          totalDurationMs: s.totalDurationMs + result.durationMs,
        }))

        return result
      }).pipe(Effect.withSpan(`DataManager.dispatch.${kernelType}`))

    /**
     * Dispatch task (untraced, hot path)
     *
     * Use for: search execution, stream processing
     */
    const dispatchHot = <R>(
      kernelType: KernelType,
      task: Task<R>
    ): Effect.Effect<KernelResult<R>> =>
      Effect.gen(function* () {
        const kernel = yield* getKernel(kernelType)

        if (!kernel) {
          return yield* Effect.fail(new Error(`Kernel not found: ${kernelType}`))
        }

        // Execute without tracing (hot path)
        const result = yield* kernel.executeHot(task as Task<unknown, unknown>) as Effect.Effect<KernelResult<R>>

        // Update stats atomically (no tracing overhead)
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tasksCompleted: s.tasksCompleted + 1,
          totalDurationMs: s.totalDurationMs + result.durationMs,
        }))

        return result
      })

    /**
     * Dispatch to Web Worker (CPU-heavy operations)
     *
     * Use for: indexing 36K movies, batch transforms
     */
    const dispatchInWorker = <R>(
      kernelType: KernelType,
      task: Task<R>
    ): Effect.Effect<KernelResult<R>> =>
      Effect.gen(function* () {
        const kernel = yield* getKernel(kernelType)

        if (!kernel) {
          return yield* Effect.fail(new Error(`Kernel not found: ${kernelType}`))
        }

        // Update queued count
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tasksQueued: s.tasksQueued + 1,
        }))

        // Execute in worker
        const result = yield* kernel.executeInWorker(task as Task<unknown, unknown>) as Effect.Effect<KernelResult<R>>

        // Update completed stats
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          tasksQueued: s.tasksQueued - 1,
          tasksCompleted: s.tasksCompleted + 1,
          totalDurationMs: s.totalDurationMs + result.durationMs,
        }))

        return result
      }).pipe(Effect.withSpan(`DataManager.dispatchInWorker.${kernelType}`))

    // ─────────────────────────────────────────────────────────────────────────
    // Search Operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Search with progressive streaming
     *
     * Updates atoms as stream progresses for reactive UI
     */
    const search = (query: SearchQuery): Stream.Stream<SearchResult<T>> =>
      Stream.unwrap(
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const driver = state.drivers.active === "flex"
            ? state.drivers.flex
            : state.drivers.linear

          if (!driver) {
            return Stream.fail(new Error("No search driver available"))
          }

          // Reset state for new search
          yield* Ref.set(resultsRef, [])
          yield* Ref.set(statusRef, "streaming")
          yield* Ref.set(statsRef, { chunks: 0, items: 0, ms: 0 })
          yield* Ref.update(stateRef, (s) => ({ ...s, currentQuery: query.query }))

          const startTime = Date.now()

          // Create progressive stream with atom updates
          return driver.search(query).pipe(
            Stream.tap((result) =>
              Effect.gen(function* () {
                yield* Ref.update(resultsRef, (results) => [...results, result as SearchResult<T>])
                yield* Ref.update(statsRef, (stats) => ({
                  ...stats,
                  items: stats.items + 1,
                  ms: Date.now() - startTime,
                }))
              })
            ),
            Stream.onDone(() =>
              Effect.gen(function* () {
                yield* Ref.set(statusRef, "complete")
                yield* Ref.update(statsRef, (stats) => ({
                  ...stats,
                  ms: Date.now() - startTime,
                  throughput: stats.items / ((Date.now() - startTime) / 1000),
                }))
              })
            )
          ) as Stream.Stream<SearchResult<T>>
        })
      )

    /**
     * Index items
     */
    const index = (
      items: readonly T[],
      fields: readonly string[]
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.update(stateRef, (s) => ({ ...s, isIndexing: true }))

        // Dispatch to index kernel (via worker for CPU-heavy ops)
        yield* dispatchInWorker("index", {
          id: `index-${Date.now()}`,
          type: "index",
          payload: { items, fields },
          priority: "normal",
        })

        yield* Ref.update(stateRef, (s) => ({ ...s, isIndexing: false }))
      }).pipe(Effect.withSpan("DataManager.index"))

    // ─────────────────────────────────────────────────────────────────────────
    // Stats & Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get service stats
     */
    const getStats = (): Effect.Effect<DataManagerStats> =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        return {
          kernelsActive: state.kernels.size,
          tasksQueued: state.tasksQueued,
          tasksCompleted: state.tasksCompleted,
          avgDurationMs: state.tasksCompleted > 0
            ? state.totalDurationMs / state.tasksCompleted
            : 0,
          workerPoolSize: 0, // TODO: Wire to actual worker pool
        }
      })

    // ─────────────────────────────────────────────────────────────────────────
    // Service-Scoped Atoms
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Create atoms tied to this service instance
     *
     * Lifecycle: created here, disposed when service is disposed
     */
    const atoms: DataManagerAtoms<T> = {
      results: Atom.make<readonly SearchResult<T>[]>([]),
      status: Atom.make<StreamStatus>("idle"),
      stats: Atom.make<StreamStats>({ chunks: 0, items: 0, ms: 0 }),
      drivers: Atom.make<DriverState<T>>({
        flex: null,
        linear: null,
        active: "flex",
      }),
      isIndexing: Atom.make<boolean>(false),
      query: Atom.make<string>(""),
      searchResult: Atom.make<Result.Result<readonly SearchResult<T>[], Error>>(
        Result.initial()
      ),
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Return Service Interface
    // ─────────────────────────────────────────────────────────────────────────

    return {
      // Kernel management (internal)
      registerKernel,
      getKernel,

      // Dispatch operations
      dispatch,
      dispatchHot,
      dispatchInWorker,

      // Search operations
      search,
      index,

      // Stats
      getStats,

      // Service-scoped atoms
      atoms,
    } as const satisfies DataManagerOps<T> & {
      registerKernel: typeof registerKernel
      getKernel: typeof getKernel
    }
  }),
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default DataManager layer
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function*() {
 *   const dm = yield* DataManager
 *   const results = yield* dm.dispatch("search", task)
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(DataManager.Default)))
 * ```
 */
export const DataManagerLive = DataManager.Default
