/**
 * useChatWithTools Hook
 *
 * Thin wrapper around @ai-sdk/react useChat that bridges to ToolBridge Effect.Service
 * for MCP tool execution.
 *
 * This is Phase 1 of the ai-core migration: establishing the useChat foundation
 * with proper tool execution bridging.
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const {
 *     messages,
 *     input,
 *     handleInputChange,
 *     handleSubmit,
 *     isStreaming,
 *     latestMessage,
 *   } = useChatWithTools({
 *     systemPrompt: 'You are a helpful assistant',
 *     onToolExecute: (name, args) => console.log('Tool called:', name),
 *     onToolResult: (id, result, isError) => console.log('Tool result:', result),
 *   })
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input value={input} onChange={handleInputChange} />
 *       <button type="submit" disabled={isStreaming}>Send</button>
 *     </form>
 *   )
 * }
 * ```
 */

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useCallback, useMemo, useRef } from 'react'
import { Effect, Layer, Data } from 'effect'
import { ToolCallRequest, ToolCallResult } from '../schemas'
import { ToolBridge } from '../services/ToolBridge'
import { MCPClientRegistry } from '@/lib/mcp/services'

// =============================================================================
// Effect Error Types
// =============================================================================

/** Network-level failure (server unreachable, DNS, etc.) */
export class ChatConnectionError extends Data.TaggedError('ChatConnectionError')<{
  readonly url: string
  readonly cause: unknown
}> {}

/** Server returned non-2xx status */
export class ChatServerError extends Data.TaggedError('ChatServerError')<{
  readonly url: string
  readonly status: number
  readonly statusText: string
  readonly body?: string
}> {}

/** Tool execution failed */
export class ChatToolError extends Data.TaggedError('ChatToolError')<{
  readonly toolName: string
  readonly toolCallId: string
  readonly cause: unknown
}> {}

// =============================================================================
// Types
// =============================================================================

export interface UseChatWithToolsOptions {
  /** API endpoint for chat. Default: '/api/chat' (proxied by Vite to cursor server) */
  api?: string
  /** System prompt to include in requests */
  systemPrompt?: string
  /** Chat mode - 'terminal' enables tools, 'cursor' disables. Default: 'terminal' */
  mode?: 'terminal' | 'cursor'
  /** Initial messages to populate the chat (for persistence restoration) */
  messages?: ReturnType<typeof useChat>['messages']
  /** Callback when a tool execution starts */
  onToolExecute?: (toolName: string, args: unknown) => void
  /** Callback when a tool execution completes */
  onToolResult?: (toolCallId: string, result: unknown, isError: boolean) => void
  /**
   * Custom tool executor for testing or alternative implementations.
   * When provided, bypasses ToolBridge and uses this function instead.
   */
  toolExecutor?: (request: ToolCallRequest) => Promise<ToolCallResult>
}

export interface UseChatWithToolsReturn {
  // Core useChat returns (AI SDK 5.0+ API)
  messages: ReturnType<typeof useChat>['messages']
  /** Send a message to the chat API (replaces append in SDK 5.0+) */
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  /** Regenerate the last AI response */
  regenerate: ReturnType<typeof useChat>['regenerate']
  stop: ReturnType<typeof useChat>['stop']
  setMessages: ReturnType<typeof useChat>['setMessages']
  error: ReturnType<typeof useChat>['error']
  status: ReturnType<typeof useChat>['status']

  // Convenience accessors
  /** The most recent message in the conversation */
  latestMessage: ReturnType<typeof useChat>['messages'][number] | undefined
  /** Whether the chat is currently streaming or waiting for response */
  isStreaming: boolean
  /** Whether there are any messages in the conversation */
  hasMessages: boolean
}

// =============================================================================
// Layer Composition
// =============================================================================

/**
 * Composed layer for ToolBridge with MCPClientRegistry dependency
 */
