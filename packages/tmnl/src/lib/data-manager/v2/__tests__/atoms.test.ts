/**
 * TMNL DataManager v2 - Atom Family Tests
 *
 * Tests for namespaced atom families following the Atom-as-State doctrine.
 * Validates namespace isolation, derived atoms, and Effect utilities.
 *
 * Key Pattern: Atom.family creates independent atoms per namespace key.
 * Each namespace has isolated state - critical for multi-kernel scenarios.
 *
 * Uses Registry.make() + r.get/r.set pattern from effect-atom.
 */

import { describe, it, expect, beforeEach } from "vitest"
import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"
import * as Effect from "effect/Effect"
import {
  // Core atom families
  resultsFamily,
  statusFamily,
  statsFamily,
  queryFamily,
  isProcessingFamily,
  lastErrorFamily,
  // Connection atom families
  connectionStateFamily,
  reconnectAttemptsFamily,
  lastHeartbeatFamily,
  // Derived atom families
  isStreamingFamily,
  isConnectedFamily,
  hasResultsFamily,
  resultCountFamily,
  throughputFamily,
  // Bundle accessors
  getNamespaceAtoms,
  getNamespaceDerivedAtoms,
  getConnectionAtoms,
  // Utilities
  makeNamespaceKey,
  parseNamespaceKey,
  isValidNamespaceKey,
  // Effect operations
  resetNamespaceAtoms,
  setNamespaceError,
  updateNamespaceStats,
  appendNamespaceResults,
} from "../atoms"
import type { NamespaceKey, ScoredResult, StreamStats } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeTestResult = <T>(item: T, score = 1.0): ScoredResult<T> => ({
  item,
  score,
  metadata: {},
  timestamp: Date.now(),
})

