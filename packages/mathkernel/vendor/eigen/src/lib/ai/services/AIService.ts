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
// Helpers
// =============================================================================

/**
 * Cursor chat server URL (Claude Code backend)
 */
const CURSOR_CHAT_URL = 'http://localhost:7682/chat'

/**
 * Process AI SDK SSE event and emit to queue
 * Handles AI SDK 5.0+ UIMessage stream format
 */
function processAISDKEvent(
  line: string,
  eventQueue: Queue.Queue<AIStreamEvent>
): Effect.Effect<void> {
  return Effect.gen(function* () {
    // AI SDK uses different SSE format
    // Lines can be: 0:"text", d:{...}, e:{...}
    if (line.startsWith('0:')) {
      // Text delta: 0:"content"
      const text = line.slice(2)
      try {
        const parsed = JSON.parse(text)
        if (typeof parsed === 'string') {
          yield* Queue.offer(eventQueue, {
            _tag: 'TextDelta',
            text: parsed,
          })
        }
      } catch {
        // Malformed, skip
      }
    } else if (line.startsWith('d:')) {
      // Finish message: d:{"finishReason":"stop",...}
      try {
        const data = JSON.parse(line.slice(2))
        if (data.finishReason) {
          yield* Queue.offer(eventQueue, {
            _tag: 'StreamComplete',
            finishReason: data.finishReason,
            usage: data.usage ? {
              promptTokens: data.usage.promptTokens ?? 0,
              completionTokens: data.usage.completionTokens ?? 0,
              totalTokens: data.usage.totalTokens ?? 0,
            } : undefined,
          })
        }
      } catch {
        // Malformed, skip
      }
    } else if (line.startsWith('e:')) {
      // Error message
      try {
        const data = JSON.parse(line.slice(2))
        yield* Queue.offer(eventQueue, {
          _tag: 'StreamError',
          error: data.message ?? 'Unknown error',
        })
      } catch {
        // Malformed, skip
      }
    }
    // Ignore other line types (3:, 8:, f:, etc.)
  })
}

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
              const aborted = yield* Ref.get(abortRef)
              if (aborted) return

              try {
                // Convert messages to AI SDK format (parts array)
                const aiSdkMessages = request.messages.map((m) => ({
                  role: m.role,
                  parts: [{
                    type: 'text' as const,
                    text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
                  }],
                }))

                // Make streaming request to cursor chat server (Claude Code backend)
                const response = yield* Effect.tryPromise({
                  try: async () => {
                    return fetch(CURSOR_CHAT_URL, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        messages: aiSdkMessages,
                      }),
                    })
                  },
                  catch: (e) => new Error(`Failed to connect to cursor server: ${e}. Is it running? (bun run cursor:server)`),
                })

                if (!response.ok) {
                  const errorText = yield* Effect.tryPromise({
                    try: () => response.text(),
                    catch: () => 'Unknown error',
                  })
                  yield* Queue.offer(eventQueue, {
                    _tag: 'StreamError',
                    error: `Cursor server error (${response.status}): ${errorText}`,
                  })
                  return
                }

                const reader = response.body?.getReader()
                if (!reader) {
                  yield* Queue.offer(eventQueue, {
                    _tag: 'StreamError',
                    error: 'No response body from cursor server',
                  })
                  return
                }

                const decoder = new TextDecoder()
                let buffer = ''

                // Process AI SDK SSE stream
                while (true) {
                  const aborted = yield* Ref.get(abortRef)
                  if (aborted) {
                    reader.cancel()
                    break
                  }

                  const { done, value } = yield* Effect.tryPromise({
                    try: () => reader.read(),
                    catch: (e) => new Error(`Stream read error: ${e}`),
                  })

                  if (done) break

                  buffer += decoder.decode(value, { stream: true })
                  const lines = buffer.split('\n')
                  buffer = lines.pop() ?? ''

                  for (const line of lines) {
                    if (!line.trim()) continue
                    yield* processAISDKEvent(line, eventQueue)
                  }
                }

                // Ensure complete is sent if not already
                yield* Queue.offer(eventQueue, {
                  _tag: 'StreamComplete',
                  finishReason: 'stop',
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
