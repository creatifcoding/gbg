/**
 * MCPClientRegistry Service
 *
 * Effect.Service for managing MCP server connections.
 * Ported from infinitty's MCPClientManager with Effect-TS patterns.
 *
 * Features:
 * - Registry of connected MCP servers
 * - Stdio and HTTP transport support
 * - Tool aggregation across servers
 * - Event stream for connection changes
 */

import { Context, Effect, Layer, Stream, Queue, Ref, Option, HashMap, PubSub } from 'effect'
import type {
  MCPServerConfig,
  MCPServerStatus,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPRegistryEvent,
  MCPServerInfo,
} from '../schemas'
import { createStdioClient } from '../transports/stdio'

// =============================================================================
// Client Interface (Transport-agnostic)
// =============================================================================

export interface MCPClientInstance {
  readonly id: string
  readonly config: MCPServerConfig
  readonly connect: () => Effect.Effect<void>
  readonly disconnect: () => Effect.Effect<void>
  readonly callTool: (name: string, args: Record<string, unknown>) => Effect.Effect<unknown>
  readonly readResource: (uri: string) => Effect.Effect<{ contents: string; mimeType?: string }>
  readonly getPrompt: (name: string, args?: Record<string, string>) => Effect.Effect<{ messages: Array<{ role: string; content: string }> }>
  readonly getTools: () => Effect.Effect<readonly MCPTool[]>
  readonly getResources: () => Effect.Effect<readonly MCPResource[]>
  readonly getPrompts: () => Effect.Effect<readonly MCPPrompt[]>
  readonly getServerInfo: () => Effect.Effect<Option.Option<MCPServerInfo>>
  readonly isConnected: () => Effect.Effect<boolean>
}

// =============================================================================
// Service Shape
// =============================================================================

export interface MCPClientRegistryShape {
  /**
   * Connect to an MCP server
   */
  readonly connect: (config: MCPServerConfig) => Effect.Effect<MCPClientInstance>

  /**
   * Disconnect from an MCP server
   */
  readonly disconnect: (serverId: string) => Effect.Effect<void>

  /**
   * Disconnect from all servers
   */
  readonly disconnectAll: () => Effect.Effect<void>

  /**
   * Get a connected client by ID
   */
  readonly getClient: (serverId: string) => Effect.Effect<Option.Option<MCPClientInstance>>

  /**
   * Get all connected clients
   */
  readonly getAllClients: () => Effect.Effect<readonly MCPClientInstance[]>

  /**
   * Get all tools from all connected servers
   */
  readonly getAllTools: () => Effect.Effect<readonly { tool: MCPTool; serverId: string }[]>

  /**
   * Call a tool on a specific server
   */
  readonly callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Effect.Effect<unknown>

  /**
   * Get status of a server
   */
  readonly getServerStatus: (serverId: string) => Effect.Effect<Option.Option<MCPServerStatus>>

  /**
   * Subscribe to registry events
   */
  readonly subscribe: () => Effect.Effect<Stream.Stream<MCPRegistryEvent>>
}

// =============================================================================
// Internal State
// =============================================================================

interface RegistryState {
  readonly clients: HashMap.HashMap<string, MCPClientInstance>
  readonly statuses: HashMap.HashMap<string, MCPServerStatus>
  readonly connecting: HashMap.HashMap<string, Effect.Effect<MCPClientInstance>>
}

// =============================================================================
// Service Tag
// =============================================================================

export class MCPClientRegistry extends Context.Tag('tmnl/mcp/MCPClientRegistry')<
  MCPClientRegistry,
  MCPClientRegistryShape
