/**
 * AIService
 *
 * Effect.Service for AI streaming and chat operations.
 * Integrates with Vercel AI SDK and Claude Agent SDK.
 *
 * Features:
 * - Multi-provider support (Anthropic, OpenAI, Claude Code)
 * - Streaming responses via Effect.Stream
 * - Extended thinking support
 * - MCP tool integration
 */

import { Context, Effect, Layer, Stream, Ref, Queue, Option, Fiber } from 'effect'
import type {
  AIProvider,
  StreamChatRequest,
  AIStreamEvent,
  StreamState,
  ThinkingLevel,
  AIModelConfig,
} from '../schemas'
import { THINKING_BUDGETS, DEFAULT_MODELS, INITIAL_STREAM_STATE } from '../schemas'

// =============================================================================
// Stream Handle
// =============================================================================

export interface StreamHandle {
  /** The stream of AI events */
  readonly stream: Stream.Stream<AIStreamEvent, Error>
  /** Abort the stream */
  readonly abort: () => Effect.Effect<void>
  /** Stream metadata */
  readonly metadata: {
    readonly requestId: string
    readonly provider: AIProvider
    readonly modelId: string
    readonly startedAt: number
  }
}

// =============================================================================
// Service Shape
// =============================================================================

export interface AIServiceShape {
  /**
   * Start a streaming chat session
   */
  readonly streamChat: (request: StreamChatRequest) => Effect.Effect<StreamHandle>

  /**
   * Get available providers
   */
  readonly getProviders: () => Effect.Effect<readonly AIProvider[]>

  /**
   * Check if a provider is configured (has API key)
   */
  readonly isProviderConfigured: (provider: AIProvider) => Effect.Effect<boolean>

  /**
   * Get available models
   */
  readonly getModels: () => Effect.Effect<readonly AIModelConfig[]>

  /**
   * Get token budget for thinking level
   */
  readonly getThinkingBudget: (level: ThinkingLevel) => number
}

// =============================================================================
// Service Tag
// =============================================================================

export class AIService extends Context.Tag('tmnl/ai/AIService')<AIService, AIServiceShape>() {
  /**
   * Live implementation
   */
  static readonly Live = Layer.effect(
    this,
    Effect.gen(function* () {
      // Check for Tauri runtime
      const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

      const streamChat = (request: StreamChatRequest): Effect.Effect<StreamHandle> =>
        Effect.gen(function* () {
          const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const startedAt = Date.now()

          // Create event queue
          const eventQueue = yield* Queue.unbounded<AIStreamEvent>()

          // Abort controller
          const abortRef = yield* Ref.make(false)

          // Create the stream
          const stream = Stream.fromQueue(eventQueue).pipe(
            Stream.takeUntil(() => Effect.gen(function* () {
              return yield* Ref.get(abortRef)
            }))
          )

          // Abort function
          const abort = (): Effect.Effect<void> =>
            Effect.gen(function* () {
              yield* Ref.set(abortRef, true)
              yield* Queue.offer(eventQueue, {
                _tag: 'StreamComplete',
                finishReason: 'aborted',
              })
            })

          // Start streaming in background
          const streamingFiber = yield* Effect.fork(
            Effect.gen(function* () {
              try {
                // For now, emit a mock response
                // TODO: Integrate with actual AI SDK

                // Emit text delta
                yield* Queue.offer(eventQueue, {
                  _tag: 'TextDelta',
                  text: 'AI streaming is configured. ',
                })

                yield* Effect.sleep(100)

                yield* Queue.offer(eventQueue, {
                  _tag: 'TextDelta',
                  text: `Provider: ${request.provider}, Model: ${request.modelId}`,
                })

                yield* Effect.sleep(100)

                // Complete
                yield* Queue.offer(eventQueue, {
                  _tag: 'StreamComplete',
                  finishReason: 'stop',
                  usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                  },
                })
              } catch (error) {
                yield* Queue.offer(eventQueue, {
                  _tag: 'StreamError',
                  error: error instanceof Error ? error.message : String(error),
                })
              }
            })
          )

          return {
            stream,
            abort,
            metadata: {
              requestId,
              provider: request.provider,
              modelId: request.modelId,
              startedAt,
            },
          }
        })

      const getProviders = (): Effect.Effect<readonly AIProvider[]> =>
        Effect.succeed(['anthropic', 'openai', 'claude-code'] as const)

      const isProviderConfigured = (provider: AIProvider): Effect.Effect<boolean> =>
        Effect.gen(function* () {
          // Claude Code doesn't need API key
          if (provider === 'claude-code') {
            return true
          }

          // For browser/Tauri, we'd need to check env vars
          // For now, return true in dev mode
          if (typeof process !== 'undefined' && process.env) {
            if (provider === 'anthropic') {
              return !!process.env.ANTHROPIC_API_KEY
            }
            if (provider === 'openai') {
              return !!process.env.OPENAI_API_KEY
            }
          }

          // In browser, assume configured if we're in Tauri
          return isTauri
        })

      const getModels = (): Effect.Effect<readonly AIModelConfig[]> =>
        Effect.succeed(DEFAULT_MODELS)

      const getThinkingBudget = (level: ThinkingLevel): number =>
        THINKING_BUDGETS[level]

      return {
        streamChat,
        getProviders,
        isProviderConfigured,
        getModels,
        getThinkingBudget,
      }
    })
  )

  /**
   * Test implementation
   */
  static readonly Test = Layer.succeed(
    this,
    AIService.of({
      streamChat: () => Effect.fail(new Error('Test AI service - streamChat not implemented')),
      getProviders: () => Effect.succeed(['anthropic', 'openai', 'claude-code'] as const),
      isProviderConfigured: () => Effect.succeed(false),
      getModels: () => Effect.succeed(DEFAULT_MODELS),
      getThinkingBudget: (level) => THINKING_BUDGETS[level],
    })
  )
}
