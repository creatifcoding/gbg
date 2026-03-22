/**
 * TerminalSessionManager — Multi-session terminal orchestration
 *
 * Backend-agnostic session management. Works with any TerminalBackend
 * (PTY, SSH, etc.) via Layer.provide.
 *
 * Usage:
 * ```typescript
 * // Compose with PTY backend
 * const PtySessionLayer = TerminalSessionManagerLive.pipe(
 *   Layer.provide(PtyBackendLive)
 * )
 *
 * // Compose with SSH backend
 * const SshSessionLayer = TerminalSessionManagerLive.pipe(
 *   Layer.provide(SshBackendLive)
 * )
 * ```
 */

import { Context, Effect, Layer, Ref, HashMap, Option, Scope } from 'effect'
import {
  TerminalBackend,
  type TerminalHandle,
  TerminalConnectError,
} from './TerminalBackend'
import type { TerminalConfig, TerminalSessionInfo, SessionStatus, BackendType } from './schemas'
import { nanoid } from 'nanoid'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ManagedSession {
  readonly id: string
  readonly handle: TerminalHandle
  readonly scope: Scope.CloseableScope
  readonly config: TerminalConfig
  readonly createdAt: Date
  readonly backend: BackendType
  status: SessionStatus
}

export interface TerminalSessionManagerShape {
  /** Create a new terminal session */
  readonly createSession: (
    config: TerminalConfig
  ) => Effect.Effect<TerminalSessionInfo, TerminalConnectError>

  /** Get session by ID */
  readonly getSession: (id: string) => Effect.Effect<Option.Option<ManagedSession>>

  /** Get session handle for I/O */
  readonly getHandle: (id: string) => Effect.Effect<Option.Option<TerminalHandle>>

  /** List all active sessions */
  readonly listSessions: () => Effect.Effect<ReadonlyArray<TerminalSessionInfo>>

  /** Destroy a session */
  readonly destroySession: (id: string) => Effect.Effect<boolean>

  /** Destroy all sessions */
  readonly destroyAll: () => Effect.Effect<void>

  /** Get backend type */
  readonly backendType: BackendType
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class TerminalSessionManager extends Context.Tag('tmnl/terminal/TerminalSessionManager')<
  TerminalSessionManager,
  TerminalSessionManagerShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const makeTerminalSessionManager = Effect.gen(function* () {
  const backend = yield* TerminalBackend
  const sessionsRef = yield* Ref.make(HashMap.empty<string, ManagedSession>())

  const toSessionInfo = (session: ManagedSession): TerminalSessionInfo => ({
    id: session.id,
    backend: session.backend,
    status: session.status,
    cols: session.handle.cols,
    rows: session.handle.rows,
    createdAt: session.createdAt,
    // PTY-specific
    pid: session.handle.pid,
    shell: 'shell' in session.config ? (session.config as any).shell : undefined,
    // SSH-specific
    host: 'host' in session.config ? (session.config as any).host : undefined,
    username: 'username' in session.config ? (session.config as any).username : undefined,
  })

  const createSession = (
    config: TerminalConfig
  ): Effect.Effect<TerminalSessionInfo, TerminalConnectError> =>
    Effect.gen(function* () {
      const id = nanoid(12)
      const createdAt = new Date()

      // Create a closeable scope for this session
      const scope = yield* Scope.make()

      // Connect via backend within the session scope
      const handle = yield* backend.connect(config).pipe(Scope.extend(scope))

      const session: ManagedSession = {
        id,
        handle,
        scope,
        config,
        createdAt,
        backend: backend.type,
        status: 'ready',
      }

      // Track exit
      Effect.runFork(
        Effect.gen(function* () {
          yield* handle.exited
          yield* Ref.update(sessionsRef, (map) => {
            const existing = HashMap.get(map, id)
            if (Option.isSome(existing)) {
              existing.value.status = 'disconnected'
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

  const getHandle = (id: string): Effect.Effect<Option.Option<TerminalHandle>> =>
    getSession(id).pipe(Effect.map(Option.map((s) => s.handle)))

  const listSessions = (): Effect.Effect<ReadonlyArray<TerminalSessionInfo>> =>
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

      // Close scope (triggers cleanup via finalizers)
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
    backendType: backend.type,
  } satisfies TerminalSessionManagerShape
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TerminalSessionManagerLive requires a TerminalBackend.
 * Compose with Layer.provide:
 *
 * ```typescript
 * const PtySessionLayer = TerminalSessionManagerLive.pipe(
 *   Layer.provide(PtyBackendLive)
 * )
 * ```
 */
export const TerminalSessionManagerLive = Layer.effect(
  TerminalSessionManager,
  makeTerminalSessionManager
)
