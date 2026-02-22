/**
 * InteractiveShellService — Effect.Service for managing PTY sessions
 *
 * Architecture:
 *   - PTY operations run in a dedicated Worker thread via @effect/platform-bun
 *   - Worker communicates via Schema.TaggedRequest (typed RPC)
 *   - Main thread manages session state + emits ShellEvents
 *   - Agent reads plain text via stripVTControlCharacters from raw output buffer
 *
 * Worker thread boundary:
 *   Main thread                      Worker thread
 *   ───────────                      ─────────────
 *   PtySpawn (TaggedRequest)    →    Bun.spawn({ terminal })
 *   PtyWrite                    →    proc.terminal.write()
 *   PtyResize                   →    proc.terminal.resize()
 *   PtyKill                     →    proc.kill()
 *   ← Stream<PtyOutputChunk>        data callback → emit
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
  Data,
  pipe,
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
  type PtyOutputChunk,
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
  // Create a serialized worker for PTY operations
  const worker = yield* Worker.makeSerialized<PtyWorkerMessage>({ size: 1 })

  const sessions = new Map<string, ShellSession>()

  // Global event emitter
  type EmitFn = { single: (event: ShellEvent) => void; end: () => void }
  let globalEmit: EmitFn | null = null

  const globalEventStream = Stream.asyncPush<ShellEvent>((emit) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        globalEmit = { single: (e) => emit.single(e), end: () => emit.end() }
        return globalEmit
      }),
      () => Effect.sync(() => { globalEmit = null }),
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
      const shell = parts.length === 1 ? parts[0]! : (process.env.SHELL || '/bin/bash')
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

      // Send PtySpawn to worker — returns a Stream<PtyOutputChunk>
      const outputStream = worker.execute(
        new PtySpawn({
          sessionId: id as string,
          shell,
          args: shellArgs,
          cwd,
          cols,
          rows,
        }),
      )

      // Consume the output stream in a background fiber
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
              s.exitCode = 0 // Worker doesn't provide exit code in stream yet
            }
            emitEvent({
              _tag: 'shell:exited',
              sessionId: id,
              exitCode: 0,
            })
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

  const write = (sessionId: ShellSessionId, data: string) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* worker.executeEffect(
        new PtyWrite({ sessionId: sessionId as string, data }),
      )
    })

  // ── resize ─────────────────────────────────────────────────────────────

  const resize = (sessionId: ShellSessionId, cols: number, rows: number) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* worker.executeEffect(
        new PtyResize({ sessionId: sessionId as string, cols, rows }),
      )
    })

  // ── kill ───────────────────────────────────────────────────────────────

  const kill = (sessionId: ShellSessionId, signal?: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      session.status = 'killed'
      yield* worker.executeEffect(
        new PtyKill({ sessionId: sessionId as string, signal }),
      ).pipe(Effect.catchAll(() => Effect.void))
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
// Layer (provides BunWorker for PTY worker thread)
// ─────────────────────────────────────────────────────────────────────────────

const PtyWorkerLayer = BunWorker.layer(
  (_id: number) =>
    new globalThis.Worker(
      new URL('./pty-worker-runner.ts', import.meta.url).href,
    ),
)

export const InteractiveShellServiceLive = Layer.scoped(
  InteractiveShellService,
  makeInteractiveShellService,
).pipe(
  Layer.provide(PtyWorkerLayer),
  Layer.provide(Worker.layerManager),
)
