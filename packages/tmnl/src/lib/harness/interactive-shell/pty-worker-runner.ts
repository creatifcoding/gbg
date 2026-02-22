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

interface WorkerSession {
  proc: ReturnType<typeof Bun.spawn>
  shell: string
}

const sessions = new Map<string, WorkerSession>()

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
              data(_term: unknown, data: string) {
                emit.single(
                  new PtyOutputChunk({ sessionId: req.sessionId, data }),
                )
              },
            },
          })

          sessions.set(req.sessionId, { proc, shell: req.shell })

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
              session.proc.terminal?.close()
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
   */
  PtyWrite: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) {
        return yield* new PtyWorkerError({
          message: `Session ${req.sessionId} not found`,
          sessionId: req.sessionId,
        })
      }
      try {
        session.proc.terminal!.write(req.data)
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Write failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyResize → Effect<void>
   */
  PtyResize: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) {
        return yield* new PtyWorkerError({
          message: `Session ${req.sessionId} not found`,
          sessionId: req.sessionId,
        })
      }
      try {
        session.proc.terminal!.resize(req.cols, req.rows)
      } catch (e) {
        return yield* new PtyWorkerError({
          message: `Resize failed: ${e instanceof Error ? e.message : String(e)}`,
          sessionId: req.sessionId,
        })
      }
    }),

  /**
   * PtyKill → Effect<void>
   */
  PtyKill: (req) =>
    Effect.gen(function* () {
      const session = sessions.get(req.sessionId)
      if (!session) {
        return yield* new PtyWorkerError({
          message: `Session ${req.sessionId} not found`,
          sessionId: req.sessionId,
        })
      }
      try {
        session.proc.kill(req.signal ?? 15)
        session.proc.terminal?.close()
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
