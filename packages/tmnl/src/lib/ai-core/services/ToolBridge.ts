/**
 * ToolBridge Service
 *
 * Bridges MCP tools with AI Core for unified tool execution.
 * Provides tool discovery, execution, and result formatting.
 *
 * Features:
 * - Aggregates tools from MCPClientRegistry
 * - Executes tool calls with proper error handling
 * - Formats results for AI provider consumption
 * - Tracks active tool calls
 */

import { Context, Effect, Layer, Ref, Option, HashMap } from 'effect'
import { MCPClientRegistry, type MCPClientRegistryShape } from '../../mcp/services'
import {
  ToolDefinition,
  ToolCallRequest,
  ToolCallResult,
  ActiveToolCall,
  ToolRegistryState,
  type AggregatedTool,
  fromMCPTool,
} from '../schemas'
import { AICoreToolExecutionError, AICoreToolNotFoundError } from '../schemas/errors'

// =============================================================================
// Service Shape
// =============================================================================

export interface ToolBridgeShape {
  /**
   * Get all available tools from connected MCP servers
   */
  readonly getAvailableTools: () => Effect.Effect<readonly AggregatedTool[]>

  /**
   * Find a tool by name (supports qualified names like serverId:toolName)
   */
  readonly findTool: (name: string) => Effect.Effect<Option.Option<AggregatedTool>>

  /**
   * Execute a tool call
   */
  readonly executeTool: (
    request: ToolCallRequest
  ) => Effect.Effect<ToolCallResult, AICoreToolExecutionError | AICoreToolNotFoundError>

  /**
   * Get current tool registry state
   */
  readonly getRegistryState: () => Effect.Effect<ToolRegistryState>

  /**
   * Get active tool calls
   */
  readonly getActiveCalls: () => Effect.Effect<readonly ActiveToolCall[]>

  /**
   * Refresh tool list from all servers
   */
  readonly refreshTools: () => Effect.Effect<readonly AggregatedTool[]>
}

// =============================================================================
// Service Tag
// =============================================================================

export class ToolBridge extends Context.Tag('tmnl/ai-core/ToolBridge')<ToolBridge, ToolBridgeShape>() {
  /**
   * Live implementation that depends on MCPClientRegistry
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const mcpRegistry = yield* MCPClientRegistry

      // Internal state for tracking
      const toolsRef = yield* Ref.make<readonly AggregatedTool[]>([])
      const activeCallsRef = yield* Ref.make<HashMap.HashMap<string, ActiveToolCall>>(HashMap.empty())

      /**
       * Fetch and cache all tools from MCP servers
       */
      const refreshToolsImpl = Effect.gen(function* () {
        const mcpTools = yield* mcpRegistry.getAllTools()

        const aggregatedTools: AggregatedTool[] = mcpTools.map(({ tool, serverId }) => ({
          tool: fromMCPTool(tool, serverId),
          serverId,
          serverName: serverId, // TODO: Get actual server name from config
        }))

        yield* Ref.set(toolsRef, aggregatedTools)
        return aggregatedTools
      }).pipe(Effect.withSpan('ToolBridge.refreshTools'))

      const getAvailableTools = (): Effect.Effect<readonly AggregatedTool[]> =>
        Effect.gen(function* () {
          const cached = yield* Ref.get(toolsRef)
          if (cached.length > 0) {
            return cached
          }
          // First call, fetch from MCP
          return yield* refreshToolsImpl
        }).pipe(Effect.withSpan('ToolBridge.getAvailableTools'))

      const findTool = (name: string): Effect.Effect<Option.Option<AggregatedTool>> =>
        Effect.gen(function* () {
          const tools = yield* getAvailableTools()

          // Try exact match first
          const exactMatch = tools.find((t) => t.tool.name === name)
          if (exactMatch) return Option.some(exactMatch)

          // Try qualified match (serverId:toolName)
          if (name.includes(':')) {
            const [serverId, toolName] = name.split(':', 2)
            const qualifiedMatch = tools.find(
              (t) => t.serverId === serverId && t.tool.name === toolName
            )
            if (qualifiedMatch) return Option.some(qualifiedMatch)
          }

          // Try prefix match (for namespaced tools)
          const prefixMatch = tools.find((t) => t.tool.qualifiedName === name)
          if (prefixMatch) return Option.some(prefixMatch)

          return Option.none()
        }).pipe(Effect.withSpan('ToolBridge.findTool', { attributes: { toolName: name } }))

