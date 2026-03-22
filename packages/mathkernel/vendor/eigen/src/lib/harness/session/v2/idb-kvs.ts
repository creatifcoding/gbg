/**
 * IndexedDB KeyValueStore Layer — cold-tier persistence for session v2.
 *
 * Wraps idb-keyval (1.3kB, battle-tested) into an @effect/platform
 * KeyValueStore implementation. All operations are Effect.tryPromise
 * for structured error handling.
 *
 * Usage:
 *   import { layerIndexedDB } from './idb-kvs'
 *   SessionStore.Default.pipe(Layer.provide(layerIndexedDB))
 *
 * @module harness/session/v2/idb-kvs
 */

import { Effect, Layer, Option } from 'effect'
import { KeyValueStore } from '@effect/platform'
import { SystemError } from '@effect/platform/Error'
import {
  createStore,
  get as idbGet,
  set as idbSet,
  del as idbDel,
  keys as idbKeys,
  clear as idbClear,
  type UseStore,
} from 'idb-keyval'

// =============================================================================
// Store instance — scoped to session v2 data
// =============================================================================

const DB_NAME = 'tmnl-session-v2'
const STORE_NAME = 'sessions'

let _store: UseStore | null = null

function getStore(): UseStore {
  if (!_store) {
    _store = createStore(DB_NAME, STORE_NAME)
  }
  return _store
}

// =============================================================================
// Error helper
// =============================================================================

const idbError = (method: string, cause: unknown) =>
  SystemError({
    reason: 'Unknown',
    module: 'KeyValueStore',
    method,
    pathOrDescriptor: `indexeddb://${DB_NAME}/${STORE_NAME}`,
    message: cause instanceof Error ? cause.message : String(cause),
  })

// =============================================================================
// KeyValueStore implementation via make()
// =============================================================================

const makeIndexedDBKeyValueStore: KeyValueStore.KeyValueStore = KeyValueStore.make({
  get: (key: string) =>
    Effect.tryPromise({
      try: () => idbGet<string>(key, getStore()),
      catch: (e) => idbError('get', e),
    }).pipe(
      Effect.map((value) =>
        value !== undefined ? Option.some(value) : Option.none<string>(),
      ),
    ),

  getUint8Array: (key: string) =>
    Effect.tryPromise({
      try: () => idbGet<Uint8Array>(key, getStore()),
      catch: (e) => idbError('getUint8Array', e),
    }).pipe(
      Effect.map((value) =>
        value !== undefined ? Option.some(value) : Option.none<Uint8Array>(),
      ),
    ),

  set: (key: string, value: string | Uint8Array) =>
    Effect.tryPromise({
      try: () => idbSet(key, value, getStore()),
      catch: (e) => idbError('set', e),
    }),

  remove: (key: string) =>
    Effect.tryPromise({
      try: () => idbDel(key, getStore()),
      catch: (e) => idbError('remove', e),
    }),

  has: (key: string) =>
    Effect.tryPromise({
      try: async () => {
        const val = await idbGet<string>(key, getStore())
        return val !== undefined
      },
      catch: (e) => idbError('has', e),
    }),

  clear: Effect.tryPromise({
    try: () => idbClear(getStore()),
    catch: (e) => idbError('clear', e),
  }),

  size: Effect.tryPromise({
    try: async () => {
      const allKeys = await idbKeys(getStore())
      return allKeys.length
    },
    catch: (e) => idbError('size', e),
  }),
})

// =============================================================================
// Layer export
// =============================================================================

/**
 * KeyValueStore Layer backed by IndexedDB.
 *
 * Uses idb-keyval with a dedicated `tmnl-session-v2` database.
 * Suitable for cold-tier session persistence (survives browser restarts).
 *
 * @example
 * ```ts
 * import { layerIndexedDB } from './idb-kvs'
 * import { SessionStore } from './session-store'
 *
 * const coldStoreLayer = SessionStore.Default.pipe(
 *   Layer.provide(layerIndexedDB),
 * )
 * ```
 */
export const layerIndexedDB = Layer.succeed(
  KeyValueStore.KeyValueStore,
  makeIndexedDBKeyValueStore,
)
