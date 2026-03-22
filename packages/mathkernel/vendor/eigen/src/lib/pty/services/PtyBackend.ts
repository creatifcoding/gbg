/**
 * PtyBackend — Abstract PTY interface as Effect.Service
 *
 * This is the swappable layer. Current impl: @zenyr/bun-pty
 * Future: Bun.Terminal (v1.3.5+)
 *
 * The backend handles raw PTY operations. Session management
 * is handled by PtySessionManager which uses this service.
 */

import { Context, Effect, Layer, Stream, Scope } from 'effect'
import type { PtyConfig } from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PtyHandle {
  readonly pid: number
  readonly cols: number
  readonly rows: number
  readonly process: string

  /** Write data to PTY stdin */
  readonly write: (data: string) => Effect.Effect<void>

  /** Resize PTY */
  readonly resize: (cols: number, rows: number) => Effect.Effect<void>

  /** Kill PTY process */
  readonly kill: (signal?: string) => Effect.Effect<void>

  /** Stream of data from PTY stdout */
  readonly output: Stream.Stream<string>

  /** Effect that completes when PTY exits */
  readonly exited: Effect.Effect<{ exitCode: number; signal?: number | string }>
}

export interface PtyBackendShape {
  /**
   * Spawn a new PTY process
   * Returns a scoped PtyHandle that auto-cleans on scope close
   */
  readonly spawn: (config: PtyConfig) => Effect.Effect<PtyHandle, PtySpawnError, Scope.Scope>
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class PtySpawnError extends Error {
  readonly _tag = 'PtySpawnError'
  constructor(
    readonly reason: 'SpawnFailed' | 'InvalidConfig' | 'BackendError',
    readonly cause?: unknown
  ) {
    super(`PTY spawn failed: ${reason}`)
    this.name = 'PtySpawnError'
  }
}

export class PtyWriteError extends Error {
  readonly _tag = 'PtyWriteError'
  constructor(readonly cause?: unknown) {
    super('PTY write failed')
    this.name = 'PtyWriteError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class PtyBackend extends Context.Tag('tmnl/pty/PtyBackend')<
  PtyBackend,
  PtyBackendShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// bun-pty Implementation
// ─────────────────────────────────────────────────────────────────────────────

import { spawn as bunPtySpawn } from '@zenyr/bun-pty'
import * as Deferred from 'effect/Deferred'

const makeBunPtyBackend = Effect.gen(function* () {
  const spawn = (config: PtyConfig): Effect.Effect<PtyHandle, PtySpawnError, Scope.Scope> =>
    Effect.gen(function* () {
      const shell = config.shell ?? (process.platform === 'win32' ? 'powershell.exe' : 'bash')
      const args = config.args ?? []
      const cols = config.cols ?? 80
      const rows = config.rows ?? 24

      // Spawn PTY
      const pty = yield* Effect.try({
        try: () =>
          bunPtySpawn(shell, args, {
            name: config.name ?? 'xterm-256color',
            cols,
            rows,
            cwd: config.cwd,
            env: config.env as Record<string, string> | undefined,
          }),
        catch: (e) => new PtySpawnError('SpawnFailed', e),
      })

      const exitDeferred = yield* Deferred.make<{ exitCode: number; signal?: number | string }>()

      // Create output stream using Stream.asyncPush - designed for external push-based sources
      const outputStream = Stream.asyncPush<string>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            // Register onData callback - push data into the stream
            const dataDisposable = pty.onData((data) => {
              emit.single(data)
            })

            // Register onExit callback
            const exitDisposable = pty.onExit((event) => {
              Effect.runSync(
                Deferred.succeed(exitDeferred, {
                  exitCode: event.exitCode,
                  signal: event.signal,
                })
              )
              emit.end()
            })

            return { dataDisposable, exitDisposable }
          }),
          ({ dataDisposable, exitDisposable }) =>
            Effect.sync(() => {
              dataDisposable.dispose()
              exitDisposable.dispose()
            })
        )
      )

      // Register PTY cleanup on scope finalization
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          try {
            pty.kill()
          } catch {
            // Already dead, ignore
          }
        })
      )

      // Build handle
      const handle: PtyHandle = {
        pid: pty.pid,
        cols: pty.cols,
        rows: pty.rows,
        process: pty.process,

        write: (data: string) =>
          Effect.sync(() => {
            pty.write(data)
          }),

        resize: (cols: number, rows: number) =>
          Effect.sync(() => {
            pty.resize(cols, rows)
          }),

        kill: (signal?: string) =>
          Effect.sync(() => {
            pty.kill(signal)
          }),

        output: outputStream,

        exited: Deferred.await(exitDeferred),
      }

      return handle
    })

  return { spawn } satisfies PtyBackendShape
})

export const BunPtyBackendLive = Layer.effect(PtyBackend, makeBunPtyBackend)

// ─────────────────────────────────────────────────────────────────────────────
// Future: Bun.Terminal Implementation (v1.3.5+)
// ─────────────────────────────────────────────────────────────────────────────

// export const BunTerminalBackendLive = Layer.effect(PtyBackend, makeBunTerminalBackend)
// Swap via: Layer.provide(BunTerminalBackendLive) instead of BunPtyBackendLive
