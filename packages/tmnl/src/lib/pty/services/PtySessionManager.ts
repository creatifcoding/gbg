/**
 * PtySessionManager — Multi-session PTY orchestration
 *
 * Manages PTY session lifecycle:
 * - Create/destroy sessions
 * - Track active sessions
 * - Route messages to correct session
 */

import { Context, Effect, Layer, Ref, HashMap, Option, Scope } from 'effect'
import { PtyBackend, type PtyHandle, PtySpawnError } from './PtyBackend'
import type { PtyConfig, SessionInfo, SessionStatus } from '../schemas'
import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ManagedSession {
  readonly id: string
  readonly handle: PtyHandle
  readonly scope: Scope.CloseableScope
  readonly config: PtyConfig
  readonly createdAt: Date
  status: SessionStatus
  exitCode?: number
}

export interface PtySessionManagerShape {
  /** Create a new PTY session */
  readonly createSession: (config?: PtyConfig) => Effect.Effect<SessionInfo, PtySpawnError>

  /** Get session by ID */
  readonly getSession: (id: string) => Effect.Effect<Option.Option<ManagedSession>>

  /** Get session handle for I/O */
  readonly getHandle: (id: string) => Effect.Effect<Option.Option<PtyHandle>>

  /** List all active sessions */
  readonly listSessions: () => Effect.Effect<ReadonlyArray<SessionInfo>>

  /** Destroy a session */
  readonly destroySession: (id: string) => Effect.Effect<boolean>

  /** Destroy all sessions */
  readonly destroyAll: () => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class PtySessionManager extends Context.Tag('tmnl/pty/PtySessionManager')<
  PtySessionManager,
  PtySessionManagerShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const makePtySessionManager = Effect.gen(function* () {
  const backend = yield* PtyBackend
  const sessionsRef = yield* Ref.make(HashMap.empty<string, ManagedSession>())

  const toSessionInfo = (session: ManagedSession): SessionInfo => ({
    id: session.id,
    pid: session.handle.pid,
    status: session.status,
    cols: session.handle.cols,
    rows: session.handle.rows,
    shell: session.config.shell ?? 'bash',
    createdAt: session.createdAt,
    exitCode: session.exitCode,
  })

  const createSession = (config: PtyConfig = {}): Effect.Effect<SessionInfo, PtySpawnError> =>
    Effect.gen(function* () {
      const id = nanoid(12)
      const createdAt = new Date()

      // Create a closeable scope for this session
      const scope = yield* Scope.make()

      // Spawn PTY within the session scope
      const handle = yield* backend.spawn(config).pipe(Scope.extend(scope))

      const session: ManagedSession = {
        id,
        handle,
        scope,
        config,
        createdAt,
        status: 'running',
      }

      // Track exit
      Effect.runFork(
        Effect.gen(function* () {
          const exit = yield* handle.exited
          yield* Ref.update(sessionsRef, (map) => {
            const existing = HashMap.get(map, id)
            if (Option.isSome(existing)) {
              existing.value.status = 'exited'
              existing.value.exitCode = exit.exitCode
            }
            return map
          })
        })
      )

      // Store session
      yield* Ref.update(sessionsRef, HashMap.set(id, session))

      return toSessionInfo(session)
    })

  const getSession = (id: string): Effect.Effect<Option.Option<ManagedSession>> =>
    Ref.get(sessionsRef).pipe(Effect.map((map) => HashMap.get(map, id)))

  const getHandle = (id: string): Effect.Effect<Option.Option<PtyHandle>> =>
    getSession(id).pipe(Effect.map(Option.map((s) => s.handle)))

  const listSessions = (): Effect.Effect<ReadonlyArray<SessionInfo>> =>
    Ref.get(sessionsRef).pipe(
      Effect.map((map) => Array.from(HashMap.values(map)).map(toSessionInfo))
    )

  const destroySession = (id: string): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const sessions = yield* Ref.get(sessionsRef)
      const session = HashMap.get(sessions, id)

      if (Option.isNone(session)) {
        return false
      }

      // Close scope (triggers PTY cleanup)
      yield* Scope.close(session.value.scope, Effect.void)

      // Remove from map
      yield* Ref.update(sessionsRef, HashMap.remove(id))

      return true
    })

  const destroyAll = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      const sessions = yield* Ref.get(sessionsRef)

      yield* Effect.forEach(
        HashMap.values(sessions),
        (session) => Scope.close(session.scope, Effect.void),
        { concurrency: 'unbounded' }
      )

      yield* Ref.set(sessionsRef, HashMap.empty())
    })

  return {
    createSession,
    getSession,
    getHandle,
    listSessions,
    destroySession,
    destroyAll,
  } satisfies PtySessionManagerShape
})

export const PtySessionManagerLive = Layer.effect(PtySessionManager, makePtySessionManager)
