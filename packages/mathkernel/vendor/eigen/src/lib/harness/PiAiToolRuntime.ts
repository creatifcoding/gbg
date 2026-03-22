import type { Tool as PiAiTool, ToolCall as PiAiToolCall, ToolResultMessage as PiAiToolResultMessage } from '@mariozechner/pi-ai'
import { Context, Effect, HashSet, Layer, Option, Schema } from 'effect'
import type { ToolStreamChunk } from './schemas'

// ── Branded tool name ──
// Pi-ai uses raw `string` for Tool.name — we brand at the TMNL boundary
// for type safety in sets, maps, and pattern matching.
export const ToolName = Schema.String.pipe(Schema.brand('ToolName'))
export type ToolName = typeof ToolName.Type

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
  /**
   * Set of tool names that opt in to concurrent execution.
   *
   * Tools in this set may run in parallel with other tool calls in the
   * same round (e.g. `spawn_panel` returns instantly because generation
   * is fire-and-forget). All other tools execute sequentially in order.
   *
   * Default: empty set (all tools sequential — safe by default).
   */
  readonly concurrentFriendlyTools: HashSet.HashSet<ToolName>
  readonly execute: (
    toolCall: PiAiToolCall,
    onStreamChunk?: OnToolStreamChunk,
    signal?: AbortSignal,
  ) => Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError>
}

export const PiAiToolRuntime = Context.GenericTag<PiAiToolRuntimeShape>('tmnl/harness/PiAiToolRuntime')

export const PiAiToolRuntimeLive = Layer.succeed(
  PiAiToolRuntime,
  PiAiToolRuntime.of({
    tools: [],
    maxToolRounds: Infinity, // Overridden by AgentHarnessConfig via PiAiToolRuntimeWithBuiltins
    concurrentFriendlyTools: HashSet.empty<ToolName>(),
    execute: (toolCall, _onStreamChunk, _signal) =>
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
