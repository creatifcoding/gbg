/**
 * Session Store — DI-able Persistence Service
 *
 * Effect.Service wrapping KeyValueStore with session-specific operations.
 * The backing store is whatever Layer satisfies KeyValueStore:
 *   - layerMemory (tests)
 *   - BrowserKeyValueStore.layerLocalStorage (warm tier)
 *   - Custom IndexedDB or SQLite layer (cold tier)
 *
 * Two logical stores:
 *   - Tree store: full SessionTree keyed by session ID
 *   - Metadata store: lightweight SessionMetadata for listing
 *
 * Uses Schema.parseJson for type-safe encode/decode.
 * All operations are best-effort — errors caught gracefully.
 *
 * @module harness/session/v2/session-store
 */

import { Context, Effect, Layer, Option, Schema } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { SessionTree } from './tree'
import { SessionMetadata } from './metadata'
import { treeToJson, jsonToTree, extractMetadata } from './serialization'
import type { HarnessSessionId } from './identity'

// =============================================================================
// Key format
// =============================================================================

const TREE_PREFIX = 'session:tree:'
const META_PREFIX = 'session:meta:'
const META_INDEX_KEY = 'session:meta:__index__'

const treeKey = (id: string) => `${TREE_PREFIX}${id}`
const metaKey = (id: string) => `${META_PREFIX}${id}`

// =============================================================================
// Schema codecs
// =============================================================================

const encodeMeta = Schema.encode(Schema.parseJson(SessionMetadata))
const decodeMeta = Schema.decode(Schema.parseJson(SessionMetadata))

const encodeIndex = Schema.encode(
  Schema.parseJson(Schema.Array(Schema.String)),
)
const decodeIndex = Schema.decode(
  Schema.parseJson(Schema.Array(Schema.String)),
)

// =============================================================================
// SessionStore — the service interface
// =============================================================================

/**
 * Session persistence operations.
 *
 * Consumer code never knows if backing store is IndexedDB, SQLite,
 * localStorage, or memory. That's decided by the Layer you provide.
 */
export interface SessionStoreOps {
  // -- Tree operations -------------------------------------------------------

  /** Save a full session tree. Also updates metadata. */
  readonly saveTree: (
    tree: SessionTree,
  ) => Effect.Effect<void>

  /** Load a full session tree by ID. Returns None if not found. */
  readonly loadTree: (
    id: HarnessSessionId,
  ) => Effect.Effect<Option.Option<SessionTree>>

  /** Delete a session tree and its metadata. */
  readonly deleteTree: (
    id: HarnessSessionId,
  ) => Effect.Effect<void>

  /** Check if a session tree exists. */
  readonly hasTree: (
    id: HarnessSessionId,
  ) => Effect.Effect<boolean>

  // -- Metadata operations ---------------------------------------------------

  /** Save metadata for a session (without full tree). */
  readonly saveMeta: (
    meta: SessionMetadata,
  ) => Effect.Effect<void>

  /** Load metadata for a session. Returns None if not found. */
  readonly loadMeta: (
    id: HarnessSessionId,
  ) => Effect.Effect<Option.Option<SessionMetadata>>

  /** List all session metadata (lightweight index). */
  readonly listMeta: () => Effect.Effect<ReadonlyArray<SessionMetadata>>

  /** Delete metadata for a session. */
  readonly deleteMeta: (
    id: HarnessSessionId,
  ) => Effect.Effect<void>

  // -- Bulk operations -------------------------------------------------------

  /** List all stored session IDs. */
  readonly listIds: () => Effect.Effect<ReadonlyArray<string>>

  /** Clear all sessions from store. */
  readonly clearAll: () => Effect.Effect<void>
}

// =============================================================================
// Service tag
// =============================================================================

export class SessionStore extends Context.Tag('tmnl/session/SessionStore')<
  SessionStore,
  SessionStoreOps
>() {}

// =============================================================================
// Implementation — backed by KeyValueStore
// =============================================================================