const ToolBridgeLive = ToolBridge.Live.pipe(Layer.provide(MCPClientRegistry.Live))

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChatWithTools(options?: UseChatWithToolsOptions): UseChatWithToolsReturn {
  const {
    api = '/api/chat',
    systemPrompt,
    mode = 'terminal',
    messages: initialMessages,
    onToolExecute,
    onToolResult,
    toolExecutor,
  } = options ?? {}

  // Ref to hold addToolOutput - populated after useChat is called
  const addToolOutputRef = useRef<ReturnType<typeof useChat>['addToolOutput'] | null>(null)

  // Tool call handler that bridges to ToolBridge Effect.Service
  // AI SDK 5.0+ uses `input` property for tool arguments
  const handleToolCall = useCallback(
    async ({
      toolCall,
    }: {
      toolCall: { toolCallId: string; toolName: string; input: unknown }
    }): Promise<void> => {
      const toolInput = toolCall.input

      // Notify caller that tool execution is starting
      onToolExecute?.(toolCall.toolName, toolInput)

      // Create ToolCallRequest
      const request = new ToolCallRequest({
        callId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        serverId: null, // Will be resolved by ToolBridge
        args: toolInput,
        requestedAt: Date.now(),
      })

      // Execute tool with Effect error handling
      const toolEffect = toolExecutor
        ? Effect.tryPromise({
            try: () => toolExecutor(request),
            catch: (cause) => new ChatToolError({ toolName: toolCall.toolName, toolCallId: toolCall.toolCallId, cause }),
          })
        : ToolBridge.pipe(
            Effect.flatMap((bridge) => bridge.executeTool(request)),
            Effect.provide(ToolBridgeLive),
            Effect.mapError((cause) => new ChatToolError({ toolName: toolCall.toolName, toolCallId: toolCall.toolCallId, cause }))
          )

      const result = await Effect.runPromise(
        toolEffect.pipe(
          Effect.tap((res) =>
            Effect.sync(() => onToolResult?.(toolCall.toolCallId, res.result, !res.success))
          ),
          Effect.catchTag('ChatToolError', (error) =>
            Effect.sync(() => {
              console.error(`[useChatWithTools] Tool "${error.toolName}" failed:`, error.cause)
              onToolResult?.(toolCall.toolCallId, { error: String(error.cause) }, true)
              return null
            })
          )
        )
      )

      // CRITICAL: Send tool result back to AI SDK so it appears in the UI
      // and the model can continue the conversation with the result
      // NOTE: We await addToolOutput to ensure the message state is updated
      if (addToolOutputRef.current) {
        try {
          if (result === null) {
            // Error case - tool execution failed
            await addToolOutputRef.current({
              tool: toolCall.toolName as never, // Type cast needed for dynamic tool names
              toolCallId: toolCall.toolCallId,
              state: 'output-error',
              errorText: 'Tool execution failed',
            })
          } else if (result.success) {
            // Success case
            await addToolOutputRef.current({
              tool: toolCall.toolName as never, // Type cast needed for dynamic tool names
              toolCallId: toolCall.toolCallId,
              output: result.result as never, // Type cast for dynamic output
            })
          } else {
            // Tool returned an error result
            await addToolOutputRef.current({
              tool: toolCall.toolName as never, // Type cast needed for dynamic tool names
              toolCallId: toolCall.toolCallId,
              state: 'output-error',
              errorText: result.error ?? 'Unknown error',
            })
          }
        } catch (err) {
          console.error('[useChatWithTools] Failed to add tool output:', err)
        }
      } else {
        console.warn('[useChatWithTools] addToolOutputRef not available')
      }
    },
    [onToolExecute, onToolResult, toolExecutor]
  )

  // Use the AI SDK useChat hook with our tool call handler
  // AI SDK 5.0+ uses transport for API configuration
  const chat = useChat({
    transport: new DefaultChatTransport({
      api,
      body: {
        mode,
        ...(systemPrompt ? { systemPrompt } : {}),
      },
    }),
    messages: initialMessages,
    onToolCall: handleToolCall,
  })

  // Store addToolOutput in ref immediately (synchronous) so handleToolCall can access it
  // This works because useChat returns a stable reference and React renders synchronously
  addToolOutputRef.current = chat.addToolOutput

  // Compute convenience accessors
  const latestMessage = useMemo(
    () => (chat.messages.length > 0 ? chat.messages[chat.messages.length - 1] : undefined),
    [chat.messages]
  )

  const isStreaming = useMemo(
    () => chat.status === 'streaming' || chat.status === 'submitted',
    [chat.status]
  )

  const hasMessages = useMemo(() => chat.messages.length > 0, [chat.messages.length])

  return {
    // Core useChat returns (AI SDK 5.0+ API)
    messages: chat.messages,
    sendMessage: chat.sendMessage,
    regenerate: chat.regenerate,
    stop: chat.stop,
    setMessages: chat.setMessages,
    error: chat.error,
    status: chat.status,

    // Convenience accessors
    latestMessage,
    isStreaming,
    hasMessages,
  }
}
