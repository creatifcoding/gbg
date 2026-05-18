/**
 * Federation — peer-sync surface for the PCT registry.
 *
 * Phase 3.7 (Flow B). Pull-based polling: this node periodically asks
 * each peer for its `Manifest` via `GET /capabilities`, then replays
 * the entries onto the local EventLog. The Registry folder's
 * precedence rule (timestamp first, lex nodeId tiebreak — from
 * Phase 3.2) handles convergence; stale arrivals are skipped at
 * fold time.
 *
 * # Cardinality
 *
 * One Federation service per node. The poll fiber is scope-bound:
 * when the Federation layer's scope closes (server shutdown), the
 * fiber stops and peer state is dropped.
 *
 * # API
 *
 *   peer(url)       — add a peer URL; subsequent polls include it
 *   unpeer(url)     — remove a peer
 *   peers           — snapshot of all peers + their last sync status
 *   syncNow(url)    — one-shot pull from a specific peer (for tests + CLI)
 *   peerEventLogRemote(remote) — Flow C: register native EventLogRemote peer
 *
 * # What's deferred for 3.7b+
 *
 *   - Push notifications (peer streams new events as they happen)
 *   - Delta sync (request only events since a revision, via a new
 *     /federation/since/:revision route)
 *   - Per-peer authentication / authorization
 *   - Conflict alerts (when precedence skips a peer's event,
 *     surface it in a Stream of conflict notices)
 *
 * @module @tmnl/pct/federation/Federation
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import type * as EventLogRemote from "effect-v4/unstable/eventlog/EventLogRemote"

import type { PactClientError } from "../client/PactClient.js"
import type { PeerSyncStatus } from "./Sync.js"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface SyncResult {
  /** Peer's nodeId (from their Manifest). */
  readonly peerNodeId: string
  /** Peer's reported revision after this sync. */
  readonly peerRevision: number
  /** Number of EventLog writes attempted. */
  readonly writes: number
}

export interface FederationShape {
  /**
   * Add a peer URL to the polling set. Idempotent — re-adding a known
   * URL is a no-op but resets its error count.
   */
  readonly peer: (baseUrl: string) => Effect.Effect<void>

  /**
   * Remove a peer URL. No effect if not in the set.
   */
  readonly unpeer: (baseUrl: string) => Effect.Effect<void>

  /** Snapshot of all current peers + their sync status. */
  readonly peers: Effect.Effect<ReadonlyArray<PeerSyncStatus>>

  /**
   * One-shot pull from a specific peer. Useful for tests and the
   * `pact federation sync <url>` CLI command (3.8.1). Does not
   * require the URL to already be in the peer set.
   */
  readonly syncNow: (
    baseUrl: string,
  ) => Effect.Effect<SyncResult, PactClientError>

  /**
   * Flow C registration mode: attach an actual Effect-smol
   * EventLogRemote to the local EventLog registry. The lifetime is
   * scope-bound by Effect-smol's `registerRemote`, so callers use it
   * inside the owning server/runtime scope.
   */
  readonly peerEventLogRemote: (
    remote: EventLogRemote.EventLogRemote["Service"],
  ) => Effect.Effect<void>
}

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The Federation service. Provided by `Federation.Default` (which
 * wires a poll-loop fiber + requires HttpClient + EventLog).
 *
 * Consumers `yield* Federation` and call `peer(url)` to bootstrap
 * a peer relationship. The poll loop runs continuously in the
 * background.
 */
export class Federation extends Context.Service<
  Federation,
  FederationShape
>()("@tmnl/pct/federation/Federation") {}
