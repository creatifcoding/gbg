/**
 * Federation sync — pure-ish functions converting a peer's `Manifest`
 * back into the events that would have produced it, then replaying
 * them onto the local `EventLog`.
 *
 * # The trick
 *
 * Each `SchemaEntry` / `OperationEntry` / `Deprecation` carries the
 * metadata of the original registration: the producer's `originNodeId`
 * and the `registeredAt` / `deprecatedAt` timestamp. Federation
 * preserves these: when node B imports node A's manifest, the resulting
 * events on B's journal carry A's origin and A's timestamp.
 *
 * The Registry's folders apply the precedence rule (timestamp first,
 * lex nodeId tiebreak) when these events fold into B's state. Stale
 * arrivals are skipped at fold time; duplicates short-circuit. The
 * convergence guarantees come for free.
 *
 * # Why not EventJournal.applyRemoteEntries
 *
 * The substrate-level `applyRemoteEntries` is heavier — it requires
 * a `RemoteId` for the peer + `remoteSequence` tracking + msgpack
 * envelope. Useful for production-grade replication with strong
 * delivery semantics. For our first federation milestone, the simpler
 * "rebuild events from manifest" approach is sufficient and uses only
 * primitives we already have.
 *
 * @module @tmnl/pct/federation/Sync
 */

import * as Clock from "effect-v4/Clock"
import * as Effect from "effect-v4/Effect"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"
import type * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"

import type { Manifest } from "../manifest/Manifest.js"
import { RegistryGroup } from "../registry/RegistryEvents.js"

const eventSchema = EventLog.schema(RegistryGroup)

// ─── Apply a peer's manifest onto local EventLog ────────────────────────────

/**
 * Replay every entry in the peer's manifest as events on the local
 * EventLog. Each event carries the peer's original metadata, so the
 * Registry folder's precedence rule decides whether to apply or skip.
 *
 * Idempotent: re-importing the same manifest twice produces the same
 * state (stale events are skipped at fold time by the precedence rule).
 *
 * Returns a count of write attempts (not necessarily of state mutations
 * — fold may skip stale events).
 */
export const applyManifest = (
  manifest: Manifest,
): Effect.Effect<
  { readonly writes: number },
  EventJournal.EventJournalError,
  EventLog.EventLog
> =>
  Effect.gen(function* () {
    const log = yield* EventLog.EventLog
    let writes = 0

    // 1. Schema registrations
    for (const entry of manifest.schemas) {
      yield* log.write({
        schema: eventSchema,
        event: "SchemaRegistered",
        payload: {
          schemaId: entry.schemaId,
          version: entry.version,
          schemaDocument: entry.schemaDocument,
          registeredAt: entry.registeredAt,
          originNodeId: entry.originNodeId,
          ...(entry.description !== undefined
            ? { description: entry.description }
            : {}),
        },
      })
      writes++

      // 2. If this schema was deprecated, replay the deprecation event too
      if (entry.deprecated !== null) {
        yield* log.write({
          schema: eventSchema,
          event: "SchemaDeprecated",
          payload: {
            schemaId: entry.schemaId,
            version: entry.version,
            successor: entry.deprecated.successor,
            deprecatedAt: entry.deprecated.at,
            reason: entry.deprecated.reason,
            originNodeId: entry.deprecated.originNodeId,
          },
        })
        writes++
      }
    }

    // 3. Operation registrations
    for (const op of manifest.operations) {
      yield* log.write({
        schema: eventSchema,
        event: "OperationRegistered",
        payload: {
          name: op.name,
          version: op.version,
          kind: op.kind,
          inputSchemaId: op.inputSchemaId,
          outputSchemaId: op.outputSchemaId,
          errorSchemaIds: op.errorSchemaIds,
          registeredAt: op.registeredAt,
          originNodeId: op.originNodeId,
          ...(op.description !== undefined
            ? { description: op.description }
            : {}),
        },
      })
      writes++

      // 4. If deprecated, replay deprecation
      if (op.deprecated !== null) {
        yield* log.write({
          schema: eventSchema,
          event: "OperationDeprecated",
          payload: {
            name: op.name,
            version: op.version,
            successor: op.deprecated.successor,
            deprecatedAt: op.deprecated.at,
            reason: op.deprecated.reason,
            originNodeId: op.deprecated.originNodeId,
          },
        })
        writes++
      }
    }

    return { writes }
  })

// ─── Sync metadata ──────────────────────────────────────────────────────────

/**
 * Per-peer sync state. Tracks when we last successfully pulled a
 * manifest from a peer and what revision we observed. Used to decide
 * whether a poll is "new info" or a no-op.
 *
 * Future Phase 3.7b: use this to request only deltas
 * (`/federation/since/:revision`) rather than full manifest each poll.
 */
export interface PeerSyncStatus {
  readonly url: string
  readonly lastPolledMs: number
  readonly lastObservedRevision: number
  readonly lastObservedNodeId: string | undefined
  readonly errorCount: number
  readonly lastError?: string
}

export const makeStatus = (url: string): Effect.Effect<PeerSyncStatus> =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    return {
      url,
      lastPolledMs: now,
      lastObservedRevision: 0,
      lastObservedNodeId: undefined,
      errorCount: 0,
    }
  })
