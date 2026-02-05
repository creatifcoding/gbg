/**
 * useAISDKProviderBridge
 *
 * React hook that creates an AISDKBridge from useChatWithTools.
 * This bridges React state management to Effect-native ChatDataProvider.
 *
 * @example
 * ```tsx
 * import { useAISDKProviderBridge } from '@/lib/ai-core/providers'
 *
 * function ChatContainer() {
 *   const { bridge, provider, messages, isStreaming } = useAISDKProviderBridge({
 *     systemPrompt: 'You are a helpful assistant',
 *   })
 *
 *   // Use provider in Effect programs
 *   const handleAction = () => {
 *     Effect.runPromise(
 *       provider.sendMessage(new SendMessageOptions({ text: 'Hello' }))
 *     )
 *   }
 *
 *   return (
 *     <div>
 *       {messages.map(m => <MessageRenderer key={m.id} message={m} />)}
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo, useCallback, useRef } from 'react'
import { Effect, Option, Stream } from 'effect'
import { useChatWithTools } from '../hooks'
import { uiMessageToChatMessage, type ChatMessage } from '../types'
import {
  type ChatDataProviderShape,
  ProviderState,
  SendMessageOptions,
  ChatSendError,
} from './ChatDataProvider'
import {
  type AISDKBridge,
  type AISDKProviderConfigShape,
} from './AISDKProvider'

// =============================================================================
// TYPES
// =============================================================================

export interface UseAISDKProviderBridgeOptions extends AISDKProviderConfigShape {
  /** Additional useChatWithTools options */
  onToolExecute?: (toolName: string, args: unknown) => void
  onToolResult?: (toolCallId: string, result: unknown, isError: boolean) => void
}

export interface UseAISDKProviderBridgeReturn {
  /** The bridge for Effect-side operations */
  bridge: AISDKBridge
  /** Provider shape for direct Effect usage */
  provider: ChatDataProviderShape
  /** Converted ChatMessage array (reactive) */
  messages: readonly ChatMessage[]
  /** Whether currently streaming */
  isStreaming: boolean
  /** Current error */
  error: Error | undefined
  /** Send message (React callback) */
  sendMessage: (text: string) => Promise<void>
  /** Abort stream (React callback) */
  abort: () => void
  /** Clear conversation (React callback) */
  clear: () => void
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAISDKProviderBridge(
  options?: UseAISDKProviderBridgeOptions
): UseAISDKProviderBridgeReturn {
  const { systemPrompt, api, mode, onToolExecute, onToolResult } = options ?? {}

  // Use the AI SDK chat hook
  const chat = useChatWithTools({
    systemPrompt,
    api,
    mode,
    onToolExecute,
    onToolResult,
  })

  // Create stable bridge reference
  const bridgeRef = useRef<AISDKBridge | null>(null)

  // Create bridge from chat hook
  const bridge: AISDKBridge = useMemo(
    () => ({
      sendMessage: async (text: string, promptOverride?: string) => {
        await chat.sendMessage({
          text,
          ...(promptOverride ? { systemPrompt: promptOverride } : {}),
        })
      },
      stop: () => chat.stop(),
      setMessages: (msgs) => chat.setMessages(msgs),
      getMessages: () => chat.messages,
      isStreaming: () => chat.isStreaming,
      getError: () => chat.error,
    }),
    [chat]
  )

  // Update ref
  bridgeRef.current = bridge

  // Convert messages to ChatMessage format
  const messages = useMemo(() => {
    const streamingId = chat.isStreaming && chat.messages.length > 0
      ? chat.messages[chat.messages.length - 1].id
      : undefined

    return chat.messages.map((m) =>
      uiMessageToChatMessage(m, m.id === streamingId)
    )
  }, [chat.messages, chat.isStreaming])

  // Create Effect-native provider shape
  const provider: ChatDataProviderShape = useMemo(
    () => ({
      id: 'ai-sdk',
      name: 'AI SDK Provider',

      getState: Effect.sync(() => {
        const msgs = bridgeRef.current?.getMessages() ?? []
        const streaming = bridgeRef.current?.isStreaming() ?? false
        const err = bridgeRef.current?.getError()

        return new ProviderState({
          status: streaming ? 'streaming' : err ? 'error' : 'idle',
          messages: msgs.map((m) => uiMessageToChatMessage(m, streaming && m.id === msgs[msgs.length - 1]?.id)),
          error: err?.message ?? null,
          isStreaming: streaming,
          streamingMessageId: streaming && msgs.length > 0 ? msgs[msgs.length - 1].id : null,
        })
      }),

      getMessages: Effect.sync(() => {
        const msgs = bridgeRef.current?.getMessages() ?? []
        const streaming = bridgeRef.current?.isStreaming() ?? false
        return msgs.map((m) =>
          uiMessageToChatMessage(m, streaming && m.id === msgs[msgs.length - 1]?.id)
        )
      }),

      isStreaming: Effect.sync(() => bridgeRef.current?.isStreaming() ?? false),

      getError: Effect.sync(() => {
        const err = bridgeRef.current?.getError()
        return err ? Option.some(err.message) : Option.none()
      }),

      sendMessage: (opts: SendMessageOptions) =>
        Effect.tryPromise({
          try: async () => {
            if (!bridgeRef.current) {
              throw new Error('Bridge not initialized')
            }
            await bridgeRef.current.sendMessage(
              opts.text,
              Option.getOrUndefined(opts.systemPrompt)
            )
          },
          catch: (cause) =>
            new ChatSendError({
              message: `Failed to send message: ${String(cause)}`,
              cause: Option.some(cause),
            }),
        }),

      abort: Effect.sync(() => {
        bridgeRef.current?.stop()
      }),

      clear: Effect.sync(() => {
        bridgeRef.current?.setMessages([])
      }),

      stateChanges: Stream.empty, // TODO: Implement reactive state changes
    }),
    [] // Stable reference - uses bridgeRef internally
  )

  // React callbacks
  const sendMessage = useCallback(
    async (text: string) => {
      await chat.sendMessage({ text })
    },
    [chat.sendMessage]
  )

  const abort = useCallback(() => {
    chat.stop()
  }, [chat.stop])

  const clear = useCallback(() => {
    chat.setMessages([])
  }, [chat.setMessages])

  return {
    bridge,
    provider,
    messages,
    isStreaming: chat.isStreaming,
    error: chat.error,
    sendMessage,
    abort,
    clear,
  }
}
