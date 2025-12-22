/**
 * SshBackend — SSH terminal backend using ssh2
 *
 * Implements TerminalBackend using the ssh2 library.
 * Provides full SSH functionality: shell, resize, keepalive.
 */

import { Context, Effect, Layer, Stream, Scope, Deferred } from 'effect'
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2'
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
import { SshConfig, type SshAuthMethod } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// SSH Backend Implementation
// ─────────────────────────────────────────────────────────────────────────────

const makeSshBackend = Effect.gen(function* () {
  const connect = (config: typeof SshConfig.Type): Effect.Effect<
    TerminalHandle,
    TerminalConnectError,
    Scope.Scope
  > =>
    Effect.gen(function* () {
      const id = nanoid(12)
      const cols = config.cols ?? 80
      const rows = config.rows ?? 24

      // Build ssh2 connection config
      const connectConfig = buildConnectConfig(config)

      // Create SSH client
      const client = new Client()

      // Create deferred for exit tracking
      const exitDeferred = yield* Deferred.make<TerminalExit>()

      // Connect to SSH server
      const channel = yield* Effect.async<ClientChannel, TerminalConnectError>((resume) => {
        let resolved = false

        const cleanup = () => {
          client.removeAllListeners()
        }

        client.on('ready', () => {
          // Request interactive shell with PTY
          client.shell(
            {
              cols,
              rows,
              term: config.term ?? 'xterm-256color',
            },
            (err, stream) => {
              if (resolved) return
              resolved = true

              if (err) {
                cleanup()
                resume(
                  Effect.fail(
                    new TerminalConnectError({
                      reason: 'ConnectionFailed',
                      message: `Failed to open shell: ${err.message}`,
                      cause: err,
                    })
                  )
                )
                return
              }

              resume(Effect.succeed(stream))
            }
          )
        })

        client.on('error', (err) => {
          if (resolved) return
          resolved = true
          cleanup()

          const reason = err.message.includes('auth')
            ? 'AuthFailed'
            : err.message.includes('timeout')
              ? 'Timeout'
              : 'ConnectionFailed'

          resume(
            Effect.fail(
              new TerminalConnectError({
                reason,
                message: err.message,
                cause: err,
              })
            )
          )
        })

        client.on('timeout', () => {
          if (resolved) return
          resolved = true
          cleanup()
          resume(
            Effect.fail(
              new TerminalConnectError({
                reason: 'Timeout',
                message: 'SSH connection timed out',
              })
            )
          )
        })

        // Initiate connection
        client.connect(connectConfig)
      })

      // Wire up channel close to exit deferred
      channel.on('close', () => {
        Effect.runSync(
          Deferred.succeed(exitDeferred, {
            exitCode: 0,
            reason: 'disconnect' as const,
          })
        )
      })

      channel.on('exit', (code: number, signal?: string) => {
        Effect.runSync(
          Deferred.succeed(exitDeferred, {
            exitCode: code ?? 0,
            signal,
            reason: 'exit' as const,
          })
        )
      })

      // Create output stream using Stream.async
      const outputStream = Stream.async<string, TerminalStreamError>((emit) => {
        channel.on('data', (data: Buffer) => {
          emit.single(data.toString('utf-8'))
        })

        channel.stderr.on('data', (data: Buffer) => {
          // Merge stderr into stdout stream
          emit.single(data.toString('utf-8'))
        })

        channel.on('close', () => {
          emit.end()
        })

        channel.on('error', (err: Error) => {
          emit.fail(
            new TerminalStreamError({
              message: err.message,
              cause: err,
            })
          )
        })
      })

      // Register cleanup on scope finalization
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          try {
            channel.close()
            client.end()
          } catch {
            // Already closed, ignore
          }
        })
      )

      // Track current dimensions (mutable for resize)
      let currentCols = cols
      let currentRows = rows

      // Build handle
      const handle: TerminalHandle = {
        id,
        backend: 'ssh',
        cols: currentCols,
        rows: currentRows,
        pid: undefined, // SSH doesn't expose remote PID

        write: (data: string) =>
          Effect.try({
            try: () => {
              channel.write(data)
            },
            catch: (e) =>
              new TerminalWriteError({
                message: 'Failed to write to SSH channel',
                cause: e,
              }),
          }),

        resize: (newCols: number, newRows: number) =>
          Effect.try({
            try: () => {
              channel.setWindow(newRows, newCols, 480, 640)
              currentCols = newCols
              currentRows = newRows
            },
            catch: (e) =>
              new TerminalResizeError({
                message: 'Failed to resize SSH channel',
                cause: e,
              }),
          }),

        close: () =>
          Effect.sync(() => {
            channel.close()
            client.end()
          }),

        output: outputStream,

        exited: Deferred.await(exitDeferred),
      }

      return handle
    })

  return {
    connect: (config) => {
      // Validate config is SSH type
      if ('host' in config && 'username' in config) {
        return connect(config as typeof SshConfig.Type)
      }
      return Effect.fail(
        new TerminalConnectError({
          reason: 'InvalidConfig',
          message: 'Expected SshConfig but received different config type',
        })
      )
    },
    type: 'ssh' as const,
  } satisfies TerminalBackendShape
})

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build ssh2 ConnectConfig from our SshConfig
// ─────────────────────────────────────────────────────────────────────────────

function buildConnectConfig(config: typeof SshConfig.Type): ConnectConfig {
  const base: ConnectConfig = {
    host: config.host,
    port: config.port ?? 22,
    username: config.username,
    keepaliveInterval: config.keepaliveInterval ?? 10000,
    keepaliveCountMax: config.keepaliveCountMax ?? 3,
    readyTimeout: config.readyTimeout ?? 20000,
  }

  // Add auth based on method
  const auth = config.auth
  switch (auth._tag) {
    case 'PrivateKey':
      return {
        ...base,
        privateKey: auth.privateKey,
        passphrase: auth.passphrase,
      }

    case 'Password':
      return {
        ...base,
        password: auth.password,
      }

    case 'Agent':
      return {
        ...base,
        agent: auth.agentSocket ?? process.env.SSH_AUTH_SOCK,
      }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer Export
// ─────────────────────────────────────────────────────────────────────────────

export const SshBackendLive = Layer.effect(TerminalBackend, makeSshBackend)