describe("DataManager v2 - Atom Families", () => {
  let registry: ReturnType<typeof Registry.make>

  beforeEach(() => {
    registry = Registry.make()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Namespace Key Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Namespace Key Utilities", () => {
    /**
     * Hypothesis 1: makeNamespaceKey creates valid keys
     */
    it("makeNamespaceKey creates proper format", () => {
      const key = makeNamespaceKey("search", "movies")
      expect(key).toBe("search:movies")
    })

    it("makeNamespaceKey handles complex instance names", () => {
      const key = makeNamespaceKey("network", "trading:live:v2")
      expect(key).toBe("network:trading:live:v2")
    })

    /**
     * Hypothesis 2: parseNamespaceKey extracts type and instance
     */
    it("parseNamespaceKey extracts type and instance", () => {
      const { type, instance } = parseNamespaceKey("search:movies" as NamespaceKey)
      expect(type).toBe("search")
      expect(instance).toBe("movies")
    })

    it("parseNamespaceKey handles colons in instance name", () => {
      const { type, instance } = parseNamespaceKey("network:trading:live:v2" as NamespaceKey)
      expect(type).toBe("network")
      expect(instance).toBe("trading:live:v2")
    })

    /**
     * Hypothesis 3: isValidNamespaceKey validates format
     */
    it("isValidNamespaceKey accepts valid keys", () => {
      expect(isValidNamespaceKey("search:movies")).toBe(true)
      expect(isValidNamespaceKey("network:ws")).toBe(true)
      expect(isValidNamespaceKey("filesystem:logs")).toBe(true)
      expect(isValidNamespaceKey("serial:arduino")).toBe(true)
      expect(isValidNamespaceKey("hardware:usb")).toBe(true)
      expect(isValidNamespaceKey("custom:mykernel")).toBe(true)
    })

    it("isValidNamespaceKey rejects invalid keys", () => {
      expect(isValidNamespaceKey("invalid:key")).toBe(false)
      expect(isValidNamespaceKey("movies")).toBe(false)
      expect(isValidNamespaceKey("")).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Core Atom Families
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Core Atom Families", () => {
    const NS1: NamespaceKey = "search:movies" as NamespaceKey
    const NS2: NamespaceKey = "search:users" as NamespaceKey

    beforeEach(() => {
      // Reset both namespaces to initial state via registry
      registry.set(resultsFamily(NS1), [])
      registry.set(statusFamily(NS1), "idle")
      registry.set(statsFamily(NS1), { chunks: 0, items: 0, ms: 0 })
      registry.set(queryFamily(NS1), "")
      registry.set(isProcessingFamily(NS1), false)
      registry.set(lastErrorFamily(NS1), null)

      registry.set(resultsFamily(NS2), [])
      registry.set(statusFamily(NS2), "idle")
      registry.set(statsFamily(NS2), { chunks: 0, items: 0, ms: 0 })
      registry.set(queryFamily(NS2), "")
      registry.set(isProcessingFamily(NS2), false)
      registry.set(lastErrorFamily(NS2), null)
    })

    /**
     * Hypothesis 4: Atom.family returns same atom for same key
     */
    it("returns same atom instance for same namespace key", () => {
      const atom1 = resultsFamily(NS1)
      const atom2 = resultsFamily(NS1)
      expect(atom1).toBe(atom2)
    })

    /**
     * Hypothesis 5: Atom.family returns different atoms for different keys
     */
    it("returns different atom instances for different namespace keys", () => {
      const atom1 = resultsFamily(NS1)
      const atom2 = resultsFamily(NS2)
      expect(atom1).not.toBe(atom2)
    })

    /**
     * Hypothesis 6: Namespace state is isolated
     */
    it("namespace state is isolated between keys", () => {
      const results1: ScoredResult<{ id: string }>[] = [
        makeTestResult({ id: "movie-1" }),
      ]
      const results2: ScoredResult<{ id: string }>[] = [
        makeTestResult({ id: "user-1" }),
        makeTestResult({ id: "user-2" }),
      ]

      registry.set(resultsFamily(NS1), results1)
      registry.set(resultsFamily(NS2), results2)

      expect(registry.get(resultsFamily(NS1))).toHaveLength(1)
      expect(registry.get(resultsFamily(NS2))).toHaveLength(2)

      // Mutating NS1 doesn't affect NS2
      registry.set(resultsFamily(NS1), [])
      expect(registry.get(resultsFamily(NS1))).toHaveLength(0)
      expect(registry.get(resultsFamily(NS2))).toHaveLength(2)
    })

    /**
     * Hypothesis 7: statusFamily tracks stream status correctly
     */
    it("statusFamily tracks stream status transitions", () => {
      expect(registry.get(statusFamily(NS1))).toBe("idle")

      registry.set(statusFamily(NS1), "streaming")
      expect(registry.get(statusFamily(NS1))).toBe("streaming")

      registry.set(statusFamily(NS1), "complete")
      expect(registry.get(statusFamily(NS1))).toBe("complete")
    })

    /**
     * Hypothesis 8: statsFamily tracks streaming metrics
     */
    it("statsFamily accumulates streaming metrics", () => {
      const stats: StreamStats = { chunks: 5, items: 250, ms: 100 }
      registry.set(statsFamily(NS1), stats)

      const retrieved = registry.get(statsFamily(NS1))
      expect(retrieved.chunks).toBe(5)
      expect(retrieved.items).toBe(250)
      expect(retrieved.ms).toBe(100)
    })

    /**
     * Hypothesis 9: queryFamily stores current search query
     */
    it("queryFamily stores current query string", () => {
      registry.set(queryFamily(NS1), "matrix")
      expect(registry.get(queryFamily(NS1))).toBe("matrix")

      registry.set(queryFamily(NS1), "alien")
      expect(registry.get(queryFamily(NS1))).toBe("alien")
    })

    /**
     * Hypothesis 10: lastErrorFamily stores Error instances
     */
    it("lastErrorFamily stores and clears errors", () => {
      const error = new Error("Test error")
      registry.set(lastErrorFamily(NS1), error)

      expect(registry.get(lastErrorFamily(NS1))).toBe(error)
      expect(registry.get(lastErrorFamily(NS1))?.message).toBe("Test error")

      registry.set(lastErrorFamily(NS1), null)
      expect(registry.get(lastErrorFamily(NS1))).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived Atom Families
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Derived Atom Families", () => {
    const NS: NamespaceKey = "search:test" as NamespaceKey

    beforeEach(() => {
      registry.set(resultsFamily(NS), [])
      registry.set(statusFamily(NS), "idle")
      registry.set(statsFamily(NS), { chunks: 0, items: 0, ms: 0 })
      registry.set(connectionStateFamily(NS), "disconnected")
    })

    /**
     * Hypothesis 11: isStreamingFamily derives from status
     */
    it("isStreamingFamily is true when status is streaming", () => {
      expect(registry.get(isStreamingFamily(NS))).toBe(false)

      registry.set(statusFamily(NS), "streaming")
      expect(registry.get(isStreamingFamily(NS))).toBe(true)

      registry.set(statusFamily(NS), "complete")
      expect(registry.get(isStreamingFamily(NS))).toBe(false)
    })

    /**
     * Hypothesis 12: hasResultsFamily derives from results.length
     */
    it("hasResultsFamily is true when results exist", () => {
      expect(registry.get(hasResultsFamily(NS))).toBe(false)

      registry.set(resultsFamily(NS), [makeTestResult({ id: "1" })])
      expect(registry.get(hasResultsFamily(NS))).toBe(true)

      registry.set(resultsFamily(NS), [])
      expect(registry.get(hasResultsFamily(NS))).toBe(false)
    })

    /**
     * Hypothesis 13: resultCountFamily returns correct count
     */
    it("resultCountFamily returns correct result count", () => {
      expect(registry.get(resultCountFamily(NS))).toBe(0)

      registry.set(resultsFamily(NS), [
        makeTestResult({ id: "1" }),
        makeTestResult({ id: "2" }),
        makeTestResult({ id: "3" }),
      ])
      expect(registry.get(resultCountFamily(NS))).toBe(3)
    })

    /**
     * Hypothesis 14: throughputFamily calculates items/second
     */
    it("throughputFamily calculates throughput from stats", () => {
      // No time elapsed = 0 throughput
      registry.set(statsFamily(NS), { chunks: 0, items: 100, ms: 0 })
      expect(registry.get(throughputFamily(NS))).toBe(0)

      // 100 items in 100ms = 1000 items/second
      registry.set(statsFamily(NS), { chunks: 1, items: 100, ms: 100 })
      expect(registry.get(throughputFamily(NS))).toBe(1000)

      // 500 items in 250ms = 2000 items/second
      registry.set(statsFamily(NS), { chunks: 5, items: 500, ms: 250 })
      expect(registry.get(throughputFamily(NS))).toBe(2000)
    })

    /**
     * Hypothesis 15: isConnectedFamily derives from connectionState
     */
    it("isConnectedFamily is true when connected", () => {
      expect(registry.get(isConnectedFamily(NS))).toBe(false)

      registry.set(connectionStateFamily(NS), "connecting")
      expect(registry.get(isConnectedFamily(NS))).toBe(false)

      registry.set(connectionStateFamily(NS), "connected")
      expect(registry.get(isConnectedFamily(NS))).toBe(true)

      registry.set(connectionStateFamily(NS), "reconnecting")
      expect(registry.get(isConnectedFamily(NS))).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Bundle Accessors
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Bundle Accessors", () => {
    const NS: NamespaceKey = "search:bundle-test" as NamespaceKey

    /**
     * Hypothesis 16: getNamespaceAtoms returns all core atoms
     */
    it("getNamespaceAtoms returns complete atom bundle", () => {
      const atoms = getNamespaceAtoms(NS)

      expect(atoms.results).toBeDefined()
      expect(atoms.status).toBeDefined()
      expect(atoms.stats).toBeDefined()
      expect(atoms.query).toBeDefined()
      expect(atoms.isProcessing).toBeDefined()
      expect(atoms.lastError).toBeDefined()
    })

    /**
     * Hypothesis 17: getNamespaceAtoms returns correct atoms for namespace
     */
    it("getNamespaceAtoms atoms are scoped to namespace", () => {
      const atoms = getNamespaceAtoms(NS)

      // Set via bundle
      registry.set(atoms.status, "streaming")
      registry.set(atoms.query, "test-query")

      // Verify via family
      expect(registry.get(statusFamily(NS))).toBe("streaming")
      expect(registry.get(queryFamily(NS))).toBe("test-query")
    })

    /**
     * Hypothesis 18: getNamespaceDerivedAtoms returns computed atoms
     */
    it("getNamespaceDerivedAtoms returns derived atom bundle", () => {
      const derived = getNamespaceDerivedAtoms(NS)

      expect(derived.isStreaming).toBeDefined()
      expect(derived.isConnected).toBeDefined()
      expect(derived.hasResults).toBeDefined()
      expect(derived.resultCount).toBeDefined()
      expect(derived.throughput).toBeDefined()
    })

    /**
     * Hypothesis 19: getConnectionAtoms returns network/serial atoms
     */
    it("getConnectionAtoms returns connection-related atoms", () => {
      const conn = getConnectionAtoms(NS)

      expect(conn.connectionState).toBeDefined()
      expect(conn.reconnectAttempts).toBeDefined()
      expect(conn.lastHeartbeat).toBeDefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Effect Utilities
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Effect Utilities", () => {
    /**
     * NOTE: Effect utilities (resetNamespaceAtoms, setNamespaceError, etc.)
     * use Atom.set/Atom.get directly within Effect.sync blocks.
     *
     * These require the AtomRegistry service to be in scope. In production,
     * they're called from within KernelRegistry or SearchKernel operations
     * which have the registry context.
     *
     * Testing them in isolation would require:
     * 1. Providing AtomRegistry service via Effect.provideService
     * 2. Using Registry.AtomRegistry context
     *
     * The integration tests in KernelRegistry.test.ts validate these utilities
     * work correctly in the full service context.
     *
     * Hypotheses 20-23 are tested indirectly via KernelRegistry integration tests.
     */

    it("Effect utilities exist and are typed correctly", () => {
      // Type-level validation that the utilities exist
      expect(typeof resetNamespaceAtoms).toBe("function")
      expect(typeof setNamespaceError).toBe("function")
      expect(typeof updateNamespaceStats).toBe("function")
      expect(typeof appendNamespaceResults).toBe("function")
    })

    it("Effect utilities return Effect types", () => {
      const NS: NamespaceKey = "search:type-test" as NamespaceKey

      // These return Effect<void>, not raw values
      const resetEff = resetNamespaceAtoms(NS)
      const errorEff = setNamespaceError(NS, new Error("test"))
      const statsEff = updateNamespaceStats(NS, { items: 100 })
      const appendEff = appendNamespaceResults(NS, [])

      // Verify they're Effects (using Effect.isEffect)
      expect(Effect.isEffect(resetEff)).toBe(true)
      expect(Effect.isEffect(errorEff)).toBe(true)
      expect(Effect.isEffect(statsEff)).toBe(true)
      expect(Effect.isEffect(appendEff)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection State Families
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Connection State Families", () => {
    const NS: NamespaceKey = "network:websocket" as NamespaceKey

    beforeEach(() => {
      registry.set(connectionStateFamily(NS), "disconnected")
      registry.set(reconnectAttemptsFamily(NS), 0)
      registry.set(lastHeartbeatFamily(NS), 0)
    })

    /**
     * Hypothesis 24: connectionStateFamily tracks connection lifecycle
     */
    it("connectionStateFamily tracks connection states", () => {
      expect(registry.get(connectionStateFamily(NS))).toBe("disconnected")

      registry.set(connectionStateFamily(NS), "connecting")
      expect(registry.get(connectionStateFamily(NS))).toBe("connecting")

      registry.set(connectionStateFamily(NS), "connected")
      expect(registry.get(connectionStateFamily(NS))).toBe("connected")

      registry.set(connectionStateFamily(NS), "reconnecting")
      expect(registry.get(connectionStateFamily(NS))).toBe("reconnecting")

      registry.set(connectionStateFamily(NS), "failed")
      expect(registry.get(connectionStateFamily(NS))).toBe("failed")
    })

    /**
     * Hypothesis 25: reconnectAttemptsFamily tracks retry count
     */
    it("reconnectAttemptsFamily increments correctly", () => {
      expect(registry.get(reconnectAttemptsFamily(NS))).toBe(0)

      registry.set(reconnectAttemptsFamily(NS), 1)
      expect(registry.get(reconnectAttemptsFamily(NS))).toBe(1)

      // Simulate increment pattern
      const current = registry.get(reconnectAttemptsFamily(NS))
      registry.set(reconnectAttemptsFamily(NS), current + 1)
      expect(registry.get(reconnectAttemptsFamily(NS))).toBe(2)
    })

    /**
     * Hypothesis 26: lastHeartbeatFamily tracks ping/pong timestamps
     */
    it("lastHeartbeatFamily tracks heartbeat timestamps", () => {
      expect(registry.get(lastHeartbeatFamily(NS))).toBe(0)

      const now = Date.now()
      registry.set(lastHeartbeatFamily(NS), now)
      expect(registry.get(lastHeartbeatFamily(NS))).toBe(now)
    })
  })
})
