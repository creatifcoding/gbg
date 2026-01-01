/**
 * SSEAdapter Service
 *
 * Pure Effect SSE stream parsing without try/catch, mutable let, or while loops.
 * Converts ReadableStream<Uint8Array> into Effect.Stream<AIStreamEvent>.
 *
 * Features:
 * - AI SDK 5.0+ SSE format parsing
 * - Effect.Ref for buffer state
 * - Effect.addFinalizer for cleanup
 * - Effect.withSpan for observability
 */

import { Context, Effect, Layer, Stream, Ref, Chunk, Option, pipe } from 'effect'
import {
  TextDelta,
  StreamComplete,
  StreamError,
  ToolCallStart,
  ToolCallComplete,
  ToolResult,
  type AIStreamEvent,
  type FinishReason,
  TokenUsage,
} from '../schemas'
import { AICoreStreamError } from '../schemas/errors'

// =============================================================================
// Types
// =============================================================================

/**
 * SSE line types from AI SDK
 */
type SSELineType =
  | { type: '0'; content: string } // Text delta
  | { type: '9'; content: unknown } // Tool call
  | { type: 'a'; content: unknown } // Tool result
  | { type: 'd'; content: unknown } // Finish
  | { type: 'e'; content: unknown } // Error
  | { type: 'unknown'; raw: string }

// =============================================================================
// Service Shape
// =============================================================================

export interface SSEAdapterShape {
  /**
   * Parse a ReadableStream of bytes into a Stream of AIStreamEvents
   */
  readonly fromReadableStream: (
    readable: ReadableStream<Uint8Array>
  ) => Effect.Effect<Stream.Stream<AIStreamEvent, AICoreStreamError>, AICoreStreamError>

  /**
   * Parse a single SSE line into an event (if applicable)
   */
  readonly parseLine: (line: string) => Effect.Effect<Option.Option<AIStreamEvent>>
}

// =============================================================================
// Service Tag
// =============================================================================

export class SSEAdapter extends Context.Tag('tmnl/ai-core/SSEAdapter')<SSEAdapter, SSEAdapterShape>() {
  /**
   * Live implementation
   */
  static readonly Live = Layer.succeed(
    this,
    SSEAdapter.of({
      fromReadableStream: (readable) =>
        Effect.gen(function* () {
          const reader = readable.getReader()
          const decoder = new TextDecoder()

          // Use Ref for buffer state (no mutable let)
          const bufferRef = yield* Ref.make('')

          // Create async stream with proper cleanup
          const stream = Stream.async<AIStreamEvent, AICoreStreamError>((emit) => {
            const processChunks = Effect.gen(function* () {
              // Read loop using Effect recursion (no while)
              const readLoop: Effect.Effect<void, AICoreStreamError> = Effect.gen(function* () {
                const readResult = yield* Effect.tryPromise({
                  try: () => reader.read(),
                  catch: (e) =>
                    AICoreStreamError.create(
                      'read',
                      e instanceof Error ? e.message : String(e)
                    ),
                })

                if (readResult.done) {
                  // Process remaining buffer
                  const remaining = yield* Ref.get(bufferRef)
                  if (remaining.trim()) {
                    const event = yield* parseSingleLine(remaining.trim())
                    if (Option.isSome(event)) {
                      emit.single(event.value)
                    }
                  }
                  emit.end()
                  return
                }

                // Decode and buffer
                const text = decoder.decode(readResult.value, { stream: true })
                const buffer = yield* Ref.get(bufferRef)
                const combined = buffer + text
                const lines = combined.split('\n')

                // Keep last incomplete line in buffer
                const lastLine = lines.pop() ?? ''
                yield* Ref.set(bufferRef, lastLine)

                // Process complete lines
                for (const line of lines) {
                  const trimmed = line.trim()
                  if (!trimmed) continue

                  const event = yield* parseSingleLine(trimmed)
                  if (Option.isSome(event)) {
                    emit.single(event.value)
                  }
                }

                // Continue reading
                yield* readLoop
              })

              yield* readLoop
            }).pipe(
              Effect.catchAll((error) => {
                emit.fail(error)
                return Effect.void
              })
            )

            // Run the processing loop
            Effect.runFork(processChunks)

            // Return cleanup function
            return Effect.sync(() => {
              reader.cancel().catch(() => {})
            })
          })

          return stream
        }).pipe(Effect.withSpan('SSEAdapter.fromReadableStream')),

      parseLine: (line) => parseSingleLine(line),
    })
  )
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Parse a single SSE line into type + content
 */
const parseSSELine = (line: string): SSELineType => {
  // AI SDK format: <type>:<json>
  // e.g., 0:"hello" for text, d:{...} for finish
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) {
    return { type: 'unknown', raw: line }
  }

  const type = line.slice(0, colonIndex)
  const content = line.slice(colonIndex + 1)

