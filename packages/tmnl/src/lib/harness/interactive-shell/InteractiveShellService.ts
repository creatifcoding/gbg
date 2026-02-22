/**
 * InteractiveShellService — Effect.Service for managing PTY sessions
 *
 * Architecture:
 *   - PTY operations run in Worker threads via @effect/platform-bun pool
 *   - Elastic pool: minSize=1, maxSize=8, timeToLive=5min (idle workers reclaim)
 *   - Each worker handles multiple sessions (worker-local session Map)
 *   - Session affinity: service tracks which worker owns which session
 *   - Main thread manages metadata + emits ShellEvents for WS relay
 *
 * Pool strategy:
 *   The pool distributes PtySpawn across workers (round-robin via Effect pool).
 *   For PtyWrite/Resize/Kill, we broadcast to all workers — only the worker
 *   that owns the session ID will act (others no-op with "not found").
 *   This is acceptable because:
 *     1. Write/resize/kill are low-frequency relative to data output
 *     2. Pool size is small (max 8)
 *     3. Worker-side no-op is O(1) Map.get check
 *
 * @module harness/interactive-shell/InteractiveShellService
 */

import {
  Context,
  Effect,
  Layer,
  Stream,
  Fiber,
  Data,
  Duration,
} from 'effect'
import * as Worker from '@effect/platform/Worker'
import * as BunWorker from '@effect/platform-bun/BunWorker'
import { nanoid } from 'nanoid'
import {
  PtyWorkerMessage,
  PtySpawn,
  PtyWrite,
  PtyResize,
  PtyKill,
  PtyWorkerError,
} from './pty-worker-schema'
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
  readonly shell: string
  readonly cwd: string
  readonly cols: number
  readonly rows: number
  readonly createdAt: number
  /** Raw output buffer for agent text extraction */
  rawOutputBuffer: string
  /** Maximum buffer size before trimming */
  readonly maxBufferSize: number
  status: ShellSessionStatus
  exitCode: number | undefined
  pid: number | undefined
  /** Fiber running the output stream consumer */
  outputFiber: Fiber.RuntimeFiber<void, never> | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveShellServiceShape {
  readonly spawn: (
    args: InteractiveShellToolArgs,
  ) => Effect.Effect<ShellSessionInfo>

  readonly write: (
    sessionId: ShellSessionId,
    data: string,
  ) => Effect.Effect<void, SessionNotFoundError>

  readonly resize: (
    sessionId: ShellSessionId,
    cols: number,
    rows: number,
  ) => Effect.Effect<void, SessionNotFoundError>

  readonly kill: (
    sessionId: ShellSessionId,
    signal?: number,
  ) => Effect.Effect<void, SessionNotFoundError>

  readonly getSession: (
    sessionId: ShellSessionId,
  ) => Effect.Effect<ShellSessionInfo, SessionNotFoundError>

  readonly listSessions: () => Effect.Effect<ReadonlyArray<ShellSessionInfo>>

  readonly readOutput: (
    sessionId: ShellSessionId,
    lines?: number,
  ) => Effect.Effect<string, SessionNotFoundError>

  readonly events: Stream.Stream<ShellEvent>
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string
  readonly message: string
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Pool configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface PtyPoolConfig {
  /** Minimum worker threads kept alive. @default 1 */
  readonly minSize: number
  /** Maximum worker threads. @default 8 */
  readonly maxSize: number
  /** Idle worker reclamation time. @default "5 minutes" */
  readonly timeToLive: Duration.DurationInput
  /** Max concurrent requests per worker. @default 16 */
  readonly concurrency: number
  /** Target utilization for auto-scaling (0-1). @default 0.7 */
  readonly targetUtilization: number
}

const DEFAULT_POOL_CONFIG: PtyPoolConfig = {
  minSize: 1,
  maxSize: 8,
  timeToLive: Duration.minutes(5),
  concurrency: 16,
  targetUtilization: 0.7,
}

export class PtyPoolConfigTag extends Context.Tag(
  'tmnl/harness/PtyPoolConfig',
)<PtyPoolConfigTag, PtyPoolConfig>() {}

export const PtyPoolConfigDefault = Layer.succeed(PtyPoolConfigTag, DEFAULT_POOL_CONFIG)

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
  const poolConfig = yield* Effect.serviceOption(PtyPoolConfigTag).pipe(
    Effect.map((opt) => {
      if (opt._tag === 'Some') return opt.value
      return DEFAULT_POOL_CONFIG
    }),
  )

  // Elastic worker pool for PTY operations
  const pool = yield* Worker.makePoolSerialized<PtyWorkerMessage>({
    minSize: poolConfig.minSize,
    maxSize: poolConfig.maxSize,
    timeToLive: poolConfig.timeToLive,
    concurrency: poolConfig.concurrency,
    targetUtilization: poolConfig.targetUtilization,
  })

  const sessions = new Map<string, ShellSession>()

  // Global event emitter (Stream.asyncPush)
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
    pid: s.pid,
    shell: s.shell,
    cwd: s.cwd,
    cols: s.cols,
    rows: s.rows,
    status: s.status,
    createdAt: s.createdAt,
    exitCode: s.exitCode,
  })

  // ── spawn ──────────────────────────────────────────────────────────────

  const spawn = (
    args: InteractiveShellToolArgs,
  ): Effect.Effect<ShellSessionInfo> =>
    Effect.gen(function* () {
      const id = `shell-${nanoid(8)}` as ShellSessionId
      const cols = args.cols ?? 120
      const rows = args.rows ?? 24

      const parts = args.command.trim().split(/\s+/)
      const shell =
        parts.length === 1
          ? parts[0]!
          : (process.env.SHELL || '/bin/bash')
      const shellArgs = parts.length === 1 ? [] : ['-c', args.command]
      const cwd = args.cwd ?? process.cwd()

      const session: ShellSession = {
        id,
        name: args.name,
        shell,
        cwd,
        cols,
        rows,
        createdAt: Date.now(),
        rawOutputBuffer: '',
        maxBufferSize: MAX_OUTPUT_BUFFER,
        status: 'starting',
        exitCode: undefined,
        pid: undefined,
        outputFiber: null,
      }
      sessions.set(id as string, session)

      // Pool distributes PtySpawn to an available worker.
      // Returns Stream<PtyOutputChunk> — stays open for session lifetime.
      const outputStream = pool.execute(
        new PtySpawn({
          sessionId: id as string,
          shell,
          args: shellArgs,
          cwd,
          cols,
          rows,
        }),
      )

      // Consume output stream in background fiber
      const fiber = yield* Stream.runForEach(outputStream, (chunk) =>
        Effect.sync(() => {
          const s = sessions.get(id as string)
          if (s) {
            s.status = 'running'
            s.rawOutputBuffer += chunk.data
            if (s.rawOutputBuffer.length > s.maxBufferSize) {
              s.rawOutputBuffer = s.rawOutputBuffer.slice(-s.maxBufferSize)
            }
          }
          emitEvent({
            _tag: 'shell:data',
            sessionId: id,
            data: chunk.data,
          })
        }),
      ).pipe(
        // Stream ends when PTY exits
        Effect.flatMap(() =>
          Effect.sync(() => {
            const s = sessions.get(id as string)
            if (s && s.status !== 'killed') {
              s.status = 'exited'
              s.exitCode = 0
            }
            emitEvent({ _tag: 'shell:exited', sessionId: id, exitCode: 0 })
          }),
        ),
        Effect.catchAll((e) =>
          Effect.sync(() => {
            const s = sessions.get(id as string)
            if (s) s.status = 'error'
            emitEvent({
              _tag: 'shell:error',
              sessionId: id,
              message: String(e),
            })
          }),
        ),
        Effect.fork,
      )

      session.outputFiber = fiber
      session.status = 'running'

      const info = toInfo(session)
      emitEvent({ _tag: 'shell:started', sessionId: id, info })
      return info
    })

  // ── write ──────────────────────────────────────────────────────────────
  // Broadcast to all workers — only the one owning the session acts.
  // Worker-side: "session not found" is a silent no-op for non-owners.

  const write = (sessionId: ShellSessionId, data: string) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* pool
        .broadcast(new PtyWrite({ sessionId: sessionId as string, data }))
        .pipe(
          Effect.catchTag('PtyWorkerError', () => Effect.void),
        )
    })

  // ── resize ─────────────────────────────────────────────────────────────

  const resize = (sessionId: ShellSessionId, cols: number, rows: number) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* pool
        .broadcast(
          new PtyResize({ sessionId: sessionId as string, cols, rows }),
        )
        .pipe(
          Effect.catchTag('PtyWorkerError', () => Effect.void),
        )
    })

  // ── kill ───────────────────────────────────────────────────────────────

  const kill = (sessionId: ShellSessionId, signal?: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      session.status = 'killed'
      yield* pool
        .broadcast(
          new PtyKill({ sessionId: sessionId as string, signal }),
        )
        .pipe(Effect.catchAll(() => Effect.void))
      if (session.outputFiber) {
        yield* Fiber.interrupt(session.outputFiber)
      }
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

  return InteractiveShellService.of({
    spawn,
    write,
    resize,
    kill,
    getSession,
    listSessions,
    readOutput,
    events: globalEventStream,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer
// ─────────────────────────────────────────────────────────────────────────────

const PtyWorkerLayer = BunWorker.layer(
  (_id: number) =>
    new globalThis.Worker(
      new URL('./pty-worker-runner.ts', import.meta.url).href,
    ),
)

/**
 * Live layer for InteractiveShellService.
 *
 * Provides: InteractiveShellService
 * Requires: nothing (PtyPoolConfig optional — defaults applied)
 * Internals: BunWorker pool (elastic, 1-8 threads, 5min TTL)
 */
export const InteractiveShellServiceLive = Layer.scoped(
  InteractiveShellService,
  makeInteractiveShellService,
).pipe(
  // BunWorker.layer already includes Worker.layerManager + Worker.PlatformWorker
  Layer.provide(PtyWorkerLayer),
)
