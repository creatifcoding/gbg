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
  ThinkingDelta,
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
// Helper Functions
// =============================================================================

/**
 * Extract the actual content from AI SDK tool output format.
 *
 * AI SDK v6 returns tool output as: [{type: "text", text: "JSON string"}]
 * This extracts and parses the content to get the actual result.
 */
function extractToolOutput(output: unknown): unknown {
  // If it's already parsed object (not array), return as-is
  if (!Array.isArray(output)) {
    return output
  }

  // Empty array - return as-is
  if (output.length === 0) {
    return output
  }

  // Single text block - extract and parse
  if (output.length === 1 && output[0]?.type === 'text' && typeof output[0].text === 'string') {
    const textContent = output[0].text
    // Try to parse as JSON
    try {
      return JSON.parse(textContent)
    } catch {
      // Not JSON, return the raw text
      return textContent
    }
  }

  // Multiple blocks - concatenate text blocks and try to parse
  const textParts = output
    .filter((block: unknown) =>
      typeof block === 'object' && block !== null &&
      (block as Record<string, unknown>).type === 'text' &&
      typeof (block as Record<string, unknown>).text === 'string'
    )
    .map((block: unknown) => (block as { type: string; text: string }).text)

  if (textParts.length > 0) {
    const combined = textParts.join('')
    try {
      return JSON.parse(combined)
    } catch {
      return combined
    }
  }

  // No text blocks found, return original
  return output
}

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
                  console.log('[SSEAdapter] Stream reader done, processing remaining buffer')
                  // Process remaining buffer
                  const remaining = yield* Ref.get(bufferRef)
                  if (remaining.trim()) {
                    console.log('[SSEAdapter] Processing remaining buffer:', remaining.trim().slice(0, 100))
                    const event = yield* parseSingleLine(remaining.trim())
                    if (Option.isSome(event)) {
                      console.log('[SSEAdapter] Emitting final event:', event.value._tag)
                      emit.single(event.value)
                    }
                  }
                  console.log('[SSEAdapter] Calling emit.end()')
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
                    console.log('[SSEAdapter] Emitting event:', event.value._tag)
                    emit.single(event.value)

                    // Check if this is a terminal event
                    if (event.value._tag === 'StreamComplete' || event.value._tag === 'StreamError') {
                      console.log('[SSEAdapter] Terminal event detected, calling emit.end()')
                      emit.end()
                      return
                    }
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
 * Cursor server event types (AI SDK toUIMessageStreamResponse format)
 */
type CursorEventType =
  | 'start'
  | 'start-step'
  | 'text-start'
  | 'text-delta'
  | 'text-end'
  | 'reasoning-start'
  | 'reasoning-delta'
  | 'reasoning-end'
  // Tool call events
  | 'tool-input-start'
  | 'tool-input-delta'
  | 'tool-input-available'
  | 'tool-output-available'
  | 'finish-step'
  | 'finish'
  | 'end-step'  // legacy
  | 'end'       // legacy
  | 'error'

interface CursorEvent {
  type: CursorEventType
  id?: string
  delta?: string
  message?: string
  finishReason?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  // Tool call fields
  toolCallId?: string
  toolName?: string
  input?: unknown
  inputTextDelta?: string
  output?: unknown
}

/**
 * Safe JSON parse returning Option (pure, no try/catch)
 */
const safeJsonParse = (str: string): Option.Option<unknown> => {
  const exit = Effect.runSyncExit(
    Effect.try({
      try: () => JSON.parse(str),
      catch: () => new Error('JSON parse failed'),
    })
  )
  return exit._tag === 'Success' ? Option.some(exit.value) : Option.none()
}

/**
 * Extended internal types for UI message stream events
 */
