/**
 * TauriPtyService
 *
 * Effect.Service for PTY operations via Tauri shell plugin.
 * Provides spawning, writing, resizing, and killing PTY processes.
 *
 * NOTE: This service only works in Tauri context. For browser dev mode,
 * a fallback WebSocket transport can be provided via Layer composition.
 */

import { Context, Effect, Layer, Stream, Queue, Ref, Option, HashMap } from 'effect'
import type { PtySpawnOptions, TerminalEvent } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface PtyHandle {
  readonly id: string
  readonly write: (data: string) => Effect.Effect<void>
  readonly resize: (rows: number, cols: number) => Effect.Effect<void>
  readonly kill: () => Effect.Effect<void>
  readonly events: Stream.Stream<TerminalEvent>
}

export interface TauriPtyServiceShape {
  /**
   * Spawn a new PTY process
   */
  readonly spawn: (options: PtySpawnOptions) => Effect.Effect<PtyHandle>

  /**
   * Get an existing PTY by ID
   */
  readonly get: (id: string) => Effect.Effect<Option.Option<PtyHandle>>

  /**
   * Kill a PTY by ID
   */
  readonly kill: (id: string) => Effect.Effect<void>

  /**
   * List all active PTY IDs
   */
  readonly list: () => Effect.Effect<ReadonlyArray<string>>
}

// =============================================================================
// WebSocket Fallback for Browser Dev Mode
// =============================================================================

const WS_URL = 'ws://localhost:7681/ws'

/**
 * Spawn PTY via WebSocket relay server (fallback for browser dev mode)
 */
