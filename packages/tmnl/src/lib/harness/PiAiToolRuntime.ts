import type { Tool as PiAiTool, ToolCall as PiAiToolCall, ToolResultMessage as PiAiToolResultMessage } from '@mariozechner/pi-ai'
import { Context, Effect, Layer, Option, Schema } from 'effect'
import type { ToolStreamChunk } from './schemas'

export class PiAiToolRuntimeError extends Schema.TaggedError<PiAiToolRuntimeError>()('PiAiToolRuntimeError', {
  code: Schema.String,
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

/**
 * Callback for incremental tool output streaming.
 * Called per stdout/stderr chunk during tool execution.
 */
export type OnToolStreamChunk = (chunk: ToolStreamChunk) => Effect.Effect<void>

export interface PiAiToolRuntimeShape {
  readonly tools: readonly PiAiTool[]
  readonly maxToolRounds: number
  readonly execute: (
    toolCall: PiAiToolCall,
    onStreamChunk?: OnToolStreamChunk,
  ) => Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError>
}

export const PiAiToolRuntime = Context.GenericTag<PiAiToolRuntimeShape>('tmnl/harness/PiAiToolRuntime')

export const PiAiToolRuntimeLive = Layer.succeed(
  PiAiToolRuntime,
  PiAiToolRuntime.of({
    tools: [],
    maxToolRounds: Infinity, // Overridden by AgentHarnessConfig via PiAiToolRuntimeWithBuiltins
    execute: (toolCall, _onStreamChunk) =>
      Effect.succeed({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [
          {
            type: 'text',
            text: `No harness tool handler registered for '${toolCall.name}'`,
          },
        ],
        isError: true,
        timestamp: Date.now(),
      }),
  }),
)

export const failToolRuntime = (code: string, message: string, cause?: unknown) =>
  new PiAiToolRuntimeError({
    code,
    message,
    cause: cause === undefined ? Option.none() : Option.some(cause),
  })