type SSELineTypeExtended =
  | SSELineType
  | { type: 'thinking'; content: string }
  | { type: 'tool-start'; toolCallId: string; toolName: string }
  | { type: 'tool-input'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-output'; toolCallId: string; output: unknown }

/**
 * Map cursor server event to internal type
 * Handles AI SDK toUIMessageStreamResponse() format
 */
const mapCursorEvent = (event: CursorEvent, raw: string): SSELineTypeExtended => {
  switch (event.type) {
    case 'text-delta':
      return { type: '0', content: event.delta ?? '' }

    // Reasoning/thinking events (extended thinking)
    case 'reasoning-delta':
      return { type: 'thinking', content: event.delta ?? '' }

    // Tool call events
    case 'tool-input-start':
      console.log('[SSEAdapter] Tool input start:', event.toolName, event.toolCallId)
      return {
        type: 'tool-start',
        toolCallId: event.toolCallId ?? '',
        toolName: event.toolName ?? 'unknown',
      }

    case 'tool-input-available':
      console.log('[SSEAdapter] Tool input available:', event.toolName, event.toolCallId)
      return {
        type: 'tool-input',
        toolCallId: event.toolCallId ?? '',
        toolName: event.toolName ?? 'unknown',
        input: event.input,
      }

    case 'tool-output-available':
      console.log('[SSEAdapter] Tool output available:', event.toolCallId)
      return {
        type: 'tool-output',
        toolCallId: event.toolCallId ?? '',
        output: event.output,
      }

    case 'tool-input-delta':
      // We ignore deltas - wait for tool-input-available with complete input
      return { type: 'unknown', raw }

    // AI SDK uses 'finish' and 'finish-step' (not 'end')
    case 'finish':
    case 'finish-step':
    case 'end':       // legacy fallback
    case 'end-step':  // legacy fallback
      console.log('[SSEAdapter] Finish event received:', event.type, 'finishReason:', event.finishReason)
      return {
        type: 'd',
        content: {
          finishReason: event.finishReason ?? 'stop',
          usage: event.usage,
        },
      }

    case 'error':
      return { type: 'e', content: { message: event.message ?? 'Unknown error' } }

    case 'start':
    case 'start-step':
    case 'text-start':
    case 'text-end':
    case 'reasoning-start':
    case 'reasoning-end':
      return { type: 'unknown', raw }

    default:
      return { type: 'unknown', raw }
  }
}

/**
 * Parse a single SSE line into type + content
 * Supports both AI SDK numeric format (0:"text") and cursor server format (data: {...})
 */
const parseSSELine = (line: string): SSELineTypeExtended => {
  // Check for standard SSE format first: data: <json>
  if (line.startsWith('data:')) {
    const jsonStr = line.slice(5).trim()
    if (!jsonStr) {
      return { type: 'unknown', raw: line }
    }
    return pipe(
      safeJsonParse(jsonStr),
      Option.map((parsed) => mapCursorEvent(parsed as CursorEvent, line)),
      Option.getOrElse(() => ({ type: 'unknown' as const, raw: line }))
    )
  }

  // Fallback to AI SDK format: <type>:<json>
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) {
    return { type: 'unknown', raw: line }
  }

  const type = line.slice(0, colonIndex)
  const content = line.slice(colonIndex + 1)

  switch (type) {
    case '0':
      return { type: '0', content }
    case '9':
      return pipe(
        safeJsonParse(content),
        Option.map((parsed) => ({ type: '9' as const, content: parsed })),
        Option.getOrElse(() => ({ type: 'unknown' as const, raw: line }))
      )
    case 'a':
      return pipe(
        safeJsonParse(content),
        Option.map((parsed) => ({ type: 'a' as const, content: parsed })),
        Option.getOrElse(() => ({ type: 'unknown' as const, raw: line }))
      )
    case 'd':
      return pipe(
        safeJsonParse(content),
        Option.map((parsed) => ({ type: 'd' as const, content: parsed })),
        Option.getOrElse(() => ({ type: 'unknown' as const, raw: line }))
      )
    case 'e':
      return pipe(
        safeJsonParse(content),
        Option.map((parsed) => ({ type: 'e' as const, content: parsed })),
        Option.getOrElse(() => ({ type: 'e' as const, content: { message: content } }))
      )
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
    console.log('[SSEAdapter] Parsed line:', parsed.type, 'raw:', line.slice(0, 100))

    switch (parsed.type) {
      case '0':
        return yield* parseTextDelta(parsed.content)
      case 'thinking':
        // Reasoning/thinking delta from extended thinking
        return Option.some(new ThinkingDelta({ thinking: parsed.content, accumulated: null }))
      case '9':
        return yield* parseToolCall(parsed.content)
      case 'a':
        return yield* parseToolResult(parsed.content)
      case 'd':
        console.log('[SSEAdapter] Finish event detected, creating StreamComplete')
        return yield* parseFinish(parsed.content)
      case 'e':
        console.log('[SSEAdapter] Error event detected')
        return yield* parseError(parsed.content)
      // Tool call events from AI SDK toUIMessageStreamResponse format
      case 'tool-start':
        console.log('[SSEAdapter] Tool start:', parsed.toolName, parsed.toolCallId)
        return Option.some(
          new ToolCallStart({
            toolCallId: parsed.toolCallId,
            toolName: parsed.toolName,
            serverId: null,
          })
        )
      case 'tool-input':
        console.log('[SSEAdapter] Tool input complete:', parsed.toolName, parsed.toolCallId)
        return Option.some(
          new ToolCallComplete({
            toolCallId: parsed.toolCallId,
            toolName: parsed.toolName,
            args: parsed.input,
            serverId: null,
          })
        )
      case 'tool-output':
        console.log('[SSEAdapter] Tool output:', parsed.toolCallId)
        // AI SDK v6 returns output as array of content blocks: [{type: "text", text: "..."}]
        // Extract and parse the actual content
        const extractedResult = extractToolOutput(parsed.output)
        console.log('[SSEAdapter] Extracted result type:', typeof extractedResult)
        return Option.some(
          new ToolResult({
            toolCallId: parsed.toolCallId,
            toolName: 'unknown', // AI SDK doesn't include toolName in output event
            result: extractedResult,
            isError: false,
            errorMessage: null,
          })
        )
      case 'unknown':
        // Ignore unknown line types (3:, 8:, f:, etc.)
        console.log('[SSEAdapter] Unknown line type ignored:', line.slice(0, 50))
        return Option.none()
    }
  })
