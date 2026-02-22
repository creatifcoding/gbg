/**
 * PtyBackend — Local PTY terminal backend using Bun.Terminal (native)
 *
 * Implements TerminalBackend using Bun's built-in Bun.Terminal API (added in Bun 1.3.5).
 * Zero native addon dependencies — no node-pty, no @zenyr/bun-pty, no node-gyp.
 *
 * Bun.Terminal spawns a real pseudo-terminal (PTY) with proper cols/rows,
 * TERM env, and bidirectional data flow via the `data` callback and `write()`.
 *
 * @module terminal/backend/PtyBackend
 */

import { Effect, Layer, Stream, Scope, Deferred } from 'effect'
import { nanoid } from 'nanoid'
import {
  TerminalBackend,
  type TerminalBackendShape,
  type TerminalHandle,
  type TerminalExit,
  TerminalConnectError,
  TerminalWriteError,
  TerminalResizeError,
} from './TerminalBackend'
import { PtyConfig } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Default shell detection
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

// ─────────────────────────────────────────────────────────────────────────────
// PTY Backend Implementation (Bun.Terminal)
// ─────────────────────────────────────────────────────────────────────────────

const makePtyBackend = Effect.gen(function* () {
  const connect = (config: typeof PtyConfig.Type): Effect.Effect<
    TerminalHandle,
    TerminalConnectError,
    Scope.Scope
  > =>
    Effect.gen(function* () {
      const id = nanoid(12)
      const shell = config.shell ?? getDefaultShell()
      const args = config.args ?? []
      const cols = config.cols ?? 80
      const rows = config.rows ?? 24

      // Create exit deferred
      const exitDeferred = yield* Deferred.make<TerminalExit>()

      // Build environment
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        TERM: config.term ?? 'xterm-256color',
        COLORTERM: 'truecolor',
      }
      if (config.env) {
        Object.assign(env, config.env)
      }

      // Create output stream using Stream.asyncPush
      // The data callback from Bun.Terminal will push into this stream
      let emitFn: ((data: string) => void) | null = null
      let endFn: (() => void) | null = null

      const outputStream = Stream.asyncPush<string>((emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            emitFn = (data: string) => emit.single(data)
            endFn = () => emit.end()
            return { emitFn, endFn }
          }),
          () =>
            Effect.sync(() => {
              emitFn = null
              endFn = null
            }),
        ),
      )

      // Spawn with Bun.Terminal
      const proc = yield* Effect.try({
        try: () =>
          Bun.spawn([shell, ...args], {
            cwd: config.cwd ?? process.cwd(),
            env,
            terminal: {
              cols,
              rows,
              data(_term: unknown, data: string) {
                emitFn?.(data)
              },
            },
          }),
        catch: (e) =>
          new TerminalConnectError({
            reason: 'BackendError',
            message: `Failed to spawn PTY: ${e instanceof Error ? e.message : String(e)}`,
            cause: e,
          }),
      })

      // Watch for exit in background
      void proc.exited.then((exitCode: number) => {
        Effect.runSync(
          Deferred.succeed(exitDeferred, {
            exitCode,
            reason: 'exit' as const,
          }),
        )
        endFn?.()
      })

      // Register cleanup on scope finalization
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          try {
            proc.kill()
          } catch {
            // Already dead
          }
          try {
            proc.terminal?.close()
          } catch {
            // Already closed
          }
        }),
      )

      // Build handle
      const handle: TerminalHandle = {
        id,
        backend: 'pty',
        cols,
        rows,
        pid: proc.pid,

        write: (data: string) =>
          Effect.try({
            try: () => {
              proc.terminal!.write(data)
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
              proc.terminal!.resize(newCols, newRows)
            },
            catch: (e) =>
              new TerminalResizeError({
                message: 'Failed to resize PTY',
                cause: e,
              }),
          }),

        close: (signal?: string) =>
          Effect.sync(() => {
            try {
              proc.kill(signal ? (parseInt(signal) || 9) : undefined)
            } catch {
              // Already dead
            }
          }),

        output: outputStream,

        exited: Deferred.await(exitDeferred),
      }

      return handle
    })

  return {
    connect: (config) => {
      // Validate config is PTY type
      if (!('host' in config)) {
        return connect(config as typeof PtyConfig.Type)
      }
      return Effect.fail(
        new TerminalConnectError({
          reason: 'InvalidConfig',
          message: 'Expected PtyConfig but received SshConfig',
        }),
      )
    },
    type: 'pty' as const,
  } satisfies TerminalBackendShape
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

export const PtyBackendLive = Layer.effect(TerminalBackend, makePtyBackend)
