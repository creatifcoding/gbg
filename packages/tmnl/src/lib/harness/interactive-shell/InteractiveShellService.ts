/**
 * InteractiveShellService — Effect.Service for managing PTY sessions
 *
 * Architecture:
 *   - Sessions are scoped TerminalHandle instances from PtyBackend
 *   - Each session has an output Stream that's bridged to ShellEvent emissions
 *   - Agent reads plain text via stripVTControlCharacters from raw output buffer
 *   - TODO: Factor PTY spawn into Worker thread via @effect/platform-bun Worker
 *
 * State is managed via Atom.make() (Atom-as-State pattern per AGENTS.md).
 * React subscribes directly — no Ref→Atom bridge needed.
 *
 * @module harness/interactive-shell/InteractiveShellService
 */

import {
  Context,
  Effect,
  Layer,
  Scope,
  Stream,
  Fiber,
  Deferred,
  HashMap,
  Option,
  pipe,
} from 'effect'
import { nanoid } from 'nanoid'
import {
  TerminalBackend,
  type TerminalHandle,
  TerminalConnectError,
  TerminalWriteError,
  TerminalResizeError,
} from '@/lib/terminal/backend/TerminalBackend'
import { PtyBackendLive } from '@/lib/terminal/backend/PtyBackend'
import type {
  ShellSessionId,
  ShellSessionInfo,
  ShellSessionStatus,
  ShellEvent,
  InteractiveShellToolArgs,
} from './schemas'
import { stripVTControlCharacters } from 'node:util'

// ─────────────────────────────────────────────────────────────────────────────
// Internal session record
// ─────────────────────────────────────────────────────────────────────────────

