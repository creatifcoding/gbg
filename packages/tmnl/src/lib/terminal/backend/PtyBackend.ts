/**
 * PtyBackend — Local PTY terminal backend using bun-pty
 *
 * Implements TerminalBackend using @zenyr/bun-pty.
 * Spawns local shell processes with full PTY support.
 */

import { Effect, Layer, Stream, Scope, Deferred } from 'effect'
import { spawn as bunPtySpawn } from '@zenyr/bun-pty'
import { nanoid } from 'nanoid'
import {
  TerminalBackend,
  type TerminalBackendShape,
  type TerminalHandle,
  type TerminalExit,
  TerminalConnectError,
  TerminalWriteError,
  TerminalResizeError,
  TerminalStreamError,
} from './TerminalBackend'
import { PtyConfig } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// PTY Backend Implementation
// ─────────────────────────────────────────────────────────────────────────────

const makePtyBackend = Effect.gen(function* () {
  const connect = (config: typeof PtyConfig.Type): Effect.Effect<
    TerminalHandle,
    TerminalConnectError,
    Scope.Scope
  > =>
    Effect.gen(function* () {
      const id = nanoid(12)
      const shell = config.shell ?? (process.platform === 'win32' ? 'powershell.exe' : 'bash')
      const args = config.args ?? []
      const cols = config.cols ?? 80
      const rows = config.rows ?? 24

      // Spawn PTY
      const pty = yield* Effect.try({
        try: () =>
          bunPtySpawn(shell, args, {
            name: config.term ?? 'xterm-256color',
            cols,
            rows,
            cwd: config.cwd,
            env: config.env as Record<string, string> | undefined,
          }),
        catch: (e) =>
          new TerminalConnectError({
            reason: 'BackendError',
            message: `Failed to spawn PTY: ${e instanceof Error ? e.message : String(e)}`,
            cause: e,
          }),
      })

      // Create deferred for exit tracking
      const exitDeferred = yield* Deferred.make<TerminalExit>()

      // Create output stream using Stream.asyncPush
      const outputStream = Stream.asyncPush<string, TerminalStreamError>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            // Register onData callback
            const dataDisposable = pty.onData((data) => {
              emit.single(data)
            })

            // Register onExit callback
            const exitDisposable = pty.onExit((event) => {
              Effect.runSync(
                Deferred.succeed(exitDeferred, {
                  exitCode: event.exitCode,
                  signal: event.signal,
                  reason: 'exit' as const,
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

      // Register cleanup on scope finalization
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
      const handle: TerminalHandle = {
        id,
        backend: 'pty',
        cols: pty.cols,
        rows: pty.rows,
        pid: pty.pid,

        write: (data: string) =>
          Effect.try({
            try: () => {
              pty.write(data)
            },
            catch: (e) =>
              new TerminalWriteError({
                message: 'Failed to write to PTY',
                cause: e,
              }),
          }),

        resize: (newCols: number, newRows: number) =>
          Effect.try({
            try: () => {
              pty.resize(newCols, newRows)
            },
            catch: (e) =>
              new TerminalResizeError({
                message: 'Failed to resize PTY',
                cause: e,
              }),
          }),

        close: (signal?: string) =>
          Effect.sync(() => {
            pty.kill(signal)
          }),

        output: outputStream,

        exited: Deferred.await(exitDeferred),
      }

      return handle
    })

  return {
    connect: (config) => {
      // Validate config is PTY type (or treat as default PTY if no _tag)
      if (!('host' in config)) {
        return connect(config as typeof PtyConfig.Type)
      }
      return Effect.fail(
        new TerminalConnectError({
          reason: 'InvalidConfig',
          message: 'Expected PtyConfig but received SshConfig',
        })
      )
    },
    type: 'pty' as const,
  } satisfies TerminalBackendShape
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

export const PtyBackendLive = Layer.effect(TerminalBackend, makePtyBackend)
