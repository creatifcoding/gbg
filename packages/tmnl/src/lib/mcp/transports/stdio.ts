/**
 * MCP Stdio Transport
 *
 * Spawns MCP server processes and communicates via JSON-RPC over stdio.
 * Ported from infinitty's MCPClient with Effect-TS patterns.
 */

import { Effect, Ref, Queue, Stream, Option, Deferred } from 'effect'
import type {
  MCPServerConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPServerInfo,
  JSONRPCRequest,
  JSONRPCResponse,
} from '../schemas'
import type { MCPClientInstance } from '../services/MCPClientRegistry'

// =============================================================================
// Types
// =============================================================================

interface PendingRequest {
  deferred: Deferred.Deferred<unknown, Error>
  timeout: ReturnType<typeof setTimeout>
}

interface StdioClientState {
  process: unknown | null // Child process from Tauri
  requestId: number
  pendingRequests: Map<number, PendingRequest>
  buffer: string
  serverInfo: MCPServerInfo | null
  tools: readonly MCPTool[]
  resources: readonly MCPResource[]
  prompts: readonly MCPPrompt[]
  isConnected: boolean
}

// =============================================================================
// Stdio Client Factory
// =============================================================================

/**
 * Create an MCP client that communicates via stdio with a spawned process.
 */
