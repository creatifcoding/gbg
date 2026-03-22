/**
 * Tier Orchestrator — Multi-Tier Persistence Coordination
 *
 * Coordinates writes/reads across persistence tiers:
 *
 *   Hot  (Atom.make)       — in-memory, instant, React-reactive
 *   Warm (localStorage)    — survives refresh, 24h TTL, fast
 *   Cold (KVS/IndexedDB)   — survives clear, full trees, DI-able
 *   Frozen (JSONL string)  — export/import, pi-compatible
 *
 * Hydration priority: Hot → Warm → Cold → Frozen
 * Write-through: Hot → Warm + Cold (fire-and-forget)
 *
 * Design principles:
 *   - Persistence never blocks UI
 *   - All writes are best-effort (errors caught)
 *   - Hydration cascades through tiers
 *   - Cold tier backend is DI-able (swap IndexedDB ↔ SQLite via Layer)
 *
 * @module harness/session/v2/tier-orchestrator
 */

import { Context, Effect, Layer, Option, Schema } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { SessionTree } from './tree'
import { SessionMetadata } from './metadata'
import { SessionStore, type SessionStoreOps } from './session-store'
import { treeToJsonl, jsonlToTree, extractMetadata } from './serialization'
import type { HarnessSessionId } from './identity'

// =============================================================================
// Warm tier — localStorage with TTL
// =============================================================================

const WARM_PREFIX = 'session:warm:'
const WARM_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface WarmEntry {
  readonly tree: any // raw JSON of SessionTree
  readonly savedAt: number
}

const WarmEntrySchema = Schema.Struct({
  tree: Schema.Unknown,
  savedAt: Schema.Number,
})

const encodeWarm = Schema.encode(Schema.parseJson(WarmEntrySchema))
const decodeWarm = Schema.decode(Schema.parseJson(WarmEntrySchema))

// =============================================================================
// Tier Orchestrator — the coordination service
// =============================================================================

export interface TierOrchestratorOps {
  /**
   * Persist a tree across tiers (fire-and-forget).
   * Writes to warm + cold in parallel.
   */
  readonly persist: (tree: SessionTree) => Effect.Effect<void>

  /**
   * Hydrate a session from the best available tier.
   * Priority: warm → cold
   */
  readonly hydrate: (
    id: HarnessSessionId,
  ) => Effect.Effect<Option.Option<SessionTree>>

  /**
   * Export a session as JSONL (frozen tier format).
   */
  readonly exportJsonl: (
    id: HarnessSessionId,
  ) => Effect.Effect<Option.Option<string>>

  /**
   * Import a session from JSONL (frozen tier format).
   * Writes to warm + cold.
   */
  readonly importJsonl: (jsonl: string) => Effect.Effect<SessionTree>

  /**
   * Delete a session from all tiers.
   */
  readonly purge: (id: HarnessSessionId) => Effect.Effect<void>

  /**
   * List all session metadata from cold tier.
   */
  readonly listSessions: () => Effect.Effect<ReadonlyArray<SessionMetadata>>

  /**
   * Evict expired entries from warm tier.
   */
  readonly evictWarm: () => Effect.Effect<number>
}

// =============================================================================
// Service tag
// =============================================================================

