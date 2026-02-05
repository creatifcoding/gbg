/**
 * DevServerManager Service
 *
 * Effect.Service for managing Vite dev servers per worktree.
 * Spawns isolated dev servers on unique ports for live preview.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const devServer = yield* DevServerManager
 *   const port = yield* devServer.spawn('/path/to/worktree')
 *   // ... iframe src = localhost:${port} ...
 *   yield* devServer.kill('/path/to/worktree')
 * })
 * ```
 */

import { Context, Effect, Layer, Schema, Option, Ref } from 'effect'
import { spawn, type ChildProcess } from 'child_process'
import * as path from 'path'
import * as http from 'http'

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Server information
 */
export class ServerInfo extends Schema.Class<ServerInfo>('ServerInfo')({
  /** Port the server is running on */
  port: Schema.Number,
  /** Worktree path */
  worktreePath: Schema.String,
  /** Process ID */
  pid: Schema.NullOr(Schema.Number),
  /** Start time */
  startedAt: Schema.Number,
}) {}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error during dev server operations
 */
export class DevServerError extends Schema.TaggedError<DevServerError>()(
  'DevServerError',
  {
    message: Schema.String,
    operation: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  }
) {}

// =============================================================================
// SERVICE SHAPE
// =============================================================================

/**
 * DevServerManager service shape
 */
export interface DevServerManagerShape {
  /**
   * Spawn a new dev server for a worktree
   */
  readonly spawn: (worktreePath: string) => Effect.Effect<number, DevServerError>

  /**
   * Kill a dev server for a worktree
   */
  readonly kill: (worktreePath: string) => Effect.Effect<void, DevServerError>

  /**
   * Get port for a worktree (if server running)
   */
  readonly getPort: (worktreePath: string) => Effect.Effect<Option.Option<number>>

  /**
   * List all active servers
   */
  readonly listActive: () => Effect.Effect<readonly ServerInfo[]>

  /**
   * Check if server is ready
   */
  readonly isReady: (port: number) => Effect.Effect<boolean>

  /**
   * Kill all servers (cleanup)
   */
  readonly killAll: () => Effect.Effect<void>
}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * DevServerManager Service Tag
 */
export class DevServerManager extends Context.Tag('tmnl/testbed/DevServerManager')<
  DevServerManager,
  DevServerManagerShape
>() {}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Dev server configuration
 */
export interface DevServerConfigShape {
  /** Base port for worktree servers */
  readonly basePort: number
  /** Package path within worktree (default: 'packages/tmnl') */
  readonly packagePath: string
  /** Command to run (default: 'bun run dev') */
  readonly command: string
  /** Timeout for server ready check (ms) */
  readonly readyTimeout: number
}

export class DevServerConfig extends Context.Tag('tmnl/testbed/DevServerConfig')<
  DevServerConfig,
  DevServerConfigShape
>() {
  static Default = Layer.succeed(this, {
    basePort: 5200,
    packagePath: 'packages/tmnl',
    command: 'bun run dev',
    readyTimeout: 30000,
  })

  static Custom = (config: DevServerConfigShape) => Layer.succeed(this, config)
}

// =============================================================================
// INTERNAL STATE
// =============================================================================

interface ServerState {
  process: ChildProcess
  port: number
  worktreePath: string
  startedAt: number
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Wait for server to be ready
 */
const waitForServer = (
  port: number,
  timeout: number
): Effect.Effect<void, DevServerError> =>
  Effect.gen(function* () {
    const startTime = Date.now()

    const checkServer = (): Promise<boolean> =>
      new Promise((resolve) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/',
            method: 'HEAD',
            timeout: 1000,
          },
          (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 500)
          }
        )
        req.on('error', () => resolve(false))
        req.on('timeout', () => {
          req.destroy()
          resolve(false)
        })
        req.end()
      })

    while (Date.now() - startTime < timeout) {
      const ready = yield* Effect.promise(checkServer)
      if (ready) return

      yield* Effect.sleep('500 millis')
    }

    yield* Effect.fail(
      new DevServerError({
        message: `Server on port ${port} did not become ready within ${timeout}ms`,
        operation: 'waitForServer',
        cause: Option.none(),
      })
    )
  })