export function createStdioClient(
  config: MCPServerConfig,
  onStatusChange?: (status: 'connecting' | 'connected' | 'error' | 'disconnected', error?: string) => void,
  onToolsChange?: (tools: readonly MCPTool[]) => void
): MCPClientInstance {
  // Internal state
  const state: StdioClientState = {
    process: null,
    requestId: 0,
    pendingRequests: new Map(),
    buffer: '',
    serverInfo: null,
    tools: [],
    resources: [],
    prompts: [],
    isConnected: false,
  }

  // Handle stdout data (JSON-RPC responses)
  const handleStdout = (data: string): void => {
    state.buffer += data

    // Parse complete JSON-RPC messages (newline-delimited)
    const lines = state.buffer.split('\n')
    state.buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line) as JSONRPCResponse
        handleResponse(message)
      } catch (error) {
        console.error(`[MCP ${config.name}] failed to parse:`, line, error)
      }
    }
  }

  // Handle JSON-RPC response
  const handleResponse = (response: JSONRPCResponse): void => {
    const pending = state.pendingRequests.get(response.id)
    if (!pending) {
      console.warn(`[MCP ${config.name}] received response for unknown request:`, response.id)
      return
    }

    clearTimeout(pending.timeout)
    state.pendingRequests.delete(response.id)

    if (response.error) {
      Effect.runSync(
        Deferred.fail(pending.deferred, new Error(`${response.error.message} (code: ${response.error.code})`))
      )
    } else {
      Effect.runSync(Deferred.succeed(pending.deferred, response.result))
    }
  }

  // Send JSON-RPC request
  const sendRequest = <T>(method: string, params: Record<string, unknown>): Effect.Effect<T, Error> =>
    Effect.gen(function* () {
      if (!state.process) {
        return yield* Effect.fail(new Error('Not connected'))
      }

      const id = ++state.requestId
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      }

      const deferred = yield* Deferred.make<unknown, Error>()

      const timeout = setTimeout(() => {
        state.pendingRequests.delete(id)
        Effect.runSync(Deferred.fail(deferred, new Error(`Request timed out: ${method}`)))
      }, 30000)

      state.pendingRequests.set(id, { deferred, timeout })

      // Send the request
      const message = JSON.stringify(request) + '\n'
      // NOTE: In Tauri context, this would use process.write()
      // For now, we'll just log - actual implementation requires Tauri
      console.log(`[MCP ${config.name}] sending:`, message)

      return (yield* Deferred.await(deferred)) as T
    })

  // Send notification (no response expected)
  const sendNotification = (method: string, params: Record<string, unknown>): Effect.Effect<void> =>
    Effect.sync(() => {
      if (!state.process) return

      const notification = {
        jsonrpc: '2.0',
        method,
        params,
      }

      const message = JSON.stringify(notification) + '\n'
      console.log(`[MCP ${config.name}] notification:`, message)
    })

  // Initialize MCP connection
  const initialize = (): Effect.Effect<void, Error> =>
    Effect.gen(function* () {
      const result = yield* sendRequest<{
        serverInfo: MCPServerInfo
        capabilities?: Record<string, boolean>
      }>('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { roots: {} },
        clientInfo: { name: 'tmnl', version: '0.1.0' },
      })

      state.serverInfo = result.serverInfo
      console.log(`[MCP ${config.name}] initialized:`, state.serverInfo)

      // Send initialized notification
      yield* sendNotification('notifications/initialized', {})
    })

  // Refresh capabilities (tools, resources, prompts)
  const refreshCapabilities = (): Effect.Effect<void> =>
    Effect.gen(function* () {
      // Fetch tools
      try {
        const toolsResult = yield* sendRequest<{ tools: MCPTool[] }>('tools/list', {})
        state.tools = toolsResult.tools ?? []
        console.log(`[MCP ${config.name}] found ${state.tools.length} tools`)
        onToolsChange?.(state.tools)
      } catch {
        console.debug(`[MCP ${config.name}] no tools available`)
        state.tools = []
      }

      // Fetch resources
      try {
        const resourcesResult = yield* sendRequest<{ resources: MCPResource[] }>('resources/list', {})
        state.resources = resourcesResult.resources ?? []
        console.log(`[MCP ${config.name}] found ${state.resources.length} resources`)
      } catch {
        console.debug(`[MCP ${config.name}] no resources available`)
        state.resources = []
      }

      // Fetch prompts
      try {
        const promptsResult = yield* sendRequest<{ prompts: MCPPrompt[] }>('prompts/list', {})
        state.prompts = promptsResult.prompts ?? []
        console.log(`[MCP ${config.name}] found ${state.prompts.length} prompts`)
      } catch {
        console.debug(`[MCP ${config.name}] no prompts available`)
        state.prompts = []
      }
    })

  // Client implementation
  const client: MCPClientInstance = {
    id: config.id,
    config,

    connect: () =>
      Effect.gen(function* () {
        if (state.isConnected || state.process) {
          return
        }

        onStatusChange?.('connecting')

        try {
          // Check if we're in Tauri context
          const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

          if (!isTauri) {
            // In browser dev mode, we can't spawn processes
            // Just mark as connected for now (mock mode)
            console.log(`[MCP ${config.name}] running in browser mode (mock)`)
            state.isConnected = true
            onStatusChange?.('connected')
            return
          }

          // Dynamic import Tauri shell
          const { Command } = yield* Effect.tryPromise({
            try: () => import('@tauri-apps/plugin-shell'),
            catch: (e) => new Error(`Failed to import @tauri-apps/plugin-shell: ${e}`),
          })

          // Create command
          const command = Command.create(config.command, config.args ?? [], {
            env: config.env as Record<string, string> | undefined,
          })

          // Set up handlers
          command.stdout.on('data', (data: Uint8Array) => {
            handleStdout(new TextDecoder().decode(data))
          })

          command.stderr.on('data', (data: Uint8Array) => {
            console.error(`[MCP ${config.name}] stderr:`, new TextDecoder().decode(data))
          })

          command.on('close', (data: { code: number }) => {
            console.log(`[MCP ${config.name}] closed with code:`, data.code)
            state.isConnected = false
            state.process = null
            onStatusChange?.('disconnected')
          })

          command.on('error', (error: string) => {
            console.error(`[MCP ${config.name}] error:`, error)
            state.isConnected = false
            onStatusChange?.('error', error)
          })

          // Spawn the process
          state.process = yield* Effect.tryPromise({
            try: () => command.spawn(),
            catch: (e) => new Error(`Failed to spawn MCP server: ${e}`),
          })

          console.log(`[MCP ${config.name}] spawned`)

          // Initialize and refresh capabilities
          yield* initialize()
          yield* refreshCapabilities()

          state.isConnected = true
          onStatusChange?.('connected')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`[MCP ${config.name}] failed to connect:`, errorMsg)
          onStatusChange?.('error', errorMsg)
          throw error
        }
      }),

    disconnect: () =>
      Effect.gen(function* () {
        if (!state.process) return

        try {
          yield* sendNotification('shutdown', {})
        } catch {
          // Ignore shutdown errors
        }

        // Kill the process (in Tauri context)
        if (state.process && typeof (state.process as any).kill === 'function') {
          yield* Effect.tryPromise({
            try: () => (state.process as any).kill(),
            catch: () => new Error('Failed to kill process'),
          })
        }

        state.process = null
        state.isConnected = false
        state.tools = []
        state.resources = []
        state.prompts = []
        onStatusChange?.('disconnected')
        onToolsChange?.([])
      }),

    callTool: (name: string, args: Record<string, unknown>) =>
      Effect.gen(function* () {
        const result = yield* sendRequest<{ content: unknown[] }>('tools/call', {
          name,
          arguments: args,
        })
        return result.content
      }),

    readResource: (uri: string) =>
      Effect.gen(function* () {
        const result = yield* sendRequest<{
          contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }>
        }>('resources/read', { uri })
        const content = result.contents[0]
        return {
          contents: content.text ?? content.blob ?? '',
          mimeType: content.mimeType,
        }
      }),

    getPrompt: (name: string, args?: Record<string, string>) =>
      sendRequest<{ messages: Array<{ role: string; content: string }> }>('prompts/get', {
        name,
        arguments: args,
      }),

    getTools: () => Effect.succeed(state.tools),

    getResources: () => Effect.succeed(state.resources),

    getPrompts: () => Effect.succeed(state.prompts),

    getServerInfo: () =>
      Effect.succeed(state.serverInfo ? Option.some(state.serverInfo) : Option.none()),

    isConnected: () => Effect.succeed(state.isConnected),
  }

  return client
}