      const executeTool = (
        request: ToolCallRequest
      ): Effect.Effect<ToolCallResult, AICoreToolExecutionError | AICoreToolNotFoundError> =>
        Effect.gen(function* () {
          const startTime = Date.now()

          // Find the tool
          const maybeTool = yield* findTool(request.toolName)
          if (Option.isNone(maybeTool)) {
            const allTools = yield* getAvailableTools()
            return yield* Effect.fail(
              AICoreToolNotFoundError.create(
                request.toolName,
                allTools.map((t) => t.tool.name)
              )
            )
          }

          const { tool, serverId } = maybeTool.value

          // Track as active call
          const activeCall = new ActiveToolCall({
            request,
            status: 'executing',
            partialResult: null,
            result: null,
          })
          yield* Ref.update(activeCallsRef, HashMap.set(request.callId, activeCall))

          // Execute the tool
          const result = yield* Effect.tryPromise({
            try: async () => {
              const args = (request.args ?? {}) as Record<string, unknown>
              return mcpRegistry.callTool(serverId, tool.name, args)
            },
            catch: (e) =>
              AICoreToolExecutionError.create(tool.name, serverId, e, request.args),
          }).pipe(
            Effect.flatMap((resultEffect) => resultEffect),
            Effect.catchAll((e) =>
              Effect.fail(AICoreToolExecutionError.create(tool.name, serverId, e, request.args))
            )
          )

          const endTime = Date.now()
          const toolResult = new ToolCallResult({
            callId: request.callId,
            toolName: tool.name,
            serverId,
            result,
            success: true,
            error: null,
            durationMs: endTime - startTime,
            completedAt: endTime,
          })

          // Update active call with result
          yield* Ref.update(activeCallsRef, (calls) => {
            const existing = HashMap.get(calls, request.callId)
            if (Option.isSome(existing)) {
              return HashMap.set(
                calls,
                request.callId,
                new ActiveToolCall({
                  ...existing.value,
                  status: 'completed',
                  result: toolResult,
                })
              )
            }
            return calls
          })

          return toolResult
        }).pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              const endTime = Date.now()

              // Create error result
              const errorResult = new ToolCallResult({
                callId: request.callId,
                toolName: request.toolName,
                serverId: request.serverId ?? null,
                result: null,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                durationMs: endTime - request.requestedAt,
                completedAt: endTime,
              })

              // Update active call with error
              yield* Ref.update(activeCallsRef, (calls) => {
                const existing = HashMap.get(calls, request.callId)
                if (Option.isSome(existing)) {
                  return HashMap.set(
                    calls,
                    request.callId,
                    new ActiveToolCall({
                      ...existing.value,
                      status: 'error',
                      result: errorResult,
                    })
                  )
                }
                return calls
              })

              // Re-throw the original error
              return yield* Effect.fail(error as AICoreToolExecutionError | AICoreToolNotFoundError)
            })
          ),
          Effect.withSpan('ToolBridge.executeTool', {
            attributes: {
              callId: request.callId,
              toolName: request.toolName,
            },
          })
        )

      const getRegistryState = (): Effect.Effect<ToolRegistryState> =>
        Effect.gen(function* () {
          const tools = yield* getAvailableTools()
          const activeCallsMap = yield* Ref.get(activeCallsRef)
          const activeCalls = Array.from(HashMap.values(activeCallsMap))

          return new ToolRegistryState({
            tools: [...tools],
            activeCalls,
            lastRefreshed: Date.now(),
            isLoading: false,
          })
        })

      const getActiveCalls = (): Effect.Effect<readonly ActiveToolCall[]> =>
        Effect.gen(function* () {
          const callsMap = yield* Ref.get(activeCallsRef)
          return Array.from(HashMap.values(callsMap))
        })

      return {
        getAvailableTools,
        findTool,
        executeTool,
        getRegistryState,
        getActiveCalls,
        refreshTools: refreshToolsImpl,
      }
    })
  )

  /**
   * Test implementation (no MCP dependency)
   */
  static readonly Test = Layer.succeed(
    this,
    ToolBridge.of({
      getAvailableTools: () => Effect.succeed([]),
      findTool: () => Effect.succeed(Option.none()),
      executeTool: () =>
        Effect.fail(
          AICoreToolExecutionError.create('test', 'test-server', new Error('Test mode'))
        ),
      getRegistryState: () => Effect.succeed(ToolRegistryState.Initial),
      getActiveCalls: () => Effect.succeed([]),
      refreshTools: () => Effect.succeed([]),
    })
  )
}