  switch (type) {
    case '0': // Text delta
      return { type: '0', content }
    case '9': // Tool call
      try {
        return { type: '9', content: JSON.parse(content) }
      } catch {
        return { type: 'unknown', raw: line }
      }
    case 'a': // Tool result
      try {
        return { type: 'a', content: JSON.parse(content) }
      } catch {
        return { type: 'unknown', raw: line }
      }
    case 'd': // Finish
      try {
        return { type: 'd', content: JSON.parse(content) }
      } catch {
        return { type: 'unknown', raw: line }
      }
    case 'e': // Error
      try {
        return { type: 'e', content: JSON.parse(content) }
      } catch {
        return { type: 'e', content: { message: content } }
      }
    default:
      return { type: 'unknown', raw: line }
  }
}

/**
 * Parse text delta content (0:"text")
 */
const parseTextDelta = (content: string): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    // Content is JSON string, e.g., "hello world"
    try {
      const text = JSON.parse(content)
      if (typeof text === 'string') {
        return Option.some(new TextDelta({ text, accumulated: null }))
      }
    } catch {
      // Not valid JSON, might be raw text
      return Option.some(new TextDelta({ text: content, accumulated: null }))
    }
    return Option.none()
  })

/**
 * Parse tool call (9:{...})
 */
const parseToolCall = (content: unknown): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    if (typeof content !== 'object' || content === null) {
      return Option.none()
    }

    const obj = content as Record<string, unknown>

    // Check if it's a tool call start or complete
    if ('toolCallId' in obj && 'toolName' in obj) {
      if ('args' in obj) {
        // Complete tool call
        return Option.some(
          new ToolCallComplete({
            toolCallId: String(obj.toolCallId),
            toolName: String(obj.toolName),
            args: obj.args,
            serverId: 'serverId' in obj ? String(obj.serverId) : null,
          })
        )
      } else {
        // Tool call start
        return Option.some(
          new ToolCallStart({
            toolCallId: String(obj.toolCallId),
            toolName: String(obj.toolName),
            serverId: 'serverId' in obj ? String(obj.serverId) : null,
          })
        )
      }
    }

    return Option.none()
  })

/**
 * Parse tool result (a:{...})
 */
const parseToolResult = (content: unknown): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    if (typeof content !== 'object' || content === null) {
      return Option.none()
    }

    const obj = content as Record<string, unknown>

    if ('toolCallId' in obj && 'result' in obj) {
      return Option.some(
        new ToolResult({
          toolCallId: String(obj.toolCallId),
          toolName: 'toolName' in obj ? String(obj.toolName) : 'unknown',
          result: obj.result,
          isError: 'isError' in obj ? Boolean(obj.isError) : false,
          errorMessage: 'errorMessage' in obj ? String(obj.errorMessage) : null,
        })
      )
    }

    return Option.none()
  })

/**
 * Parse finish message (d:{...})
 */
const parseFinish = (content: unknown): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    if (typeof content !== 'object' || content === null) {
      return Option.some(
        new StreamComplete({
          finishReason: 'unknown',
          usage: null,
          durationMs: null,
        })
      )
    }

    const obj = content as Record<string, unknown>
    const finishReason = (obj.finishReason as FinishReason) ?? 'stop'

    let usage: TokenUsage | null = null
    if ('usage' in obj && typeof obj.usage === 'object' && obj.usage !== null) {
      const u = obj.usage as Record<string, unknown>
      usage = new TokenUsage({
        promptTokens: Number(u.promptTokens ?? 0),
        completionTokens: Number(u.completionTokens ?? 0),
        totalTokens: Number(u.totalTokens ?? 0),
        cacheReadTokens: u.cacheReadTokens != null ? Number(u.cacheReadTokens) : null,
        cacheCreationTokens: u.cacheCreationTokens != null ? Number(u.cacheCreationTokens) : null,
      })
    }

    return Option.some(
      new StreamComplete({
        finishReason,
        usage,
        durationMs: null,
      })
    )
  })

/**
 * Parse error message (e:{...})
 */
const parseError = (content: unknown): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    const message =
      typeof content === 'object' && content !== null && 'message' in content
        ? String((content as Record<string, unknown>).message)
        : typeof content === 'string'
          ? content
          : 'Unknown error'

    return Option.some(
      new StreamError({
        error: message,
        retryable: false,
        cause: content ?? null,
      })
    )
  })

/**
 * Parse a single SSE line into an event
 */
const parseSingleLine = (line: string): Effect.Effect<Option.Option<AIStreamEvent>> =>
  Effect.gen(function* () {
    const parsed = parseSSELine(line)

    switch (parsed.type) {
      case '0':
        return yield* parseTextDelta(parsed.content)
      case '9':
        return yield* parseToolCall(parsed.content)
      case 'a':
        return yield* parseToolResult(parsed.content)
      case 'd':
        return yield* parseFinish(parsed.content)
      case 'e':
        return yield* parseError(parsed.content)
      case 'unknown':
        // Ignore unknown line types (3:, 8:, f:, etc.)
        return Option.none()
    }
  })