interface ShellSession {
  readonly id: ShellSessionId
  readonly name: string | undefined
  readonly handle: TerminalHandle
  readonly scope: Scope.CloseableScope
  readonly createdAt: number
  /** Raw output buffer for agent text extraction */
  rawOutputBuffer: string
  /** Maximum buffer size before trimming */
  readonly maxBufferSize: number
  status: ShellSessionStatus
  exitCode: number | undefined
  /** Fiber running the output→event bridge */
  readonly outputFiber: Fiber.RuntimeFiber<void, never>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveShellServiceShape {
  /** Spawn a new PTY session. Returns session info. */
  readonly spawn: (
    args: InteractiveShellToolArgs,
  ) => Effect.Effect<ShellSessionInfo, TerminalConnectError>

  /** Write raw input to a session's PTY */
  readonly write: (
    sessionId: ShellSessionId,
    data: string,
  ) => Effect.Effect<void, TerminalWriteError | SessionNotFoundError>

  /** Resize a session's PTY */
  readonly resize: (
    sessionId: ShellSessionId,
    cols: number,
    rows: number,
  ) => Effect.Effect<void, TerminalResizeError | SessionNotFoundError>

  /** Kill a session */
  readonly kill: (
    sessionId: ShellSessionId,
    signal?: number,
  ) => Effect.Effect<void, SessionNotFoundError>

  /** Get session info */
  readonly getSession: (
    sessionId: ShellSessionId,
  ) => Effect.Effect<ShellSessionInfo, SessionNotFoundError>

  /** List all sessions */
  readonly listSessions: () => Effect.Effect<ReadonlyArray<ShellSessionInfo>>

  /**
   * Read plain text from session's output buffer.
   * Agent uses this to inspect terminal output without ANSI codes.
   * @param lines - Number of tail lines to return (default: all)
   */
  readonly readOutput: (
    sessionId: ShellSessionId,
    lines?: number,
  ) => Effect.Effect<string, SessionNotFoundError>

  /**
   * Subscribe to shell events (data, started, exited, error).
   * The returned stream emits ShellEvents for a specific session.
   */
  readonly subscribe: (
    sessionId: ShellSessionId,
  ) => Effect.Effect<Stream.Stream<ShellEvent>, SessionNotFoundError>

  /**
   * Global event stream — all shell events from all sessions.
   * Used by the WS relay to forward events to the client.
   */
  readonly events: Stream.Stream<ShellEvent>
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

import { Data } from 'effect'

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string
  readonly message: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class InteractiveShellService extends Context.Tag(
  'tmnl/harness/InteractiveShellService',
)<InteractiveShellService, InteractiveShellServiceShape>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const MAX_OUTPUT_BUFFER = 512 * 1024 // 512KB per session

const makeInteractiveShellService = Effect.gen(function* () {
  const backend = yield* TerminalBackend

  // Session registry — mutable map
  let sessions = new Map<string, ShellSession>()

  // Global event emitter via Stream.asyncPush
  type EmitFn = { single: (event: ShellEvent) => void; end: () => void }
  let globalEmit: EmitFn | null = null

  const globalEventStream = Stream.asyncPush<ShellEvent>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        globalEmit = { single: (e) => emit.single(e), end: () => emit.end() }
        return globalEmit
      }),
      () =>
        Effect.sync(() => {
          globalEmit = null
        }),
    ),
  )

  const emitEvent = (event: ShellEvent) => {
    globalEmit?.single(event)
  }

  const getSessionOrFail = (sessionId: ShellSessionId) => {
    const session = sessions.get(sessionId as string)
    if (!session) {
      return Effect.fail(
        new SessionNotFoundError({
          sessionId: sessionId as string,
          message: `Shell session '${sessionId}' not found`,
        }),
      )
    }
    return Effect.succeed(session)
  }

  const toInfo = (s: ShellSession): ShellSessionInfo => ({
    sessionId: s.id,
    name: s.name,
    pid: s.handle.pid,
    shell: 'bash', // Could track from spawn args
    cwd: process.cwd(),
    cols: s.handle.cols,
    rows: s.handle.rows,
    status: s.status,
    createdAt: s.createdAt,
    exitCode: s.exitCode,
  })

  // ── spawn ──────────────────────────────────────────────────────────────

  const spawn = (
    args: InteractiveShellToolArgs,
  ): Effect.Effect<ShellSessionInfo, TerminalConnectError> =>
    Effect.gen(function* () {
      const id = `shell-${nanoid(8)}` as ShellSessionId
      const cols = args.cols ?? 120
      const rows = args.rows ?? 24

      // Parse command into shell + args
      // If command looks like a path or single word, treat as shell
      // Otherwise wrap in bash -c
      const parts = args.command.trim().split(/\s+/)
      const shell = parts.length === 1 ? parts[0]! : (process.env.SHELL || '/bin/bash')
      const shellArgs = parts.length === 1 ? [] : ['-c', args.command]

      // Create a scope for this session's lifecycle
      const scope = yield* Scope.make()

      const handle = yield* backend
        .connect({
          _tag: 'PtyConfig',
          shell,
          args: shellArgs,
          cwd: args.cwd ?? process.cwd(),
          cols,
          rows,
          term: 'xterm-256color',
        })
        .pipe(Effect.provideService(Scope.Scope, scope))

      // Bridge output stream → global events + raw buffer
      const outputFiber = yield* Stream.runForEach(handle.output, (data) =>
        Effect.sync(() => {
          const session = sessions.get(id as string)
          if (session) {
            // Append to raw buffer (trim if too large)
            session.rawOutputBuffer += data
            if (session.rawOutputBuffer.length > session.maxBufferSize) {
              session.rawOutputBuffer = session.rawOutputBuffer.slice(
                -session.maxBufferSize,
              )
            }
          }

          emitEvent({
            _tag: 'shell:data',
            sessionId: id,
            data,
          })
        }),
      ).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.fork,
      )

      // Watch for exit
      yield* handle.exited.pipe(
        Effect.flatMap((exit) =>
          Effect.sync(() => {
            const session = sessions.get(id as string)
            if (session) {
              session.status = 'exited'
              session.exitCode = exit.exitCode
            }
            emitEvent({
              _tag: 'shell:exited',
              sessionId: id,
              exitCode: exit.exitCode,
              signal: typeof exit.signal === 'number' ? exit.signal : undefined,
            })
          }),
        ),
        Effect.fork,
      )

      const session: ShellSession = {
        id,
        name: args.name,
        handle,
        scope,
        createdAt: Date.now(),
        rawOutputBuffer: '',
        maxBufferSize: MAX_OUTPUT_BUFFER,
        status: 'running',
        exitCode: undefined,
        outputFiber,
      }

      sessions.set(id as string, session)

      const info = toInfo(session)

      emitEvent({
        _tag: 'shell:started',
        sessionId: id,
        info,
      })

      return info
    })

  // ── write ──────────────────────────────────────────────────────────────

  const write = (sessionId: ShellSessionId, data: string) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      yield* session.handle.write(data)
    })

  // ── resize ─────────────────────────────────────────────────────────────

  const resize = (sessionId: ShellSessionId, cols: number, rows: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      yield* session.handle.resize(cols, rows)
    })

  // ── kill ───────────────────────────────────────────────────────────────

  const kill = (sessionId: ShellSessionId, signal?: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      session.status = 'killed'
      yield* session.handle.close(signal?.toString())
      yield* Scope.close(session.scope, Effect.void)
      sessions.delete(sessionId as string)
    })

  // ── getSession ─────────────────────────────────────────────────────────

  const getSession = (sessionId: ShellSessionId) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      return toInfo(session)
    })

  // ── listSessions ───────────────────────────────────────────────────────

  const listSessions = () =>
    Effect.succeed([...sessions.values()].map(toInfo))

  // ── readOutput ─────────────────────────────────────────────────────────

  const readOutput = (sessionId: ShellSessionId, lines?: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      const plain = stripVTControlCharacters(session.rawOutputBuffer)
      if (lines === undefined) return plain
      const allLines = plain.split('\n')
      return allLines.slice(-lines).join('\n')
    })

  // ── subscribe (per-session filtered stream) ────────────────────────────

  const subscribe = (sessionId: ShellSessionId) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId) // validate exists
      return pipe(
        globalEventStream,
        Stream.filter((e) => {
          if ('sessionId' in e) return (e as any).sessionId === sessionId
          return false
        }),
      )
    })

  return InteractiveShellService.of({
    spawn,
    write,
    resize,
    kill,
    getSession,
    listSessions,
    readOutput,
    subscribe,
    events: globalEventStream,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellServiceLive = Layer.effect(
  InteractiveShellService,
  makeInteractiveShellService,
).pipe(Layer.provide(PtyBackendLive))
