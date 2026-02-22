/**
 * AICoreService
 *
 * Main Effect.Service for AI streaming and chat operations.
 * Unifies streaming from cursor server with MCP tool execution.
 *
 * Features:
 * - Multi-provider support via cursor server (Claude Code backend)
 * - Pure Effect streaming via SSEAdapter
 * - MCP tool integration via ToolBridge
 * - Fiber-based stream lifecycle
 */

import { Context, Effect, Layer, Stream, Ref, Fiber, Option, pipe } from 'effect'
import { SSEAdapter } from './SSEAdapter'
import { ToolBridge } from './ToolBridge'
import {
  type AIStreamEvent,
  type Message,
  type Conversation,
  StreamStart,
  StreamComplete,
  StreamState,
  toAISDKConversation,
  type ToolDefinition,
  type AggregatedTool,
  ToolCallRequest,
  type ToolCallResult,
} from '../schemas'
import {
  AICoreConnectionError,
  AICoreStreamError,
  type AICoreError,
  AICoreToolExecutionError,
  AICoreToolNotFoundError,
} from '../schemas/errors'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Cursor chat server URL (Claude Code backend)
 */
const CURSOR_CHAT_URL = 'http://localhost:7682/chat'

// =============================================================================
// Types
// =============================================================================

/**
 * AI provider identifier
 */
export type AIProvider = 'anthropic' | 'openai' | 'claude-code'

/**
 * Stream chat request
 */
export interface StreamChatRequest {
  /** Conversation messages */
  readonly messages: Conversation
  /** Provider to use (default: claude-code) */
  readonly provider?: AIProvider
  /** Model ID override */
  readonly modelId?: string
  /** Include tools in request */
  readonly tools?: readonly ToolDefinition[]
  /** Maximum tokens */
  readonly maxTokens?: number
  /** Temperature */
  readonly temperature?: number
  /** System prompt override */
  readonly systemPrompt?: string
  /** Chat mode: 'terminal' enables MCP tools, 'cursor' is natural language only */
  readonly mode?: 'terminal' | 'cursor'
}

/**
 * Stream handle for managing active streams
 */
export interface StreamHandle {
  /** The stream of AI events */
  readonly stream: Stream.Stream<AIStreamEvent, AICoreStreamError>
  /** Abort the stream */
  readonly abort: () => Effect.Effect<void>
  /** Stream metadata */
  readonly metadata: {
    readonly requestId: string
    readonly provider: AIProvider
    readonly modelId: string
    readonly startedAt: number
  }
  /** Background fiber running the stream */
  readonly fiber: Fiber.RuntimeFiber<void, AICoreStreamError>
}

// =============================================================================
// Service Shape
// =============================================================================

export interface AICoreServiceShape {
  /**
   * Start a streaming chat session
   */
  readonly streamChat: (
    request: StreamChatRequest
  ) => Effect.Effect<StreamHandle, AICoreConnectionError>

  /**
   * Get available providers
   */
  readonly getProviders: () => Effect.Effect<readonly AIProvider[]>

  /**
   * Get available tools from all MCP servers
   */
  readonly getAvailableTools: () => Effect.Effect<readonly AggregatedTool[]>

  /**
   * Execute a tool call
   */
  readonly executeTool: (
    request: ToolCallRequest
  ) => Effect.Effect<ToolCallResult, AICoreToolExecutionError | AICoreToolNotFoundError>

  /**
   * Refresh tools from MCP servers
   */
  readonly refreshTools: () => Effect.Effect<readonly AggregatedTool[]>
}

// =============================================================================
// Service Tag
// =============================================================================

export class AICoreService extends Context.Tag('tmnl/ai-core/AICoreService')<
  AICoreService,
  AICoreServiceShape
