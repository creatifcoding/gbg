/**
 * TMNL DataManager v2 - Namespace Atoms
 *
 * Atom families for kernel namespacing. Each namespace key gets its own
 * set of atoms, enabling multiple kernel instances to coexist.
 *
 * Uses Atom.family for parameterized atom creation with automatic cleanup
 * via WeakRef/FinalizationRegistry.
 *
 * @experimental v2 API - Universal DAQ pattern
 */

import { Atom } from "@effect-atom/atom"
import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import type {
  NamespaceKey,
  NamespaceAtoms,
  ScoredResult,
  StreamStatus,
  StreamStats,
  KernelType,
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
// Connection State Families (Network/Serial kernels)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Connection state for network/serial kernels
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed"

/**
 * Connection state atom family
 */
export const connectionStateFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<ConnectionState> =>
    Atom.make<ConnectionState>("disconnected")
)

/**
 * Reconnect attempts atom family
 */
export const reconnectAttemptsFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<number> =>
    Atom.make<number>(0)
)

/**
 * Last ping/pong timestamp for heartbeat
 */
export const lastHeartbeatFamily = Atom.family(
  (_key: NamespaceKey): Atom.Writable<number> =>
    Atom.make<number>(0)
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
 * IsConnected derived atom family
 *
 * For network/serial kernels
 */
export const isConnectedFamily = Atom.family(
  (key: NamespaceKey): Atom.Atom<boolean> =>
    Atom.make((get) => {
      const state = get(connectionStateFamily(key))
      return state === "connected"
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
    isConnected: isConnectedFamily(key),
    hasResults: hasResultsFamily(key),
    resultCount: resultCountFamily(key),
    throughput: throughputFamily(key),
  }
}

/**
 * Get connection atoms for network/serial kernels
 */
export function getConnectionAtoms(key: NamespaceKey) {
  return {
    connectionState: connectionStateFamily(key),
    reconnectAttempts: reconnectAttemptsFamily(key),
    lastHeartbeat: lastHeartbeatFamily(key),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Key Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create namespace key from parts
 */
export function makeNamespaceKey(type: KernelType, instance: string): NamespaceKey {
  return `${type}:${instance}` as NamespaceKey
}

/**
 * Parse namespace key into parts
 */
export function parseNamespaceKey(key: NamespaceKey): { type: KernelType; instance: string } {
  const [type, ...rest] = key.split(":")
  return { type: type as KernelType, instance: rest.join(":") }
}

/**
 * Validate namespace key format
 */
export function isValidNamespaceKey(key: string): key is NamespaceKey {
  const parts = key.split(":")
  if (parts.length < 2) return false

  const validTypes: KernelType[] = [
    "search",
    "network",
    "filesystem",
    "serial",
    "hardware",
    "custom",
  ]
  return validTypes.includes(parts[0] as KernelType)
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom Reset Utilities (Effect-based)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reset all atoms for a namespace to initial state
 *
 * Uses Effect.fn for traced execution.
 */
export const resetNamespaceAtoms = Effect.fn("v2/atoms/resetNamespaceAtoms")(
  (key: NamespaceKey) =>
    Effect.gen(function* () {
      yield* Console.log(`[v2/atoms] Resetting namespace: ${key}`)

      Atom.set(resultsFamily(key), [])
      Atom.set(statusFamily(key), "idle")
      Atom.set(statsFamily(key), { chunks: 0, items: 0, ms: 0 })
      Atom.set(queryFamily(key), "")
      Atom.set(isProcessingFamily(key), false)
      Atom.set(lastErrorFamily(key), null)

      // Also reset connection atoms
      Atom.set(connectionStateFamily(key), "disconnected")
      Atom.set(reconnectAttemptsFamily(key), 0)
      Atom.set(lastHeartbeatFamily(key), 0)

      yield* Console.log(`[v2/atoms] Reset complete: ${key}`)
    })
)

/**
 * Set error state for a namespace
 */
export const setNamespaceError = Effect.fn("v2/atoms/setNamespaceError")(
  (key: NamespaceKey, error: Error) =>
    Effect.gen(function* () {
      yield* Console.error(`[v2/atoms] Error in ${key}: ${error.message}`)

      Atom.set(statusFamily(key), "error")
      Atom.set(lastErrorFamily(key), error)
      Atom.set(isProcessingFamily(key), false)
    })
)

/**
 * Update stats for a namespace (untraced for hot path)
 */
export const updateNamespaceStats = Effect.fnUntraced(
  (key: NamespaceKey, stats: Partial<StreamStats>) =>
    Effect.sync(() => {
      const current = Atom.get(statsFamily(key))
      Atom.set(statsFamily(key), { ...current, ...stats })
    })
)

/**
 * Append results to a namespace (untraced for hot path)
 */
export const appendNamespaceResults = Effect.fnUntraced(
  <T>(key: NamespaceKey, newResults: readonly ScoredResult<T>[]) =>
    Effect.sync(() => {
      const current = Atom.get(resultsFamily(key)) as readonly ScoredResult<T>[]
      Atom.set(resultsFamily(key), [...current, ...newResults])
    })
)
