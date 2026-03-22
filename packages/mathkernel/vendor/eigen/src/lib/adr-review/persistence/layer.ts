/**
 * ADR Review Persistence Layer
 *
 * Browser-compatible SQLite using @effect/sql-sqlite-wasm.
 * Persists to IndexedDB for durability across page reloads.
 */
import { SqliteClient } from '@effect/sql-sqlite-wasm'
import { SqlClient } from '@effect/sql'
import { Context, Effect, Layer } from 'effect'
import { Reactivity } from '@effect/experimental'

import { runMigrations } from './migrations'
import { AllRepositoriesLive, ReviewCommentRepo, UnitReviewRepo } from './repositories'

// =============================================================================
// IndexedDB Helpers
// =============================================================================

const IDB_NAME = 'tmnl-adr-review'
const IDB_STORE = 'database'
const IDB_KEY = 'sqlite-snapshot'

/**
 * Open IndexedDB database.
 */
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
  })
}

/**
 * Load SQLite snapshot from IndexedDB.
 */
async function loadSnapshot(): Promise<Uint8Array | null> {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const request = store.get(IDB_KEY)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    })
  } catch (e) {
    console.warn('[adr-review] Failed to load snapshot from IndexedDB:', e)
    return null
  }
}

/**
 * Save SQLite snapshot to IndexedDB.
 */
async function saveSnapshot(data: Uint8Array): Promise<void> {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      const store = tx.objectStore(IDB_STORE)
      const request = store.put(data, IDB_KEY)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch (e) {
    console.error('[adr-review] Failed to save snapshot to IndexedDB:', e)
  }
}

// =============================================================================
// Persistence Service (for triggering saves)
// =============================================================================

export interface ADRPersistenceService {
  /**
   * Save current database state to IndexedDB.
   */
  readonly save: Effect.Effect<void>
}

export class ADRPersistence extends Context.Tag('tmnl/adr-review/ADRPersistence')<
  ADRPersistence,
  ADRPersistenceService
>() {}

// =============================================================================
// SQLite Client Layer
// =============================================================================

/** Reactivity layer required by SQLite WASM */
const ReactivityLive = Reactivity.layer

/**
 * Browser-compatible SQLite client using WASM.
 * Loads from IndexedDB on startup, saves on demand.
 */
export const SqliteClientLive = Layer.scoped(
  SqlClient.SqlClient,
  Effect.gen(function* () {
    yield* Effect.logInfo('[adr-review] Initializing WASM SQLite...')

    // Create in-memory SQLite client
    const client = yield* SqliteClient.makeMemory({})
    yield* Effect.logInfo('[adr-review] WASM SQLite client created')

    // Try to load existing snapshot from IndexedDB
    const snapshot = yield* Effect.promise(() => loadSnapshot())
    if (snapshot) {
      yield* Effect.logInfo(`[adr-review] Loading database from IndexedDB snapshot (${snapshot.byteLength} bytes)...`)
      yield* client.import(snapshot)
      yield* Effect.logInfo('[adr-review] Snapshot imported successfully')
    } else {
      yield* Effect.logInfo('[adr-review] No existing snapshot, starting fresh')
    }

    return client
  })
).pipe(Layer.provide(ReactivityLive))

/**
 * Layer that provides save functionality.
 */
export const ADRPersistenceLive = Layer.effect(
  ADRPersistence,
  Effect.gen(function* () {
    yield* Effect.logInfo('[adr-review] Creating ADRPersistence service...')
    const sql = yield* SqlClient.SqlClient

    // Type assertion needed because SqlClient interface doesn't expose export
    const client = sql as SqliteClient.SqliteClient
    yield* Effect.logInfo('[adr-review] ADRPersistence service ready')

    return {
      save: Effect.gen(function* () {
        yield* Effect.logInfo('[adr-review] Exporting database snapshot...')
        const snapshot = yield* client.export
        yield* Effect.logInfo(`[adr-review] Snapshot size: ${snapshot.byteLength} bytes`)
        yield* Effect.promise(() => saveSnapshot(snapshot))
        yield* Effect.logInfo('[adr-review] Database saved to IndexedDB')
      }),
    }
  })
)

/**
 * In-memory SQLite client for testing (no IndexedDB).
 */
export const SqliteClientTest = Layer.scoped(
  SqlClient.SqlClient,
  SqliteClient.makeMemory({})
)

// =============================================================================
// Combined Persistence Layer
// =============================================================================

/**
 * Complete ADR review persistence layer.
 * Includes WASM SQLite client, all repositories, migrations, and save service.
 */
export const ADRReviewPersistenceLive = AllRepositoriesLive.pipe(
  Layer.provideMerge(ADRPersistenceLive),
  Layer.tap(() => runMigrations),
  Layer.tap(() => Effect.logInfo('[adr-review] Persistence layer ready')),
  Layer.provide(SqliteClientLive)
)

/**
 * Test persistence layer with in-memory database.
 */
export const ADRReviewPersistenceTest = AllRepositoriesLive.pipe(
  Layer.tap(() => runMigrations),
  Layer.provide(SqliteClientTest)
)

// =============================================================================
// Exports
// =============================================================================

export { ReviewCommentRepo, UnitReviewRepo } from './repositories'
export { UnitReviewModel, ReviewCommentModel, ReviewStatus } from './models'
