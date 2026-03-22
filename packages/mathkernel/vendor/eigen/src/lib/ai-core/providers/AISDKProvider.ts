/**
 * AISDKProvider
 *
 * ChatDataProvider implementation wrapping useChatWithTools hook.
 * Bridges React-land (@ai-sdk/react useChat) to Effect-land.
 *
 * This provider creates Effect-native operations from the AI SDK hook's
 * imperative methods, enabling clean service composition.
 *
 * @example
 * ```tsx
 * import { AISDKProvider, ChatDataProvider } from '@/lib/ai-core/providers'
 *
 * // Create layer with configuration
 * const MyProviderLayer = AISDKProvider.layer({
 *   systemPrompt: 'You are a helpful assistant',
 * })
 *
 * // Use in Effect
 * const program = Effect.gen(function* () {
 *   const provider = yield* ChatDataProvider
 *   yield* provider.sendMessage(new SendMessageOptions({ text: 'Hello' }))
 * }).pipe(Effect.provide(MyProviderLayer))
 * ```
 */

import { Context, Effect, Layer, Stream, Option, Ref, PubSub } from 'effect'
import type { UIMessage } from 'ai'
import {
  ChatDataProvider,
  ChatSendError,
  ProviderState,
  SendMessageOptions,
  type ChatDataProviderShape,
} from './ChatDataProvider'
import { uiMessageToChatMessage, type ChatMessage } from '../types'

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuration for AISDKProvider
 */
export interface AISDKProviderConfigShape {
  /** System prompt for the chat */
  systemPrompt?: string
  /** API endpoint (default: '/api/chat') */
  api?: string
  /** Chat mode (default: 'terminal') */
  mode?: 'terminal' | 'cursor'
  /** Initial messages to restore */
  initialMessages?: UIMessage[]
  /** Storage key for persistence (optional) */
  storageKey?: string
}

/**
 * Configuration service for AISDKProvider
 */
export class AISDKProviderConfig extends Context.Tag('tmnl/ai-core/AISDKProviderConfig')<
  AISDKProviderConfig,
  AISDKProviderConfigShape
>() {
  static Default = Layer.succeed(this, {
    systemPrompt: undefined,
    api: '/api/chat',
    mode: 'terminal' as const,
    initialMessages: undefined,
    storageKey: undefined,
  })

  static Custom = (config: AISDKProviderConfigShape) => Layer.succeed(this, config)
}

// =============================================================================
// BRIDGE STATE
// =============================================================================

/**
 * Internal state managed by the provider.
 * This is the Effect-side state that mirrors React hook state.
 */
interface BridgeState {
  messages: readonly ChatMessage[]
  isStreaming: boolean
  error: string | null
  streamingMessageId: string | null
}

/**
 * Bridge interface - this is what the React hook adapter provides
 */
export interface AISDKBridge {
  /** Send a message */
  sendMessage: (text: string, systemPrompt?: string) => Promise<void>
  /** Stop current stream */
  stop: () => void
  /** Set messages (for restoration/clearing) */
  setMessages: (messages: UIMessage[]) => void
  /** Get current messages */
  getMessages: () => UIMessage[]
  /** Check if streaming */
  isStreaming: () => boolean
  /** Get current error */
  getError: () => Error | undefined
}

/**
 * Bridge service tag - injected by React adapter
 */
export class AISDKBridgeService extends Context.Tag('tmnl/ai-core/AISDKBridgeService')<
  AISDKBridgeService,
  AISDKBridge
>() {}

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Create AISDKProvider shape from bridge
 */
