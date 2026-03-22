/**
 * TMNL DataManager v1 - Kernel Types
 *
 * Kernel-specific payload and result types.
 */

import type { Indexable, IndexConfig, SearchOptions } from "@/lib/search/types"
import type { SearchResult, SearchQuery } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Search Kernel
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchPayload {
  readonly query: string
  readonly options?: SearchOptions
}

export interface SearchResultPayload<T> {
  readonly results: readonly SearchResult<T>[]
  readonly totalMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Index Kernel
// ─────────────────────────────────────────────────────────────────────────────

export interface IndexPayload<T extends Indexable = Indexable> {
  readonly items: readonly T[]
  readonly config: IndexConfig<T>
}

export interface IndexResultPayload {
  readonly itemCount: number
  readonly fieldCount: number
  readonly indexMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Kernel
// ─────────────────────────────────────────────────────────────────────────────

export interface TransformPayload<TIn = unknown, TOut = unknown> {
  readonly items: readonly TIn[]
  readonly transformer: (item: TIn) => TOut
}

export interface TransformResultPayload<TOut = unknown> {
  readonly results: readonly TOut[]
  readonly transformMs: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist Kernel (future)
// ─────────────────────────────────────────────────────────────────────────────

export interface PersistPayload<T = unknown> {
  readonly key: string
  readonly data: T
  readonly store: "indexeddb" | "localstorage" | "memory"
}

export interface PersistResultPayload {
  readonly key: string
  readonly size: number
  readonly persistMs: number
}