>() {
  /**
   * Live implementation
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      // State
      const stateRef = yield* Ref.make<RegistryState>({
        clients: HashMap.empty(),
        statuses: HashMap.empty(),
        connecting: HashMap.empty(),
      })

      // Event pubsub
      const eventPubSub = yield* PubSub.unbounded<MCPRegistryEvent>()

      // Helper to publish events
      const publishEvent = (event: MCPRegistryEvent) =>
        Effect.gen(function* () {
          yield* PubSub.publish(eventPubSub, event)
        })

      // Helper to update status
      const updateStatus = (serverId: string, update: Partial<MCPServerStatus>) =>
        Ref.update(stateRef, (state) => {
          const existing = HashMap.get(state.statuses, serverId)
          const base: MCPServerStatus = Option.isSome(existing)
            ? existing.value
            : {
                id: serverId,
                status: 'disconnected',
                tools: [],
                resources: [],
                prompts: [],
              }

          return {
            ...state,
            statuses: HashMap.set(state.statuses, serverId, { ...base, ...update }),
          }
        })

      // Create real stdio client with status/event callbacks
      const createClientWithCallbacks = (config: MCPServerConfig): MCPClientInstance => {
        return createStdioClient(
          config,
          // onStatusChange callback
          (status, error) => {
            const mcpStatus = status === 'error' ? 'error' : status
            Effect.runSync(
              Effect.gen(function* () {
                yield* updateStatus(config.id, { status: mcpStatus, error })
                if (status === 'connected') {
                  yield* publishEvent({
                    _tag: 'MCPServerConnected',
                    serverId: config.id,
                    serverInfo: { name: config.name, version: '1.0.0' }
                  })
                } else if (status === 'disconnected') {
                  yield* publishEvent({ _tag: 'MCPServerDisconnected', serverId: config.id })
                } else if (status === 'error' && error) {
                  yield* publishEvent({ _tag: 'MCPServerError', serverId: config.id, error })
                }
              })
            )
          },
          // onToolsChange callback
          (tools) => {
            Effect.runSync(
              Effect.gen(function* () {
                yield* updateStatus(config.id, { tools: [...tools] })
                yield* publishEvent({ _tag: 'MCPToolsChanged', serverId: config.id, tools: [...tools] })
              })
            )
          }
        )
      }

      const connect = (config: MCPServerConfig): Effect.Effect<MCPClientInstance> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)

          // Check if already connected
          const existing = HashMap.get(state.clients, config.id)
          if (Option.isSome(existing)) {
            return existing.value
          }

          // Check if already connecting
          const connecting = HashMap.get(state.connecting, config.id)
          if (Option.isSome(connecting)) {
            return yield* connecting.value
          }

          // Start connection
          yield* updateStatus(config.id, { status: 'connecting' })

          // Create client with real stdio transport
          const client = createClientWithCallbacks(config)

          // Connect
          yield* client.connect()

          // Register client
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            clients: HashMap.set(s.clients, config.id, client),
          }))

          return client
        })

      const disconnect = (serverId: string): Effect.Effect<void> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const client = HashMap.get(state.clients, serverId)

          if (Option.isSome(client)) {
            yield* client.value.disconnect()
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              clients: HashMap.remove(s.clients, serverId),
            }))
          }
        })

      const disconnectAll = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const serverIds = Array.from(HashMap.keys(state.clients))

          for (const serverId of serverIds) {
            yield* disconnect(serverId)
          }
        })

      const getClient = (serverId: string): Effect.Effect<Option.Option<MCPClientInstance>> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return HashMap.get(state.clients, serverId)
        })

      const getAllClients = (): Effect.Effect<readonly MCPClientInstance[]> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return Array.from(HashMap.values(state.clients))
        })

      const getAllTools = (): Effect.Effect<readonly { tool: MCPTool; serverId: string }[]> =>
        Effect.gen(function* () {
          const clients = yield* getAllClients()
          const allTools: { tool: MCPTool; serverId: string }[] = []

          for (const client of clients) {
            const tools = yield* client.getTools()
            for (const tool of tools) {
              allTools.push({ tool, serverId: client.id })
            }
          }

          return allTools
        })

      const callTool = (serverId: string, toolName: string, args: Record<string, unknown>): Effect.Effect<unknown> =>
        Effect.gen(function* () {
          const maybeClient = yield* getClient(serverId)
          if (Option.isNone(maybeClient)) {
            return yield* Effect.fail(new Error(`Server not connected: ${serverId}`))
          }
          return yield* maybeClient.value.callTool(toolName, args)
        })

      const getServerStatus = (serverId: string): Effect.Effect<Option.Option<MCPServerStatus>> =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          return HashMap.get(state.statuses, serverId)
        })

      const subscribe = (): Effect.Effect<Stream.Stream<MCPRegistryEvent>> =>
        Effect.gen(function* () {
          const queue = yield* PubSub.subscribe(eventPubSub)
          return Stream.fromQueue(queue)
        })

      return {
        connect,
        disconnect,
        disconnectAll,
        getClient,
        getAllClients,
        getAllTools,
        callTool,
        getServerStatus,
        subscribe,
      }
    })
  )

  /**
   * Test implementation
   */
  static readonly Test = Layer.succeed(
    this,
    MCPClientRegistry.of({
      connect: () => Effect.fail(new Error('Test MCP registry - connect not implemented')),
      disconnect: () => Effect.void,
      disconnectAll: () => Effect.void,
      getClient: () => Effect.succeed(Option.none()),
      getAllClients: () => Effect.succeed([]),
      getAllTools: () => Effect.succeed([]),
      callTool: () => Effect.fail(new Error('Test MCP registry - callTool not implemented')),
      getServerStatus: () => Effect.succeed(Option.none()),
      subscribe: () => Effect.succeed(Stream.empty),
    })
  )
}