/**
 * Create DevServerManager implementation
 */
const createDevServerManagerShape = (
  config: DevServerConfigShape,
  serversRef: Ref.Ref<Map<string, ServerState>>
): DevServerManagerShape => ({
  spawn: (worktreePath) =>
    Effect.gen(function* () {
      const servers = yield* Ref.get(serversRef)

      // Check if already running
      if (servers.has(worktreePath)) {
        const existing = servers.get(worktreePath)!
        return existing.port
      }

      // Allocate port
      const port = config.basePort + servers.size

      // Build command
      const cwd = path.join(worktreePath, config.packagePath)
      const [cmd, ...args] = config.command.split(' ')

      // Spawn process
      const proc = spawn(cmd, [...args, '--port', String(port)], {
        cwd,
        stdio: 'pipe',
        detached: false,
        shell: true,
      })

      const serverState: ServerState = {
        process: proc,
        port,
        worktreePath,
        startedAt: Date.now(),
      }

      // Register server
      yield* Ref.update(serversRef, (s) => {
        const newMap = new Map(s)
        newMap.set(worktreePath, serverState)
        return newMap
      })

      // Handle process exit
      proc.on('exit', () => {
        // Clean up on exit (async, fire-and-forget)
        Effect.runPromise(
          Ref.update(serversRef, (s) => {
            const newMap = new Map(s)
            newMap.delete(worktreePath)
            return newMap
          })
        )
      })

      // Wait for server to be ready
      yield* waitForServer(port, config.readyTimeout)

      return port
    }),

  kill: (worktreePath) =>
    Effect.gen(function* () {
      const servers = yield* Ref.get(serversRef)
      const server = servers.get(worktreePath)

      if (!server) return

      // Kill process
      server.process.kill('SIGTERM')

      // Remove from registry
      yield* Ref.update(serversRef, (s) => {
        const newMap = new Map(s)
        newMap.delete(worktreePath)
        return newMap
      })
    }),

  getPort: (worktreePath) =>
    Effect.gen(function* () {
      const servers = yield* Ref.get(serversRef)
      const server = servers.get(worktreePath)
      return server ? Option.some(server.port) : Option.none()
    }),

  listActive: () =>
    Effect.gen(function* () {
      const servers = yield* Ref.get(serversRef)
      return Array.from(servers.values()).map(
        (s) =>
          new ServerInfo({
            port: s.port,
            worktreePath: s.worktreePath,
            pid: s.process.pid ?? null,
            startedAt: s.startedAt,
          })
      )
    }),

  isReady: (port) =>
    Effect.promise(async () => {
      return new Promise<boolean>((resolve) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/',
            method: 'HEAD',
            timeout: 1000,
          },
          (res) => {
            resolve(res.statusCode !== undefined && res.statusCode < 500)
          }
        )
        req.on('error', () => resolve(false))
        req.on('timeout', () => {
          req.destroy()
          resolve(false)
        })
        req.end()
      })
    }),

  killAll: () =>
    Effect.gen(function* () {
      const servers = yield* Ref.get(serversRef)

      for (const [_, server] of servers) {
        server.process.kill('SIGTERM')
      }

      yield* Ref.set(serversRef, new Map())
    }),
})

// =============================================================================
// LAYERS
// =============================================================================

/**
 * DevServerManager layer requiring config
 */
export const DevServerManagerLive = Layer.effect(
  DevServerManager,
  Effect.gen(function* () {
    const config = yield* DevServerConfig
    const serversRef = yield* Ref.make<Map<string, ServerState>>(new Map())
    return createDevServerManagerShape(config, serversRef)
  })
)

/**
 * Full layer with default config
 */
export const DevServerManagerDefault = DevServerManagerLive.pipe(
  Layer.provide(DevServerConfig.Default)
)

// =============================================================================
// EXPORTS
// =============================================================================

export const DevServerManagerService = {
  Live: DevServerManagerLive,
  Default: DevServerManagerDefault,
}
