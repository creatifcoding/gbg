/**
 * ActorPersistence
 *
 * SQLite WASM-based persistence layer for actor state.
 * Replaces RivetKit with pure Effect-based persistence.
 *
 * @module lib/actors/services/ActorPersistence
 */

import { Context, Effect, Layer, Schema } from 'effect'
import { SqliteClient } from '@effect/sql-sqlite-wasm'
import * as SqlClient from '@effect/sql/SqlClient'
import { Reactivity } from '@effect/experimental'
import {
  type WorkspaceState,
  type SessionState,
  type UserId,
  WorkspaceState as WorkspaceStateSchema,
  SessionState as SessionStateSchema,
} from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface ActorPersistenceShape {
  /** Initialize the database schema */
  readonly initialize: Effect.Effect<void>

  /** Load workspace state */
  readonly loadWorkspace: Effect.Effect<WorkspaceState | null>

  /** Save workspace state */
  readonly saveWorkspace: (state: WorkspaceState) => Effect.Effect<void>

  /** Load session state for a user */
  readonly loadSession: (userId: UserId) => Effect.Effect<SessionState | null>

  /** Save session state for a user */
  readonly saveSession: (userId: UserId, state: SessionState) => Effect.Effect<void>

  /** Clear all persisted state */
  readonly clear: Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class ActorPersistence extends Context.Tag('ActorPersistence')<
  ActorPersistence,
  ActorPersistenceShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const WORKSPACE_KEY = 'workspace:default'

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const initialize: ActorPersistenceShape['initialize'] = Effect.gen(function* () {
    // Create key-value store table for actor state
    yield* sql`
      CREATE TABLE IF NOT EXISTS actor_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `
    yield* Effect.logDebug('[ActorPersistence] Database initialized')
  })

  const loadWorkspace: ActorPersistenceShape['loadWorkspace'] = Effect.gen(function* () {
    const result = yield* sql`
      SELECT value FROM actor_state WHERE key = ${WORKSPACE_KEY}
    `

    if (result.length === 0) {
      return null
    }

    const raw = result[0] as { value: string }
    const parsed = JSON.parse(raw.value)

    // Validate with Effect Schema
    return yield* Schema.decodeUnknown(WorkspaceStateSchema)(parsed)
  }).pipe(
    Effect.catchAll((error) => {
      Effect.logWarning('[ActorPersistence] Failed to load workspace', error)
      return Effect.succeed(null)
    })
  )

  const saveWorkspace: ActorPersistenceShape['saveWorkspace'] = (state) =>
    Effect.gen(function* () {
      // Validate before saving
      const validated = yield* Schema.encode(WorkspaceStateSchema)(state)
      const json = JSON.stringify(validated)

      yield* sql`
        INSERT INTO actor_state (key, value, updated_at)
        VALUES (${WORKSPACE_KEY}, ${json}, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = ${json},
          updated_at = datetime('now')
      `
    })

  const loadSession: ActorPersistenceShape['loadSession'] = (userId) =>
    Effect.gen(function* () {
      const key = `session:${userId}`
      const result = yield* sql`
        SELECT value FROM actor_state WHERE key = ${key}
      `

      if (result.length === 0) {
        return null
      }

      const raw = result[0] as { value: string }
      const parsed = JSON.parse(raw.value)

      // Validate with Effect Schema
      return yield* Schema.decodeUnknown(SessionStateSchema)(parsed)
    }).pipe(
      Effect.catchAll((error) => {
        Effect.logWarning('[ActorPersistence] Failed to load session', error)
        return Effect.succeed(null)
      })
    )

  const saveSession: ActorPersistenceShape['saveSession'] = (userId, state) =>
    Effect.gen(function* () {
      const key = `session:${userId}`
      // Validate before saving
      const validated = yield* Schema.encode(SessionStateSchema)(state)
      const json = JSON.stringify(validated)

      yield* sql`
        INSERT INTO actor_state (key, value, updated_at)
        VALUES (${key}, ${json}, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = ${json},
          updated_at = datetime('now')
      `
    })

  const clear: ActorPersistenceShape['clear'] = Effect.gen(function* () {
    yield* sql`DELETE FROM actor_state`
    yield* Effect.logDebug('[ActorPersistence] State cleared')
  })

  return ActorPersistence.of({
    initialize,
    loadWorkspace,
    saveWorkspace,
    loadSession,
    saveSession,
    clear,
  })
})

// =============================================================================
// Layers
// =============================================================================

/** Reactivity layer required by SQLite WASM */
const ReactivityLive = Reactivity.layer

/** SQLite WASM layer for in-memory persistence */
export const SqliteLive = Layer.scoped(
  SqlClient.SqlClient,
  SqliteClient.makeMemory({})
).pipe(Layer.provide(ReactivityLive))

/** ActorPersistence layer (requires SqlClient) */
export const ActorPersistenceLive = Layer.effect(ActorPersistence, make)

/** Full persistence layer with SQLite WASM */
export const ActorPersistenceLayer = ActorPersistenceLive.pipe(Layer.provide(SqliteLive))
