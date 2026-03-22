/**
 * AI Atoms
 *
 * Effect-atom integration for AI state management.
 * Follows Atom-as-State doctrine from CLAUDE.md.
 */

import { Atom } from '@effect-atom/atom-react'
import { Effect, Layer, Stream, Fiber, Option } from 'effect'
import { AIService, type StreamHandle } from '../services'
import type {
  AIProvider,
  ThinkingLevel,
  StreamChatRequest,
  StreamState,
  StreamStatus,
  AIStreamEvent,
  AIModelConfig,
} from '../schemas'
import { INITIAL_STREAM_STATE, THINKING_BUDGETS } from '../schemas'

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * AI runtime combining all service layers.
 */
export const aiRuntimeAtom = Atom.runtime(Layer.mergeAll(AIService.Live))

// =============================================================================
// State Atoms
// =============================================================================

/**
 * Current provider
 */
export const currentProviderAtom = Atom.make<AIProvider>('anthropic')

/**
 * Current model ID
 */
export const currentModelIdAtom = Atom.make<string>('claude-sonnet-4-20250514')

/**
 * Current thinking level
 */
export const thinkingLevelAtom = Atom.make<ThinkingLevel>('none')

/**
 * Stream state
 */
export const streamStateAtom = Atom.make<StreamState>(INITIAL_STREAM_STATE)

/**
 * Active stream handle (for aborting)
 */
export const activeStreamHandleAtom = Atom.make<StreamHandle | null>(null)

/**
 * Message history
 */
export const messagesAtom = Atom.make<readonly { role: string; content: string }[]>([])

/**
 * Available models
 */
export const availableModelsAtom = Atom.make<readonly AIModelConfig[]>([])

// =============================================================================
// Derived Atoms
// =============================================================================

/**
 * Current stream status
 */
export const streamStatusAtom = Atom.make((get) => get(streamStateAtom).status)

/**
 * Accumulated response text
 */
export const streamedTextAtom = Atom.make((get) => get(streamStateAtom).text)

/**
 * Accumulated thinking text
 */
export const thinkingTextAtom = Atom.make((get) => get(streamStateAtom).thinkingText)

/**
 * Pending tool calls
 */
export const pendingToolCallsAtom = Atom.make((get) => get(streamStateAtom).toolCalls)

/**
 * Tool results
 */
export const toolResultsAtom = Atom.make((get) => get(streamStateAtom).toolResults)

/**
 * Whether streaming is active
 */
export const isStreamingAtom = Atom.make((get) => get(streamStatusAtom) === 'streaming')

/**
 * Current thinking budget
 */
export const thinkingBudgetAtom = Atom.make((get) => THINKING_BUDGETS[get(thinkingLevelAtom)])

/**
 * Current model config
 */
export const currentModelAtom = Atom.make((get) => {
  const modelId = get(currentModelIdAtom)
  const models = get(availableModelsAtom)
  return models.find((m) => m.id === modelId)
})

// =============================================================================
// Operations (Synchronous)
// =============================================================================

/**
 * Set provider
 */
export const setProvider = (provider: AIProvider) => {
  Atom.set(currentProviderAtom, provider)
}

/**
 * Set model
 */
export const setModel = (modelId: string) => {
  Atom.set(currentModelIdAtom, modelId)
}

/**
 * Set thinking level
 */
export const setThinkingLevel = (level: ThinkingLevel) => {
  Atom.set(thinkingLevelAtom, level)
}

/**
 * Add message to history
 */
export const addMessage = (role: string, content: string) => {
  Atom.set(messagesAtom, (prev) => [...prev, { role, content }])
}

/**
 * Clear messages
 */
export const clearMessages = () => {
  Atom.set(messagesAtom, [])
}

/**
 * Reset stream state
 */
export const resetStreamState = () => {
  Atom.set(streamStateAtom, INITIAL_STREAM_STATE)
}

// =============================================================================
// Effect Operations (via runtime)
// =============================================================================

/**
 * Start streaming chat
 */
export const streamChatOp = aiRuntimeAtom.fn<{
  messages: readonly { role: string; content: string }[]
  systemPrompt?: string
}>()((args, ctx) =>
  Effect.gen(function* () {
    // Reset state
    ctx.set(streamStateAtom, {
      ...INITIAL_STREAM_STATE,
      status: 'streaming',
    })

    const provider = Atom.get(currentProviderAtom)
    const modelId = Atom.get(currentModelIdAtom)
    const thinkingLevel = Atom.get(thinkingLevelAtom)

    const ai = yield* AIService

    // Create request
    const request: StreamChatRequest = {
      provider,
      modelId,
      messages: args.messages.map((m) => ({
        role: m.role as any,
        content: m.content,
      })),
      thinking:
        thinkingLevel !== 'none'
          ? {
              type: 'enabled',
              budget: THINKING_BUDGETS[thinkingLevel],
            }
          : undefined,
      systemPrompt: args.systemPrompt,
    }

    // Start streaming
    const handle = yield* ai.streamChat(request)
    ctx.set(activeStreamHandleAtom, handle)

    // Process stream
    yield* Stream.runForEach(handle.stream, (event) =>
      Effect.sync(() => {
        const current = Atom.get(streamStateAtom)

        switch (event._tag) {
          case 'TextDelta':
            ctx.set(streamStateAtom, {
              ...current,
              text: current.text + event.text,
            })
            break

          case 'ReasoningDelta':
            ctx.set(streamStateAtom, {
              ...current,
              thinkingText: current.thinkingText + event.text,
            })
            break

          case 'ToolCall':
            ctx.set(streamStateAtom, {
              ...current,
              toolCalls: [...current.toolCalls, event],
            })
            break

          case 'ToolResult':
            ctx.set(streamStateAtom, {
              ...current,
              toolResults: [...current.toolResults, event],
            })
            break

          case 'StreamComplete':
            ctx.set(streamStateAtom, {
              ...current,
              status: 'complete',
              metadata: {
                ...current.metadata,
                completedAt: Date.now(),
              } as any,
            })
            break

          case 'StreamError':
            ctx.set(streamStateAtom, {
              ...current,
              status: 'error',
              error: event.error,
            })
            break
        }
      })
    )

    ctx.set(activeStreamHandleAtom, null)
    return handle.metadata
  })
)

/**
 * Abort active stream
 */
export const abortStreamOp = aiRuntimeAtom.fn<void>()((_args, ctx) =>
  Effect.gen(function* () {
    const handle = Atom.get(activeStreamHandleAtom)
    if (handle) {
      yield* handle.abort()
      ctx.set(activeStreamHandleAtom, null)
      ctx.set(streamStateAtom, (prev) => ({
        ...prev,
        status: 'aborted',
      }))
    }
  })
)

/**
 * Load available models
 */
export const loadModelsOp = aiRuntimeAtom.fn<void>()((_args, ctx) =>
  Effect.gen(function* () {
    const ai = yield* AIService
    const models = yield* ai.getModels()
    ctx.set(availableModelsAtom, models)
  })
)

/**
 * Check if provider is configured
 */
export const isProviderConfiguredOp = aiRuntimeAtom.fn<{ provider: AIProvider }>()(
  (args, _ctx) =>
    Effect.gen(function* () {
      const ai = yield* AIService
      return yield* ai.isProviderConfigured(args.provider)
    })
)
