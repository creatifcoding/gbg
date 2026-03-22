/**
 * TMNL DataManager v1 - Core Types
 *
 * Service-scoped data orchestration with hybrid dispatch (fibers + workers).
 *
 * @experimental v1 API may change. v2 when stable.
 */

import type { Effect, Stream } from "effect"
import type * as Atom from "@effect-atom/atom/Atom"
import type * as Result from "@effect-atom/atom/Result"

// ─────────────────────────────────────────────────────────────────────────────
// Kernel Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kernel type discriminator
 *
 * Each kernel handles a specific category of data operations.
 */
export type KernelType = "search" | "index" | "transform" | "persist"

/**
 * Task wrapper for kernel dispatch
 *
 * @template T - Result type
 * @template P - Payload type
 */
export interface Task<T, P = unknown> {
  readonly id: string
  readonly type: KernelType
  readonly payload: P
  readonly priority?: "high" | "normal" | "low"
  readonly timeout?: number
}

/**
 * Kernel execution result
 */
export interface KernelResult<T> {
  readonly taskId: string
  readonly value: T
  readonly durationMs: number
  readonly executionMode: "fiber" | "fiber-untraced" | "worker"
}

/**
 * Kernel interface - worker unit with hybrid dispatch
 *
 * @template T - Result type
 * @template P - Payload type
 */
export interface Kernel<T = unknown, P = unknown> {
  readonly type: KernelType

  /**
   * Execute with tracing (adds Effect span)
   * Use for: service methods, lifecycle ops, error paths
   */
  readonly execute: (task: Task<T, P>) => Effect.Effect<KernelResult<T>>

  /**
   * Execute without tracing (hot path)
   * Use for: search execution, stream processing
   */
  readonly executeHot: (task: Task<T, P>) => Effect.Effect<KernelResult<T>>

  /**
   * Execute in Web Worker (CPU-heavy operations)
   * Use for: indexing 36K movies, batch transforms
   */
  readonly executeInWorker: (task: Task<T, P>) => Effect.Effect<KernelResult<T>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Status Types
// ─────────────────────────────────────────────────────────────────────────────

export type StreamStatus = "idle" | "streaming" | "complete" | "cancelled" | "error"

export interface StreamStats {
  readonly chunks: number
  readonly items: number
  readonly ms: number
  readonly throughput?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResult<T> {
  readonly item: T
  readonly score: number
  readonly matches?: readonly FieldMatch[]
}

export interface FieldMatch {
  readonly field: string
  readonly indices: readonly [number, number][]
}

export interface SearchQuery {
  readonly query: string
  readonly limit?: number
  readonly chunkSize?: number
  readonly minScore?: number
  readonly fields?: readonly string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver State
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverState<T = unknown> {
  readonly flex: DriverInstance<T> | null
  readonly linear: DriverInstance<T> | null
  readonly active: "flex" | "linear"
}

export interface DriverInstance<T> {
  readonly type: "flex" | "linear"
  readonly itemCount: number
  readonly indexedAt: number
  readonly search: (query: SearchQuery) => Stream.Stream<SearchResult<T>>
}

// ─────────────────────────────────────────────────────────────────────────────
// DataManager Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface DataManagerStats {
  readonly kernelsActive: number
  readonly tasksQueued: number
  readonly tasksCompleted: number
  readonly avgDurationMs: number
  readonly workerPoolSize: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Service-Scoped Atoms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atoms owned by DataManager service
 *
 * Lifecycle tied to service (created on init, disposed on teardown).
 * Access via `DataManager.atoms.results`, etc.
 */
export interface DataManagerAtoms<T = unknown> {
  /** Search results (progressive, from stream) */
  readonly results: Atom.Atom<readonly SearchResult<T>[]>

  /** Current stream status */
  readonly status: Atom.Atom<StreamStatus>

  /** Stream statistics */
  readonly stats: Atom.Atom<StreamStats>

  /** Driver instances */
  readonly drivers: Atom.Atom<DriverState<T>>

  /** Indexing in progress */
  readonly isIndexing: Atom.Atom<boolean>

  /** Current query */
  readonly query: Atom.Atom<string>

  /** Suspense-enabled search result */
  readonly searchResult: Atom.Atom<Result.Result<readonly SearchResult<T>[], Error>>
}

// ─────────────────────────────────────────────────────────────────────────────
// DataManager Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DataManager - top-level orchestrator with service-scoped atoms
 *
 * @template T - Item type being managed
 */
export interface DataManagerOps<T = unknown> {
  /**
   * Dispatch task to kernel (fiber, traced)
   */
  readonly dispatch: <R>(
    kernelType: KernelType,
    task: Task<R>
  ) => Effect.Effect<KernelResult<R>>

  /**
   * Dispatch task to kernel (fiber, untraced - hot path)
   */
  readonly dispatchHot: <R>(
    kernelType: KernelType,
    task: Task<R>
  ) => Effect.Effect<KernelResult<R>>

  /**
   * Dispatch task to Web Worker (CPU-heavy)
   */
  readonly dispatchInWorker: <R>(
    kernelType: KernelType,
    task: Task<R>
  ) => Effect.Effect<KernelResult<R>>

  /**
   * Search with progressive streaming
   */
  readonly search: (query: SearchQuery) => Stream.Stream<SearchResult<T>>

  /**
   * Index items
   */
  readonly index: (
    items: readonly T[],
    fields: readonly string[]
  ) => Effect.Effect<void>

  /**
   * Get service stats
   */
  readonly getStats: () => Effect.Effect<DataManagerStats>

  /**
   * Service-scoped atoms
   */
  readonly atoms: DataManagerAtoms<T>
}