export class TierOrchestrator extends Context.Tag(
  'tmnl/session/TierOrchestrator',
)<TierOrchestrator, TierOrchestratorOps>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeTierOrchestrator = Effect.gen(function* () {
  const cold = yield* SessionStore

  // -- Warm tier (localStorage) — direct window.localStorage access ----------
  // We use raw localStorage instead of a second KeyValueStore layer
  // to avoid service composition complexity. Warm tier is simple and fast.

  const warmGet = (id: string): Effect.Effect<Option.Option<SessionTree>> =>
    Effect.gen(function* () {
      if (typeof window === 'undefined') return Option.none()
      const raw = yield* Effect.try(() =>
        window.localStorage.getItem(`${WARM_PREFIX}${id}`),
      ).pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!raw) return Option.none()

      const entry = yield* decodeWarm(raw).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )

      if (!entry) return Option.none()

      // TTL check
      if (Date.now() - entry.savedAt > WARM_TTL_MS) {
        yield* Effect.try(() =>
          window.localStorage.removeItem(`${WARM_PREFIX}${id}`),
        ).pipe(Effect.catchAll(() => Effect.void))
        return Option.none()
      }

      // Parse the tree from the warm entry
      const tree = yield* Effect.try(() =>
        Schema.decodeUnknownSync(SessionTree)(entry.tree),
      ).pipe(Effect.catchAll(() => Effect.succeed(null)))

      return tree ? Option.some(tree) : Option.none()
    })

  const warmSet = (tree: SessionTree): Effect.Effect<void> =>
    Effect.gen(function* () {
      if (typeof window === 'undefined') return
      const warmEntry: WarmEntry = {
        tree: Schema.encodeSync(SessionTree)(tree),
        savedAt: Date.now(),
      }
      const encoded = yield* encodeWarm(warmEntry).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (encoded) {
        yield* Effect.try(() =>
          window.localStorage.setItem(
            `${WARM_PREFIX}${tree.header.id}`,
            encoded,
          ),
        ).pipe(Effect.catchAll(() => Effect.void))
      }
    })

  const warmRemove = (id: string): Effect.Effect<void> =>
    Effect.try(() => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`${WARM_PREFIX}${id}`)
      }
    }).pipe(Effect.catchAll(() => Effect.void))

  // -- Orchestrated operations -----------------------------------------------

  const persist: TierOrchestratorOps['persist'] = (tree) =>
    Effect.gen(function* () {
      // Fire-and-forget: warm + cold in parallel
      yield* Effect.all(
        [warmSet(tree), cold.saveTree(tree)],
        { concurrency: 2, discard: true },
      ).pipe(Effect.catchAll(() => Effect.void))
    })

  const hydrate: TierOrchestratorOps['hydrate'] = (id) =>
    Effect.gen(function* () {
      // Try warm first (fast)
      const warm = yield* warmGet(id)
      if (Option.isSome(warm)) return warm

      // Fall back to cold
      const tree = yield* cold.loadTree(id)
      if (Option.isSome(tree)) {
        // Promote to warm for next time
        yield* warmSet(tree.value).pipe(Effect.catchAll(() => Effect.void))
      }
      return tree
    })

  const exportJsonl: TierOrchestratorOps['exportJsonl'] = (id) =>
    Effect.gen(function* () {
      const tree = yield* hydrate(id)
      if (Option.isNone(tree)) return Option.none<string>()
      const jsonl = yield* treeToJsonl(tree.value)
      return Option.some(jsonl)
    })

  const importJsonl: TierOrchestratorOps['importJsonl'] = (jsonl) =>
    Effect.gen(function* () {
      const tree = yield* jsonlToTree(jsonl)
      yield* persist(tree)
      return tree
    })

  const purge: TierOrchestratorOps['purge'] = (id) =>
    Effect.gen(function* () {
      yield* Effect.all(
        [warmRemove(id), cold.deleteTree(id)],
        { concurrency: 2, discard: true },
      ).pipe(Effect.catchAll(() => Effect.void))
    })

  const listSessions: TierOrchestratorOps['listSessions'] = () =>
    cold.listMeta()

  const evictWarm: TierOrchestratorOps['evictWarm'] = () =>
    Effect.gen(function* () {
      if (typeof window === 'undefined') return 0
      let evicted = 0
      const keys = yield* Effect.try(() => {
        const result: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key?.startsWith(WARM_PREFIX)) result.push(key)
        }
        return result
      }).pipe(Effect.catchAll(() => Effect.succeed([] as string[])))

      for (const key of keys) {
        const raw = yield* Effect.try(() =>
          window.localStorage.getItem(key),
        ).pipe(Effect.catchAll(() => Effect.succeed(null)))

        if (!raw) continue

        const entry = yield* decodeWarm(raw).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        )

        if (!entry || Date.now() - entry.savedAt > WARM_TTL_MS) {
          yield* Effect.try(() =>
            window.localStorage.removeItem(key),
          ).pipe(Effect.catchAll(() => Effect.void))
          evicted++
        }
      }

      return evicted
    })

  return {
    persist,
    hydrate,
    exportJsonl,
    importJsonl,
    purge,
    listSessions,
    evictWarm,
  } satisfies TierOrchestratorOps
})

// =============================================================================
// Layers
// =============================================================================

/**
 * TierOrchestrator backed by SessionStore (which itself needs KeyValueStore).
 *
 * Full composition:
 *   TierOrchestrator.Default
 *     .pipe(Layer.provide(SessionStore.Default))
 *     .pipe(Layer.provide(myKeyValueStoreLayer))
 *
 * Or use the convenience layer:
 *   TierOrchestrator.Live(myKeyValueStoreLayer)
 */
TierOrchestrator.Default = Layer.effect(TierOrchestrator, makeTierOrchestrator)

/**
 * Convenience: compose TierOrchestrator + SessionStore + your KVS layer.
 */
export const makeTierOrchestratorLayer = (
  kvsLayer: Layer.Layer<KeyValueStore.KeyValueStore>,
) =>
  TierOrchestrator.Default.pipe(
    Layer.provide(SessionStore.Default),
    Layer.provide(kvsLayer),
  )
