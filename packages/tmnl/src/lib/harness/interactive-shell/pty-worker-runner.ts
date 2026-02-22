/**
 * PTY Worker Runner — Runs in a dedicated Bun Worker thread.
 *
 * Handles PTY spawn/write/resize/kill requests via Schema.TaggedRequest.
 * Uses Bun.Terminal (native) for PTY operations — zero native addons.
 *
 * Launched by the main thread via BunWorker.layer.
 *
 * @module harness/interactive-shell/pty-worker-runner
 */

import { Effect, Layer, Stream } from 'effect'
import * as WorkerRunner from '@effect/platform/WorkerRunner'
import * as BunRunnerLayer from '@effect/platform-bun/BunWorkerRunner'
import {
  PtyWorkerMessage,
  PtyOutputChunk,
  PtyWorkerError,
} from './pty-worker-schema'

// ─────────────────────────────────────────────────────────────────────────────
// Session registry (worker-local)
// ─────────────────────────────────────────────────────────────────────────────

interface BunTerminal {
  write(data: string): void
  resize(cols: number, rows: number): void
  close(): void
  readonly closed: boolean
}

interface WorkerSession {
  proc: ReturnType<typeof Bun.spawn> & { terminal: BunTerminal }
  shell: string
}

const sessions = new Map<string, WorkerSession>()

/**
 * Decode Bun.Terminal data callback payload to UTF-8 string.
 *
 * Bun 1.3.9 sends a Node.js Buffer (extends Uint8Array).
 * TextDecoder is what Effect uses internally for binary→string
 * (Stream.decodeText, Encoding.decodeBase64String, CommandExecutor.string).
 */
const textDecoder = new TextDecoder('utf-8')

const decodeTerminalData = (data: unknown): string =>
  data instanceof Uint8Array
    ? textDecoder.decode(data)
    : typeof data === 'string'
      ? data
      : String(data)

// ─────────────────────────────────────────────────────────────────────────────
// Handler implementations
// ─────────────────────────────────────────────────────────────────────────────

const WorkerLive = WorkerRunner.layerSerialized(PtyWorkerMessage, {
  /**
   * PtySpawn → Stream<PtyOutputChunk>
   *
   * Spawns a PTY via Bun.Terminal, returns a stream of output chunks.
   * The stream stays open until the PTY process exits.
   */
  PtySpawn: (req) =>
    Stream.asyncPush<PtyOutputChunk, PtyWorkerError>((emit) =>
      Effect.gen(function* () {
        const env: Record<string, string> = {
          ...(process.env as Record<string, string>),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        }
        if (req.env) {
          Object.assign(env, req.env)
        }

        try {
          const proc = Bun.spawn([req.shell, ...req.args], {
            cwd: req.cwd,
            env,
            terminal: {
              cols: req.cols,
              rows: req.rows,
              data(_term: unknown, rawData: unknown) {
                const str = decodeTerminalData(rawData)
                emit.single(
                  new PtyOutputChunk({ sessionId: req.sessionId, data: str }),
                )
              },
            },
          })

          sessions.set(req.sessionId, { proc: proc as WorkerSession['proc'], shell: req.shell })

          // Watch for exit — end the stream
          void proc.exited.then((exitCode: number) => {
            sessions.delete(req.sessionId)
            emit.end()
          })
        } catch (e) {
          emit.fail(
            new PtyWorkerError({
              message: `PTY spawn failed: ${e instanceof Error ? e.message : String(e)}`,
              sessionId: req.sessionId,
            }),
          )
        }

        // Cleanup: kill the PTY when the stream scope closes
        return Effect.sync(() => {
          const session = sessions.get(req.sessionId)
          if (session) {
            try {
              session.proc.kill()
              if (!session.proc.terminal.closed) {
                session.proc.terminal.close()
              }
            } catch {
              // already dead
            }
            sessions.delete(req.sessionId)
          }
        })
      }),
    ),

  /**
   * PtyWrite → Effect<void>
   *
   * Broadcast-safe: silently succeeds if session not on this worker
   * (another worker in the pool owns it).
   */
  PtyWrite: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return // Not our session — no-op (broadcast pattern)
      try {
        session.proc.terminal.write(req.data)
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Write failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyResize → Effect<void>
   *
   * Broadcast-safe: silently succeeds if session not on this worker.
   */
  PtyResize: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return // Not our session — no-op (broadcast pattern)
      try {
        session.proc.terminal.resize(req.cols, req.rows)
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Resize failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyKill → Effect<void>
   *
   * Broadcast-safe: silently succeeds if session not on this worker.
   */
  PtyKill: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) return // Not our session — no-op (broadcast pattern)
      try {
        session.proc.kill(req.signal ?? 15)
        if (!session.proc.terminal.closed) {
          session.proc.terminal.close()
        }
      } catch {
        // already dead — not an error
      }
      sessions.delete(req.sessionId)
    }),
}).pipe(Layer.provide(BunRunnerLayer.layer))

// ─────────────────────────────────────────────────────────────────────────────
// Launch
// ─────────────────────────────────────────────────────────────────────────────

Effect.runFork(WorkerRunner.launch(WorkerLive))