const makeSessionStore = Effect.gen(function* () {
  const kv = yield* KeyValueStore.KeyValueStore

  // -- Index management (tracks known session IDs) ---------------------------

  const readIndex = (): Effect.Effect<string[]> =>
    Effect.gen(function* () {
      const raw = yield* kv.get(META_INDEX_KEY).pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<string>())),
      )
      if (Option.isNone(raw)) return []
      return yield* decodeIndex(raw.value).pipe(
        Effect.catchAll(() => Effect.succeed([] as string[])),
      )
    })

  const writeIndex = (ids: string[]): Effect.Effect<void> =>
    Effect.gen(function* () {
      const encoded = yield* encodeIndex(ids).pipe(
        Effect.catchAll(() => Effect.succeed('[]')),
      )
      yield* kv.set(META_INDEX_KEY, encoded).pipe(
        Effect.catchAll(() => Effect.void),
      )
    })

  const addToIndex = (id: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      const ids = yield* readIndex()
      if (!ids.includes(id)) {
        yield* writeIndex([...ids, id])
      }
    })

  const removeFromIndex = (id: string): Effect.Effect<void> =>
    Effect.gen(function* () {
      const ids = yield* readIndex()
      yield* writeIndex(ids.filter((x) => x !== id))
    })

  // -- Tree ops --------------------------------------------------------------

  const saveTree: SessionStoreOps['saveTree'] = (tree) =>
    Effect.gen(function* () {
      const json = yield* treeToJson(tree)
      yield* kv.set(treeKey(tree.header.id), json).pipe(
        Effect.catchAll(() => Effect.void),
      )
      // Also update metadata
      const meta = extractMetadata(tree)
      yield* saveMeta(meta as SessionMetadata)
    })

  const loadTree: SessionStoreOps['loadTree'] = (id) =>
    Effect.gen(function* () {
      const raw = yield* kv.get(treeKey(id)).pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<string>())),
      )
      if (Option.isNone(raw)) return Option.none<SessionTree>()
      const tree = yield* jsonToTree(raw.value).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      return tree ? Option.some(tree) : Option.none<SessionTree>()
    })

  const deleteTree: SessionStoreOps['deleteTree'] = (id) =>
    Effect.gen(function* () {
      yield* kv.remove(treeKey(id)).pipe(
        Effect.catchAll(() => Effect.void),
      )
      yield* deleteMeta(id)
    })

  const hasTree: SessionStoreOps['hasTree'] = (id) =>
    kv.has(treeKey(id)).pipe(
      Effect.catchAll(() => Effect.succeed(false)),
    )

  // -- Meta ops --------------------------------------------------------------

  const saveMeta: SessionStoreOps['saveMeta'] = (meta) =>
    Effect.gen(function* () {
      const encoded = yield* encodeMeta(meta).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      if (encoded) {
        yield* kv.set(metaKey(meta.id), encoded).pipe(
          Effect.catchAll(() => Effect.void),
        )
        yield* addToIndex(meta.id)
      }
    })

  const loadMeta: SessionStoreOps['loadMeta'] = (id) =>
    Effect.gen(function* () {
      const raw = yield* kv.get(metaKey(id)).pipe(
        Effect.catchAll(() => Effect.succeed(Option.none<string>())),
      )
      if (Option.isNone(raw)) return Option.none<SessionMetadata>()
      const meta = yield* decodeMeta(raw.value).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      )
      return meta ? Option.some(meta) : Option.none<SessionMetadata>()
    })

  const listMeta: SessionStoreOps['listMeta'] = () =>
    Effect.gen(function* () {
      const ids = yield* readIndex()
      const metas: SessionMetadata[] = []
      for (const id of ids) {
        const meta = yield* loadMeta(id as HarnessSessionId)
        if (Option.isSome(meta)) {
          metas.push(meta.value)
        }
      }
      return metas
    })

  const deleteMeta: SessionStoreOps['deleteMeta'] = (id) =>
    Effect.gen(function* () {
      yield* kv.remove(metaKey(id)).pipe(
        Effect.catchAll(() => Effect.void),
      )
      yield* removeFromIndex(id)
    })

  // -- Bulk ops --------------------------------------------------------------

  const listIds: SessionStoreOps['listIds'] = () => readIndex()

  const clearAll: SessionStoreOps['clearAll'] = () =>
    kv.clear.pipe(Effect.catchAll(() => Effect.void))

  return {
    saveTree,
    loadTree,
    deleteTree,
    hasTree,
    saveMeta,
    loadMeta,
    listMeta,
    deleteMeta,
    listIds,
    clearAll,
  } satisfies SessionStoreOps
})

// =============================================================================
// Layers — swap the backing store
// =============================================================================

/**
 * SessionStore backed by whatever KeyValueStore is in the environment.
 *
 * Usage:
 *   // In-memory (tests)
 *   SessionStore.Default.pipe(Layer.provide(KeyValueStore.layerMemory))
 *
 *   // localStorage (warm tier)
 *   SessionStore.Default.pipe(Layer.provide(BrowserKeyValueStore.layerLocalStorage))
 *
 *   // Custom SQLite (cold tier)
 *   SessionStore.Default.pipe(Layer.provide(mySqliteKeyValueStoreLayer))
 */
SessionStore.Default = Layer.effect(SessionStore, makeSessionStore)

// Re-export for convenience
export { KeyValueStore }
