/**
 * InteractiveShellService — Effect.Service for managing PTY sessions
 *
 * Architecture:
 *   - PTY operations run in a single Worker thread via @effect/platform-bun
 *   - Single worker handles all sessions (worker-local session Map)
 *   - Every request (spawn, write, kill, dumpScreen) goes to the same worker
 *   - No routing/affinity complexity — 95% of usage is 1-2 sessions
 *   - Main thread manages metadata + raw output buffer + emits ShellEvents
 *   - readRawOutput served from main-thread buffer (no worker RPC needed)
 *
 * Why single worker, not pool:
 *   xterm-headless parsing is ~1μs/char. A single worker handles 10+
 *   concurrent sessions without meaningful latency. The elastic pool
 *   introduced routing complexity (round-robin has no session affinity)
 *   that broke dumpScreen/readRawOutput for the 95% case. Pool can be
 *   revisited if multi-agent workloads demand it.
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
  PtyDumpScreen,
  PtyWorkerError,
  PtyScreenDumpResult,
  PtyRawOutputResult,
  type ScreenDumpMode,
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
// Query rate limiter (per-session, prevents excessive readOutput/dumpScreen)
// ─────────────────────────────────────────────────────────────────────────────

const queryTimestamps = new Map<string, number>()
const MIN_QUERY_INTERVAL_MS = 1000 // 1 second between reads per session

/**
 * Check if a query is allowed for this session.
 * Returns remaining wait time in ms, or 0 if allowed.
 */
export function checkQueryRate(sessionId: string): number {
  const now = Date.now()
  const last = queryTimestamps.get(sessionId) ?? 0
  const elapsed = now - last
  if (elapsed >= MIN_QUERY_INTERVAL_MS) {
    queryTimestamps.set(sessionId, now)
    return 0
  }
  return MIN_QUERY_INTERVAL_MS - elapsed
}

// ─────────────────────────────────────────────────────────────────────────────
// Session slug generation (petname-style: adjective-noun)
// ─────────────────────────────────────────────────────────────────────────────

const ADJECTIVES = [
  'calm', 'bold', 'wild', 'dark', 'warm', 'cool', 'keen', 'pale', 'soft', 'deep',
  'fast', 'slim', 'rare', 'pure', 'wise', 'blue', 'gold', 'iron', 'gray', 'jade',
] as const
const NOUNS = [
  'reef', 'peak', 'vale', 'cove', 'dusk', 'dawn', 'tide', 'mist', 'gale', 'bark',
  'pine', 'wolf', 'hawk', 'lynx', 'fox', 'orca', 'moth', 'fern', 'moss', 'sage',
] as const

function generateSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}-${noun}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal session record
// ─────────────────────────────────────────────────────────────────────────────

interface ShellSession {
  readonly id: ShellSessionId
  readonly name: string | undefined
  readonly slug: string
  readonly shell: string
  readonly cwd: string
  readonly cols: number
  readonly rows: number
  readonly createdAt: number
  /** Raw output buffer for agent text extraction */
  rawOutputBuffer: string
  /** Maximum buffer size before trimming */
  readonly maxBufferSize: number
  /** Position of last incremental read (for drain mode) */
  lastReadPosition: number
  status: ShellSessionStatus
  exitCode: number | undefined
  pid: number | undefined
  /** Fiber running the output stream consumer */
  outputFiber: Fiber.RuntimeFiber<void, never> | null
  /** Whether the session is running in the background (no overlay) */
  background: boolean
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

  /** Move session to background (headless, no overlay) */
  readonly backgroundSession: (
    sessionId: ShellSessionId,
  ) => Effect.Effect<void, SessionNotFoundError>

  /** Bring session to foreground (reattach overlay) */
  readonly foregroundSession: (
    sessionId: ShellSessionId,
  ) => Effect.Effect<ShellSessionInfo, SessionNotFoundError>

  /** List background sessions only */
  readonly listBackgroundSessions: () => Effect.Effect<ReadonlyArray<ShellSessionInfo>>

  /** Legacy simple read — returns stripped plain text (last N lines) */
  readonly readOutput: (
    sessionId: ShellSessionId,
    lines?: number,
  ) => Effect.Effect<string, SessionNotFoundError>

  /** Rendered screen dump from xterm-headless buffer */
  readonly dumpScreen: (
    sessionId: ShellSessionId,
    options?: {
      mode?: ScreenDumpMode
      lines?: number
      offset?: number
      maxChars?: number
      ansi?: boolean
    },
  ) => Effect.Effect<PtyScreenDumpResult, SessionNotFoundError>

