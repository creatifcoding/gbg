/**
 * Stream Adapter
 *
 * Converts Vercel AI SDK async generators to Effect.Stream.
 */

import { Effect, Stream, Queue } from 'effect'
import type { AIStreamEvent } from '../schemas'

// =============================================================================
// Types
// =============================================================================

/**
 * Internal stream part from Vercel AI SDK
 */
type VercelStreamPart =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'reasoning'; textDelta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName?: string; result: unknown }
  | { type: 'error'; error: unknown }
  | { type: 'finish'; finishReason: string; usage?: { promptTokens: number; completionTokens: number } }

/**
 * Internal stream part from Claude Agent SDK
 */
type ClaudeAgentStreamPart =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-start' }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName?: string; output: unknown }
  | { type: 'error'; error: string }

// =============================================================================
// Adapters
// =============================================================================

/**
 * Convert Vercel AI SDK fullStream to Effect.Stream
 */
export function fromVercelAIStream(
  fullStream: AsyncIterable<VercelStreamPart>
): Stream.Stream<AIStreamEvent, Error> {
  return Stream.fromAsyncIterable(
    (async function* () {
      try {
        for await (const part of fullStream) {
          const event = convertVercelPart(part)
          if (event) {
            yield event
          }
        }
      } catch (error) {
        yield {
          _tag: 'StreamError' as const,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })(),
    (error) => new Error(String(error))
  )
}

/**
 * Convert Claude Agent SDK stream to Effect.Stream
 */
export function fromClaudeAgentStream(
  stream: AsyncIterable<ClaudeAgentStreamPart>
): Stream.Stream<AIStreamEvent, Error> {
  return Stream.fromAsyncIterable(
    (async function* () {
      try {
        for await (const part of stream) {
          const event = convertClaudeAgentPart(part)
          if (event) {
            yield event
          }
        }

        // Emit complete event at end
        yield {
          _tag: 'StreamComplete' as const,
          finishReason: 'stop',
        }
      } catch (error) {
        yield {
          _tag: 'StreamError' as const,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })(),
    (error) => new Error(String(error))
  )
}

/**
 * Create a stream from an async callback pattern
 */
export function fromAsyncCallback<T>(
  subscribe: (emit: (value: T) => void, complete: () => void, error: (e: Error) => void) => () => void
): Stream.Stream<T, Error> {
  return Stream.async<T, Error>((emit) => {
    const cleanup = subscribe(
      (value) => {
        emit.single(value)
      },
      () => {
        emit.end()
      },
      (error) => {
        emit.fail(error)
      }
    )

    return Effect.sync(() => cleanup())
  })
}

// =============================================================================
// Internal Converters
// =============================================================================

function convertVercelPart(part: VercelStreamPart): AIStreamEvent | null {
  switch (part.type) {
    case 'text-delta':
      return { _tag: 'TextDelta', text: part.textDelta }

    case 'reasoning':
      return { _tag: 'ReasoningDelta', text: part.textDelta }

    case 'tool-call':
      return {
        _tag: 'ToolCall',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
      }

    case 'tool-result':
      return {
        _tag: 'ToolResult',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.result,
      }

    case 'error':
      return {
        _tag: 'StreamError',
        error: part.error instanceof Error ? part.error.message : String(part.error),
      }

    case 'finish':
      return {
        _tag: 'StreamComplete',
        finishReason: part.finishReason,
        usage: part.usage
          ? {
              promptTokens: part.usage.promptTokens,
              completionTokens: part.usage.completionTokens,
              totalTokens: part.usage.promptTokens + part.usage.completionTokens,
            }
          : undefined,
      }

    default:
      return null
  }
}

function convertClaudeAgentPart(part: ClaudeAgentStreamPart): AIStreamEvent | null {
  switch (part.type) {
    case 'text-delta':
      return { _tag: 'TextDelta', text: part.text }

    case 'reasoning-start':
      return { _tag: 'ReasoningStart' }

    case 'reasoning-delta':
      return { _tag: 'ReasoningDelta', text: part.text }

    case 'tool-call':
      return {
        _tag: 'ToolCall',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
      }

    case 'tool-result':
      return {
        _tag: 'ToolResult',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        result: part.output,
      }

    case 'error':
      return {
        _tag: 'StreamError',
        error: part.error,
      }

    default:
      return null
  }
}

// =============================================================================
// State Accumulator
// =============================================================================

/**
 * Accumulate stream events into state
 */
export function accumulateStreamState(
  events: Stream.Stream<AIStreamEvent, Error>,
  onUpdate: (state: Partial<{
    text: string
    thinkingText: string
    toolCalls: AIStreamEvent[]
    toolResults: AIStreamEvent[]
    status: 'idle' | 'streaming' | 'complete' | 'error'
    error?: string
  }>) => void
): Effect.Effect<void, Error> {
  let text = ''
  let thinkingText = ''
  const toolCalls: AIStreamEvent[] = []
  const toolResults: AIStreamEvent[] = []

  return Stream.runForEach(events, (event) =>
    Effect.sync(() => {
      switch (event._tag) {
        case 'TextDelta':
          text += event.text
          onUpdate({ text, status: 'streaming' })
          break

        case 'ReasoningDelta':
          thinkingText += event.text
          onUpdate({ thinkingText, status: 'streaming' })
          break

        case 'ToolCall':
          toolCalls.push(event)
          onUpdate({ toolCalls: [...toolCalls], status: 'streaming' })
          break

        case 'ToolResult':
          toolResults.push(event)
          onUpdate({ toolResults: [...toolResults], status: 'streaming' })
          break

        case 'StreamComplete':
          onUpdate({ status: 'complete' })
          break

        case 'StreamError':
          onUpdate({ status: 'error', error: event.error })
          break
      }
    })
  )
}