const createAISDKProviderShape = (
  bridge: AISDKBridge,
  stateRef: Ref.Ref<BridgeState>,
  pubsub: PubSub.PubSub<ProviderState>
): ChatDataProviderShape => ({
  id: 'ai-sdk',
  name: 'AI SDK Provider',

  getState: Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    return new ProviderState({
      status: state.isStreaming ? 'streaming' : state.error ? 'error' : 'idle',
      messages: state.messages as unknown[],
      error: state.error,
      isStreaming: state.isStreaming,
      streamingMessageId: state.streamingMessageId,
    })
  }),

  getMessages: Ref.get(stateRef).pipe(Effect.map((s) => s.messages)),

  isStreaming: Ref.get(stateRef).pipe(Effect.map((s) => s.isStreaming)),

  getError: Ref.get(stateRef).pipe(
    Effect.map((s) => (s.error ? Option.some(s.error) : Option.none()))
  ),

  sendMessage: (options: SendMessageOptions) =>
    Effect.gen(function* () {
      const text = options.text
      const systemPrompt = Option.getOrUndefined(options.systemPrompt)

      // Update state to streaming
      yield* Ref.update(stateRef, (s) => ({
        ...s,
        isStreaming: true,
        error: null,
      }))

      // Publish state change
      const state = yield* Ref.get(stateRef)
      yield* PubSub.publish(
        pubsub,
        new ProviderState({
          status: 'streaming',
          messages: state.messages as unknown[],
          error: null,
          isStreaming: true,
          streamingMessageId: null,
        })
      )

      // Execute via bridge
      yield* Effect.tryPromise({
        try: () => bridge.sendMessage(text, systemPrompt),
        catch: (cause) =>
          new ChatSendError({
            message: `Failed to send message: ${String(cause)}`,
            cause: Option.some(cause),
          }),
      })

      // After completion, sync state from bridge
      yield* syncStateFromBridge(bridge, stateRef, pubsub)
    }),

  abort: Effect.sync(() => bridge.stop()),

  clear: Effect.gen(function* () {
    bridge.setMessages([])
    yield* Ref.set(stateRef, {
      messages: [],
      isStreaming: false,
      error: null,
      streamingMessageId: null,
    })
    yield* PubSub.publish(
      pubsub,
      new ProviderState({
        status: 'idle',
        messages: [],
        error: null,
        isStreaming: false,
        streamingMessageId: null,
      })
    )
  }),

  stateChanges: Stream.fromPubSub(pubsub),
})

/**
 * Sync Effect state from React bridge
 */
const syncStateFromBridge = (
  bridge: AISDKBridge,
  stateRef: Ref.Ref<BridgeState>,
  pubsub: PubSub.PubSub<ProviderState>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const uiMessages = bridge.getMessages()
    const isStreaming = bridge.isStreaming()
    const error = bridge.getError()

    // Convert messages
    const messages = uiMessages.map((m, i) =>
      uiMessageToChatMessage(m, isStreaming && i === uiMessages.length - 1)
    )

    // Get streaming message ID
    const streamingMessageId =
      isStreaming && uiMessages.length > 0 ? uiMessages[uiMessages.length - 1].id : null

    // Update ref
    yield* Ref.set(stateRef, {
      messages,
      isStreaming,
      error: error?.message ?? null,
      streamingMessageId,
    })

    // Publish update
    yield* PubSub.publish(
      pubsub,
      new ProviderState({
        status: isStreaming ? 'streaming' : error ? 'error' : 'idle',
        messages: messages as unknown[],
        error: error?.message ?? null,
        isStreaming,
        streamingMessageId,
      })
    )
  })

// =============================================================================
// LAYER FACTORY
// =============================================================================

/**
 * Create AISDKProvider layer with effectful construction.
 *
 * This layer requires AISDKBridgeService to be provided from React.
 */
const AISDKProviderLive = Layer.effect(
  ChatDataProvider,
  Effect.gen(function* () {
    const bridge = yield* AISDKBridgeService

    // Create internal state
    const stateRef = yield* Ref.make<BridgeState>({
      messages: [],
      isStreaming: false,
      error: null,
      streamingMessageId: null,
    })

    // Create pubsub for state changes
    const pubsub = yield* PubSub.unbounded<ProviderState>()

    // Initial sync
    yield* syncStateFromBridge(bridge, stateRef, pubsub)

    // Create shape
    return createAISDKProviderShape(bridge, stateRef, pubsub)
  })
)

// =============================================================================
// EXPORTS
// =============================================================================

export const AISDKProvider = {
  /**
   * Layer that provides ChatDataProvider using AI SDK bridge.
   * Requires AISDKBridgeService to be provided from React.
   */
  Default: AISDKProviderLive,

  /**
   * Create a layer with custom configuration.
   * The config is used by the React hook adapter.
   */
  layer: (config: AISDKProviderConfigShape) =>
    AISDKProviderLive.pipe(Layer.provide(AISDKProviderConfig.Custom(config))),

  /**
   * Sync state from bridge (utility for React adapter)
   */
  syncState: syncStateFromBridge,
}