function spawnViaWebSocket(
  options: PtySpawnOptions,
  registry: Ref.Ref<HashMap.HashMap<string, PtyHandle>>
): Effect.Effect<PtyHandle, Error> {
  return Effect.gen(function* () {
    const id = `pty-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const eventQueue = yield* Queue.unbounded<TerminalEvent>()

    // Build WebSocket URL with options
    const params = new URLSearchParams()
    if (options.shell) params.set('shell', options.shell)
    if (options.cols) params.set('cols', String(options.cols))
    if (options.rows) params.set('rows', String(options.rows))
    if (options.cwd) params.set('cwd', options.cwd)

    const wsUrl = `${WS_URL}?${params.toString()}`

    // Connect to WebSocket
    const ws = yield* Effect.tryPromise({
      try: () =>
        new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(wsUrl)
          socket.onopen = () => resolve(socket)
          socket.onerror = (e) => reject(new Error(`WebSocket connection failed: ${e}`))
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000)
        }),
      catch: (e) => new Error(`Failed to connect to terminal server: ${e}`),
    })

    // Session ID from server
    let serverSessionId = id

    // Handle incoming messages
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg._tag) {
          case 'ServerReady':
            serverSessionId = msg.sessionId
            break

          case 'ServerData':
            Effect.runSync(
              Queue.offer(eventQueue, {
                _tag: 'TerminalData',
                terminalId: id,
                data: msg.data,
              })
            )
            break

          case 'ServerExit':
            Effect.runSync(
              Queue.offer(eventQueue, {
                _tag: 'TerminalExit',
                terminalId: id,
                code: msg.exitCode,
              })
            )
            break

          case 'ServerError':
            console.error('[TauriPtyService] Server error:', msg.message)
            break
        }
      } catch (e) {
        console.error('[TauriPtyService] Failed to parse message:', e)
      }
    }

    ws.onclose = () => {
      Effect.runSync(
        Queue.offer(eventQueue, {
          _tag: 'TerminalExit',
          terminalId: id,
          code: 0,
        })
      )
    }

    ws.onerror = (e) => {
      console.error('[TauriPtyService] WebSocket error:', e)
    }

    // Create handle
    const handle: PtyHandle = {
      id,
      write: (data: string) =>
        Effect.sync(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ _tag: 'ClientData', data }))
          }
        }),
      resize: (rows: number, cols: number) =>
        Effect.sync(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ _tag: 'ClientResize', rows, cols }))
          }
        }),
      kill: () =>
        Effect.gen(function* () {
          ws.close()
          yield* Ref.update(registry, HashMap.remove(id))
        }),
      events: Stream.fromQueue(eventQueue),
    }

    // Register handle
    yield* Ref.update(registry, HashMap.set(id, handle))

    return handle
  })
}

// =============================================================================
// Service Tag
// =============================================================================

export class TauriPtyService extends Context.Tag('tmnl/terminal/TauriPtyService')<
  TauriPtyService,
  TauriPtyServiceShape
>() {
  /**
   * Live implementation using Tauri shell plugin
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      // Registry of active PTY handles
      const registry = yield* Ref.make(HashMap.empty<string, PtyHandle>())

      // Check if we're in Tauri context
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

      const spawn = (options: PtySpawnOptions): Effect.Effect<PtyHandle> =>
        Effect.gen(function* () {
          // If not in Tauri, use WebSocket fallback
          if (!isTauri) {
            return yield* spawnViaWebSocket(options, registry)
          }

          // Dynamically import Tauri API only when needed
          const { Command } = yield* Effect.tryPromise({
            try: () => import('@tauri-apps/plugin-shell'),
            catch: (e) => new Error(`Failed to import @tauri-apps/plugin-shell: ${e}`),
          })

          // Generate unique ID
          const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

          // Create event queue for this PTY
          const eventQueue = yield* Queue.unbounded<TerminalEvent>()

          // Spawn the shell command
          const shell = options.shell ?? (process.platform === 'win32' ? 'powershell.exe' : 'bash')
          const command = Command.create(shell, [], {
            cwd: options.cwd,
            env: options.env as Record<string, string> | undefined,
          })

          // Set up event listeners
          command.stdout.on('data', (data: Uint8Array) => {
            const text = new TextDecoder().decode(data)
            Effect.runSync(
              Queue.offer(eventQueue, {
                _tag: 'TerminalData',
                terminalId: id,
                data: text,
              })
            )
          })

          command.stderr.on('data', (data: Uint8Array) => {
            const text = new TextDecoder().decode(data)
            Effect.runSync(
              Queue.offer(eventQueue, {
                _tag: 'TerminalData',
                terminalId: id,
                data: text,
              })
            )
          })

          command.on('close', (code: { code: number }) => {
            Effect.runSync(
              Queue.offer(eventQueue, {
                _tag: 'TerminalExit',
                terminalId: id,
                code: code.code,
              })
            )
          })

          // Spawn the process
          const child = yield* Effect.tryPromise({
            try: () => command.spawn(),
            catch: (e) => new Error(`Failed to spawn PTY: ${e}`),
          })

          // Create handle
          const handle: PtyHandle = {
            id,
            write: (data: string) =>
              Effect.tryPromise({
                try: () => child.write(new TextEncoder().encode(data)),
                catch: (e) => new Error(`Failed to write to PTY: ${e}`),
              }),
            resize: (_rows: number, _cols: number) =>
              // NOTE: Tauri shell plugin doesn't support resize directly
              // This would require tauri-pty plugin for full PTY support
              Effect.void,
            kill: () =>
              Effect.gen(function* () {
                yield* Effect.tryPromise({
                  try: () => child.kill(),
                  catch: (e) => new Error(`Failed to kill PTY: ${e}`),
                })
                yield* Ref.update(registry, HashMap.remove(id))
              }),
            events: Stream.fromQueue(eventQueue),
          }

          // Register handle
          yield* Ref.update(registry, HashMap.set(id, handle))

          return handle
        })

      const get = (id: string): Effect.Effect<Option.Option<PtyHandle>> =>
        Effect.gen(function* () {
          const map = yield* Ref.get(registry)
          return HashMap.get(map, id)
        })

      const kill = (id: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const maybeHandle = yield* get(id)
          if (Option.isSome(maybeHandle)) {
            yield* maybeHandle.value.kill()
          }
        })

      const list = (): Effect.Effect<ReadonlyArray<string>> =>
        Effect.gen(function* () {
          const map = yield* Ref.get(registry)
          return Array.from(HashMap.keys(map))
        })

      return { spawn, get, kill, list }
    })
  )

  /**
   * Mock implementation for testing
   */
  static readonly Test = Layer.succeed(
    this,
    TauriPtyService.of({
      spawn: () => Effect.fail(new Error('Test PTY service - spawn not implemented')),
      get: () => Effect.succeed(Option.none()),
      kill: () => Effect.void,
      list: () => Effect.succeed([]),
    })
  )
}
