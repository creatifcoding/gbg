/**
 * TMNL DataManager v1 - Namespace Atoms
 *
 * Atom families for kernel namespacing. Each namespace key gets its own
 * set of atoms, enabling multiple kernel instances to coexist.
 *
 * Uses Atom.family for parameterized atom creation with automatic cleanup.
 *
 * @experimental v1 API - additive extension to existing v1
 */

import { Atom } from "@effect-atom/atom"
import type {
  NamespaceKey,
  NamespaceAtoms,
  ScoredResult,
  StreamStatus,
  StreamStats,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Atom Families (Parameterized by NamespaceKey)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Results atom family
 *
 * Each namespace gets its own results array.
 * Access: resultsFamily("search:movies")
 */
export const resultsFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<readonly ScoredResult<unknown>[]> =>
    Atom.make<readonly ScoredResult<unknown>[]>([])
)

/**
 * Status atom family
 *
 * Each namespace tracks its own stream status.
 * Access: statusFamily("search:movies")
 */
export const statusFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<StreamStatus> =>
    Atom.make<StreamStatus>("idle")
)

/**
 * Stats atom family
 *
 * Each namespace has its own metrics.
 * Access: statsFamily("search:movies")
 */
export const statsFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<StreamStats> =>
    Atom.make<StreamStats>({ chunks: 0, items: 0, ms: 0 })
)

/**
 * Query atom family
 *
 * Each namespace tracks its current query/filter.
 * Access: queryFamily("search:movies")
 */
export const queryFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<string> =>
    Atom.make<string>("")
)

/**
 * IsProcessing atom family
 *
 * Each namespace tracks operation-in-progress state.
 * Access: isProcessingFamily("search:movies")
 */
export const isProcessingFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<boolean> =>
    Atom.make<boolean>(false)
)

/**
 * LastError atom family
 *
 * Each namespace tracks its last error.
 * Access: lastErrorFamily("search:movies")
 */
export const lastErrorFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<Error | null> =>
    Atom.make<Error | null>(null)
)

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atom Families
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IsStreaming derived atom family
 *
 * Computed from status === "streaming"
 */
export const isStreamingFamily = Atom.family(
  (key: NamespaceKey): Atom.Atom<boolean> =>
    Atom.make((get) => {
      const status = get(statusFamily(key))
      return status === "streaming"
    })
)

/**
 * HasResults derived atom family
 *
 * Computed from results.length > 0
 */
export const hasResultsFamily = Atom.family(
  (key: NamespaceKey): Atom.Atom<boolean> =>
    Atom.make((get) => {
      const results = get(resultsFamily(key))
      return results.length > 0
    })
)

/**
 * ResultCount derived atom family
 */
export const resultCountFamily = Atom.family(
  (key: NamespaceKey): Atom.Atom<number> =>
    Atom.make((get) => {
      const results = get(resultsFamily(key))
      return results.length
    })
)

/**
 * Throughput derived atom family
 *
 * Items per second calculation
 */
export const throughputFamily = Atom.family(
  (key: NamespaceKey): Atom.Atom<number> =>
    Atom.make((get) => {
      const stats = get(statsFamily(key))
      if (stats.ms > 0) {
        return (stats.items / stats.ms) * 1000
      }
      return 0
    })
)

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Atoms Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all atoms for a namespace key
 *
 * Creates or retrieves the atom set for a given namespace.
 * Atoms are memoized via Atom.family's internal WeakRef cache.
 *
 * @param key - Namespace key (e.g., "search:movies")
 * @returns NamespaceAtoms bundle
 */
export function getNamespaceAtoms<T = unknown>(key: NamespaceKey): NamespaceAtoms<T> {
  return {
    results: resultsFamily(key) as Atom.Writable<readonly ScoredResult<T>[]>,
    status: statusFamily(key),
    stats: statsFamily(key),
    query: queryFamily(key),
    isProcessing: isProcessingFamily(key),
    lastError: lastErrorFamily(key),
  }
}

/**
 * Get derived atoms for a namespace key
 *
 * These are computed atoms - read-only.
 */
export function getNamespaceDerivedAtoms(key: NamespaceKey) {
  return {
    isStreaming: isStreamingFamily(key),
    hasResults: hasResultsFamily(key),
    resultCount: resultCountFamily(key),
    throughput: throughputFamily(key),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Key Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create namespace key from parts
 */
export function makeNamespaceKey(type: string, instance: string): NamespaceKey {
  return `${type}:${instance}` as NamespaceKey
}

/**
 * Parse namespace key into parts
 */
export function parseNamespaceKey(key: NamespaceKey): { type: string; instance: string } {
  const [type, ...rest] = key.split(":")
  return { type, instance: rest.join(":") }
}
