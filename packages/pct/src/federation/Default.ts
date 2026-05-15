/**
 * Federation.Default — Layer that wires the poll loop + service.
 *
 * Spawns a long-running fiber bound to the service's scope. Every
 * `pollIntervalMs`, the fiber walks the peer set and syncs each one.
 *
 * @module @tmnl/pct/federation/Default
 */

import * as Clock from "effect-v4/Clock"
import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as Schedule from "effect-v4/Schedule"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"
import * as HttpClient from "effect-v4/unstable/http/HttpClient"

import {
  type PactClientError,
  make as makePactClient,
} from "../client/PactClient.js"
import { Federation, type FederationShape, type SyncResult } from "./Federation.js"
import {
  applyManifest,
  makeStatus,
  type PeerSyncStatus,
} from "./Sync.js"

// ─── Config ─────────────────────────────────────────────────────────────────

export interface FederationConfig {
  /**
   * Polling interval. Defaults to 5 seconds for production; tests
   * typically pass a much shorter interval.
   */
  readonly pollIntervalMs?: number
  /**
   * If true, perform an initial sync immediately when a peer is
   * added (don't wait for the next tick). Default: true.
   */
  readonly syncOnAdd?: boolean
}

// ─── Default layer ──────────────────────────────────────────────────────────

/**
 * The Default Federation layer. Spawns a daemon fiber that polls
 * all peers on the configured interval.
 *
 * Requires:
 *   - `HttpClient.HttpClient` (each peer poll constructs a transient
 *     `PactClient` against the peer's baseUrl)
 *   - `EventLog.EventLog` (the local journal that imported events
 *     are written to)
 */
export const layer = (
  config: FederationConfig = {},
): Layer.Layer<
  Federation,
  never,
  HttpClient.HttpClient | EventLog.EventLog
> => {
  const interval = config.pollIntervalMs ?? 5000
  const syncOnAdd = config.syncOnAdd ?? true

  return Layer.effect(
    Federation,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient
      const eventLog = yield* EventLog.EventLog
      const peersRef = yield* Ref.make<ReadonlyMap<string, PeerSyncStatus>>(
        new Map(),
      )

      /**
       * One-shot sync: fetch a peer's manifest, replay onto local
       * EventLog, update status. Used by both `syncNow` and the
       * poll loop.
       */
      const syncPeer = (
        baseUrl: string,
      ): Effect.Effect<SyncResult, PactClientError> =>
        Effect.gen(function* () {
          // Construct a transient PactClient against the peer's URL.
          // Each call constructs a new one — schemas are cached per-client,
          // so manifests of the SAME peer benefit from cache across polls
          // only if we keep the client. Future optimization: cache the
          // client per peer URL.
          const client = yield* makePactClient({ baseUrl }).pipe(
            Effect.provideService(HttpClient.HttpClient, httpClient),
          )

          const manifest = yield* client.capabilities

          // Replay onto local EventLog. The Registry folder's
          // precedence rule decides what's accepted.
          const { writes } = yield* applyManifest(manifest).pipe(
            Effect.provideService(EventLog.EventLog, eventLog),
            // EventJournal errors aren't a federation-level concern;
            // surface them as opaque transport failure.
            Effect.catchTag("EventJournalError", (err) =>
              Effect.die(err),
            ),
          )

          // Update the peer's status
          const now = yield* Clock.currentTimeMillis
          yield* Ref.update(peersRef, (m) => {
            const existing = m.get(baseUrl)
            const next = new Map(m)
            next.set(baseUrl, {
              url: baseUrl,
              lastPolledMs: now,
              lastObservedRevision: manifest.revision,
              lastObservedNodeId: manifest.nodeId,
              errorCount: 0,
              ...(existing !== undefined ? {} : {}),
            })
            return next
          })

          return {
            peerNodeId: manifest.nodeId,
            peerRevision: manifest.revision,
            writes,
          }
        }).pipe(
          // On error, increment error count for the peer (don't blow
          // the loop). The error is still raised to the caller.
          Effect.tapError((err) =>
            Effect.gen(function* () {
              const now = yield* Clock.currentTimeMillis
              yield* Ref.update(peersRef, (m) => {
                const existing = m.get(baseUrl)
                if (existing === undefined) return m
                const next = new Map(m)
                next.set(baseUrl, {
                  ...existing,
                  lastPolledMs: now,
                  errorCount: existing.errorCount + 1,
                  lastError: String(err),
                })
                return next
              })
            }),
          ),
        )

      const peer: FederationShape["peer"] = (baseUrl) =>
        Effect.gen(function* () {
          // Add to the peer set (idempotent)
          const initial = yield* makeStatus(baseUrl)
          yield* Ref.update(peersRef, (m) => {
            if (m.has(baseUrl)) {
              // Reset error count on re-add but preserve last-seen info
              const existing = m.get(baseUrl)!
              const next = new Map(m)
              next.set(baseUrl, { ...existing, errorCount: 0 })
              return next
            }
            const next = new Map(m)
            next.set(baseUrl, initial)
            return next
          })

          // Optionally sync immediately (don't wait for next poll tick).
          // We swallow errors here — the poll loop will retry.
          if (syncOnAdd) {
            yield* syncPeer(baseUrl).pipe(
              Effect.catchCause(() => Effect.void),
            )
          }
        })

      const unpeer: FederationShape["unpeer"] = (baseUrl) =>
        Ref.update(peersRef, (m) => {
          if (!m.has(baseUrl)) return m
          const next = new Map(m)
          next.delete(baseUrl)
          return next
        })

      const peers: FederationShape["peers"] = Effect.map(
        Ref.get(peersRef),
        (m) => Array.from(m.values()),
      )

      const syncNow: FederationShape["syncNow"] = syncPeer

      // ── Spawn the poll loop fiber ──────────────────────────────────────
      // Each tick: walk all peers, sync each. Errors logged via the
      // per-peer status (errorCount + lastError); never propagate.
      const tick = Effect.gen(function* () {
        const current = yield* Ref.get(peersRef)
        for (const baseUrl of current.keys()) {
          yield* syncPeer(baseUrl).pipe(
            Effect.catchCause(() => Effect.void),
          )
        }
      })

      yield* Effect.forkScoped(
        Effect.repeat(tick, Schedule.spaced(Duration.millis(interval))),
      )

      return Federation.of({ peer, unpeer, peers, syncNow })
    }),
  )
}

/** Convenience: a default layer with 5-second polling. */
export const Default: Layer.Layer<
  Federation,
  never,
  HttpClient.HttpClient | EventLog.EventLog
> = layer()