  /** Raw output with pagination + incremental/drain support */
  readonly readRawOutput: (
    sessionId: ShellSessionId,
    options?: {
      drain?: boolean
      offset?: number
      limit?: number
      stripAnsi?: boolean
    },
  ) => Effect.Effect<PtyRawOutputResult, SessionNotFoundError>

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
// (Pool config removed — single worker architecture, no config needed)
// ─────────────────────────────────────────────────────────────────────────────

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
  // Single worker thread for all PTY operations.
  // All sessions live on this one worker — no affinity routing needed.
  const worker = yield* Worker.makeSerialized<PtyWorkerMessage>()

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
    name: s.name ?? s.slug,
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
        slug: generateSlug(),
        shell,
        cwd,
        cols,
        rows,
        createdAt: Date.now(),
        rawOutputBuffer: '',
        maxBufferSize: MAX_OUTPUT_BUFFER,
        lastReadPosition: 0,
        status: 'starting',
        exitCode: undefined,
        pid: undefined,
        outputFiber: null,
        background: false,
      }
      sessions.set(id as string, session)

      // Single worker handles all sessions.
      // Returns Stream<PtyOutputChunk> — stays open for session lifetime.
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

  const write = (sessionId: ShellSessionId, data: string) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* worker
        .executeEffect(new PtyWrite({ sessionId: sessionId as string, data }))
        .pipe(
          Effect.catchTag('PtyWorkerError', () => Effect.void),
        )
    })

  // ── resize ─────────────────────────────────────────────────────────────

  const resize = (sessionId: ShellSessionId, cols: number, rows: number) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)
      yield* worker
        .executeEffect(
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
      yield* worker
        .executeEffect(
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

  // ── background / foreground ──────────────────────────────────────────────

  const backgroundSession = (sessionId: ShellSessionId) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      session.background = true
      emitEvent({ _tag: 'shell:data', sessionId, data: '' }) // trigger re-render
    })

  const foregroundSession = (sessionId: ShellSessionId) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      session.background = false
      return toInfo(session)
    })

  const listBackgroundSessions = () =>
    Effect.succeed(
      [...sessions.values()]
        .filter((s) => s.background)
        .map(toInfo),
    )

  // ── readOutput (legacy — simple stripped text) ──────────────────────────

  const readOutput = (sessionId: ShellSessionId, lines?: number) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)
      const plain = stripVTControlCharacters(session.rawOutputBuffer)
      if (lines === undefined) return plain
      const allLines = plain.split('\n')
      return allLines.slice(-lines).join('\n')
    })

  // ── dumpScreen (xterm-headless rendered buffer via worker) ────────────

  const dumpScreen = (
    sessionId: ShellSessionId,
    options?: {
      mode?: ScreenDumpMode
      lines?: number
      offset?: number
      maxChars?: number
      ansi?: boolean
    },
  ) =>
    Effect.gen(function* () {
      yield* getSessionOrFail(sessionId)

      const result = yield* worker
        .executeEffect(
          new PtyDumpScreen({
            sessionId: sessionId as string,
            mode: options?.mode ?? 'viewport',
            lines: options?.lines,
            offset: options?.offset,
            maxChars: options?.maxChars,
            ansi: options?.ansi,
          }),
        )
        .pipe(
          Effect.catchTag('PtyWorkerError', (e) =>
            Effect.fail(
              new SessionNotFoundError({
                sessionId: sessionId as string,
                message: e.message,
              }),
            ),
          ),
        )

      return result
    })

  // ── readRawOutput (paginated raw buffer — served from service-side buffer) ─
  //
  // Served from the main-thread rawOutputBuffer (populated by the output
  // stream consumer). No worker RPC needed — avoids serialization overhead
  // and is always up-to-date.

  const readRawOutput = (
    sessionId: ShellSessionId,
    options?: {
      drain?: boolean
      offset?: number
      limit?: number
      stripAnsi?: boolean
    },
  ) =>
    Effect.gen(function* () {
      const session = yield* getSessionOrFail(sessionId)

      let text = session.rawOutputBuffer
      const shouldStripAnsi = options?.stripAnsi !== false

      // Incremental / drain mode — return only new output since last read
      if (options?.drain) {
        text = session.rawOutputBuffer.substring(session.lastReadPosition)
        session.lastReadPosition = session.rawOutputBuffer.length
      }

      if (shouldStripAnsi && text) {
        text = stripVTControlCharacters(text)
      }

      if (!text) {
        return new PtyRawOutputResult({
          text: '',
          totalLines: 0,
          totalChars: 0,
          sliceLineCount: 0,
        })
      }

      // Normalize and split
      const normalized = text.replace(/\r\n/g, '\n')
      const lines = normalized.split('\n')
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop()
      }

      const totalLines = lines.length
      const totalChars = text.length

      // Apply offset/limit
      let start: number
      if (typeof options?.offset === 'number' && Number.isFinite(options.offset)) {
        start = Math.max(0, Math.floor(options.offset))
      } else if (options?.limit !== undefined) {
        // No offset but limit → return tail
        const tailCount = Math.max(0, Math.floor(options.limit))
        start = Math.max(totalLines - tailCount, 0)
      } else {
        start = 0
      }

      const end =
        options?.limit !== undefined
          ? Math.min(start + Math.floor(options.limit), totalLines)
          : totalLines

      const sliceLines = lines.slice(start, end)
      const resultText = sliceLines.join('\n')

      return new PtyRawOutputResult({
        text: resultText,
        totalLines,
        totalChars,
        sliceLineCount: sliceLines.length,
      })
    })

  return InteractiveShellService.of({
    spawn,
    write,
    resize,
    kill,
    getSession,
    listSessions,
    backgroundSession,
    foregroundSession,
    listBackgroundSessions,
    readOutput,
    dumpScreen,
    readRawOutput,
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
 * Requires: nothing
 * Internals: Single BunWorker thread for all PTY operations
 */
export const InteractiveShellServiceLive = Layer.scoped(
  InteractiveShellService,
  makeInteractiveShellService,
).pipe(
  // BunWorker.layer already includes Worker.layerManager + Worker.PlatformWorker
  Layer.provide(PtyWorkerLayer),
)