>() {
  /**
   * Live implementation
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const sseAdapter = yield* SSEAdapter
      const toolBridge = yield* ToolBridge

      // Request counter for unique IDs
      let requestCounter = 0

      const streamChat = (
        request: StreamChatRequest
      ): Effect.Effect<StreamHandle, AICoreConnectionError> =>
        Effect.gen(function* () {
          const requestId = `ai-${Date.now()}-${++requestCounter}`
          const startedAt = Date.now()
          const provider = request.provider ?? 'claude-code'
          const modelId = request.modelId ?? 'claude-code'

          // Convert messages to AI SDK format
          const aiSdkMessages = toAISDKConversation(request.messages)

          // DEBUG: Log what we're sending
          console.log('[AICoreService] Sending to cursor server:', JSON.stringify({ messages: aiSdkMessages }, null, 2))

          // Make streaming request to cursor server
          // Note: Tools are handled by Claude Code's native MCP system when mode='terminal'
          // The client-side tools are for display/tracking, not for passing to the AI
          const response = yield* Effect.tryPromise({
            try: async () => {
              return fetch(CURSOR_CHAT_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messages: aiSdkMessages,
                  // Use explicit mode if provided, otherwise default to 'terminal' for MCP tools
                  // (Cursor mode is only used by Dynamic Island floating chat)
                  mode: request.mode ?? 'terminal',
                  maxTokens: request.maxTokens,
                  temperature: request.temperature,
                  systemPrompt: request.systemPrompt,
                }),
              })
            },
            catch: (e) =>
              AICoreConnectionError.create(
                CURSOR_CHAT_URL,
                e,
                true, // retryable
                requestId
              ),
          })

          if (!response.ok) {
            const errorText = yield* Effect.tryPromise({
              try: () => response.text(),
              catch: () => 'Unknown error',
            })
            console.error('[AICoreService] Server error:', response.status, errorText)
            return yield* Effect.fail(
              AICoreConnectionError.create(
                CURSOR_CHAT_URL,
                `Server error (${response.status}): ${errorText}`,
                response.status >= 500, // 5xx are retryable
                requestId
              )
            )
          }

          if (!response.body) {
            return yield* Effect.fail(
              AICoreConnectionError.create(
                CURSOR_CHAT_URL,
                'No response body from server',
                false,
                requestId
              )
            )
          }

          // Parse SSE stream
          const eventStream = yield* sseAdapter.fromReadableStream(response.body)

          // Prepend StreamStart event
          const streamWithStart = pipe(
            Stream.make(
              new StreamStart({
                requestId,
                modelId,
                provider,
                startedAt,
              })
            ),
            Stream.concat(eventStream)
          )

          // Abort controller ref
          const abortedRef = yield* Ref.make(false)

          // Create abort function
          const abort = (): Effect.Effect<void> =>
            Effect.gen(function* () {
              yield* Ref.set(abortedRef, true)
            })

          // Wrap stream with abort check
          // NOTE: takeUntilEffect for effectful predicates (Ref.get returns Effect)
          const abortableStream = streamWithStart.pipe(
            Stream.takeUntilEffect(() => Ref.get(abortedRef))
          )

          // NOTE: We do NOT run the stream here - the consumer will consume it.
          // The fiber is created as a placeholder that can be used for abort signaling.
          // The actual stream consumption happens in BlockTerminalService.executeAIQuery
          const fiber = Fiber.succeed(void 0) as unknown as Fiber.RuntimeFiber<void, AICoreStreamError>

          console.log('[AICoreService] Stream handle created, requestId:', requestId)

          return {
            stream: abortableStream,
            abort,
            metadata: {
              requestId,
              provider,
              modelId,
              startedAt,
            },
            fiber,
          }
        }).pipe(
          Effect.withSpan('AICoreService.streamChat', {
            attributes: {
              provider: request.provider ?? 'claude-code',
              messageCount: request.messages.length,
            },
          })
        )

      const getProviders = (): Effect.Effect<readonly AIProvider[]> =>
        Effect.succeed(['anthropic', 'openai', 'claude-code'] as const)

      const getAvailableTools = (): Effect.Effect<readonly AggregatedTool[]> =>
        toolBridge.getAvailableTools()

      const executeTool = (
        request: ToolCallRequest
      ): Effect.Effect<ToolCallResult, AICoreToolExecutionError | AICoreToolNotFoundError> =>
        toolBridge.executeTool(request)

      const refreshTools = (): Effect.Effect<readonly AggregatedTool[]> =>
        toolBridge.refreshTools()

      return {
        streamChat,
        getProviders,
        getAvailableTools,
        executeTool,
        refreshTools,
      }
    })
  )

  /**
   * Test implementation
   */
  static readonly Test = Layer.succeed(
    this,
    AICoreService.of({
      streamChat: () =>
        Effect.fail(
          AICoreConnectionError.create('test', new Error('Test mode - streamChat not available'))
        ),
      getProviders: () => Effect.succeed(['anthropic', 'openai', 'claude-code'] as const),
      getAvailableTools: () => Effect.succeed([]),
      executeTool: () =>
        Effect.fail(AICoreToolExecutionError.create('test', 'test', new Error('Test mode'))),
      refreshTools: () => Effect.succeed([]),
    })
  )
}
