/**
 * Execution bridge — connects HarnessTool.execute (Promise-based) to
 * PiAiToolRuntime.execute (Effect-based) with stream chunk diffing.
 *
 * Pure module: no service dependencies. Takes a tool map and returns
 * an Effect-based executor.
 *
 * @module harness/tools/execute-bridge
 */

import type { ToolCall as PiAiToolCall, ToolResultMessage as PiAiToolResultMessage } from '@mariozechner/pi-ai'
import { Effect, Option } from 'effect'
import { PiAiToolRuntimeError, type OnToolStreamChunk } from '../PiAiToolRuntime'
import type { ToolStreamChunk } from '../schemas'
import type { HarnessTool } from './types'

/**
 * Create the Effect-based execute function from a tool dispatch map.
 *
 * Bridges SDK's sync onUpdate callback to Effect-based onStreamChunk.
 * SDK calls onUpdate with the FULL rolling buffer each time (not deltas).
 * We diff against prevLength to extract the NEW bytes since the last callback.
 *
 * Edge cases handled:
 *   1. Buffer truncation: fullText.length < prevLength → SDK dropped old chunks.
 *      We can't recover the lost data, so reset the pointer and emit whatever's new.
 *   2. No new data: delta is empty → skip (SDK may re-emit same buffer).
 *   3. Async Effect: onStreamChunk returns appendEvent(...) which is async.
 *      SDK's onUpdate is synchronous — fire-and-forget with runPromise.
 */
export function createExecuteBridge(
  toolMap: ReadonlyMap<string, HarnessTool>,
) {
  return (
    toolCall: PiAiToolCall,
    onStreamChunk?: OnToolStreamChunk,
    signal?: AbortSignal,
  ): Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError> =>
    Effect.gen(function* () {
      const agentTool = toolMap.get(toolCall.name)
      if (!agentTool) {
        return yield* Effect.fail(
          new PiAiToolRuntimeError({
            code: 'tool-not-found',
            message: `No built-in tool registered for '${toolCall.name}'. Available: ${[...toolMap.keys()].join(', ')}`,
            cause: Option.none(),
          }),
        )
      }

      let chunkSeq = 0
      let prevLength = 0
      let latestDetails: unknown = undefined
      const sdkOnUpdate = onStreamChunk
        ? (partial: { content: Array<{ type: string; text: string }>; details?: unknown }) => {
            if (partial.details) {
              latestDetails = partial.details
            }

            const fullText = partial.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('')

            let delta: string
            if (fullText.length < prevLength) {
              delta = fullText
              prevLength = fullText.length
            } else {
              delta = fullText.slice(prevLength)
              prevLength = fullText.length
            }

            if (!delta && !partial.details) return

            chunkSeq++
            const chunk: ToolStreamChunk = {
              toolCallId: toolCall.id,
              seq: chunkSeq,
              chunk: delta || '',
              kind: 'stdout',
              details: partial.details,
            }
            // Fire-and-forget — don't block SDK's exec loop.
            Effect.runPromise(onStreamChunk(chunk)).catch(() => {})
          }
        : undefined

      const result = yield* Effect.tryPromise({
        try: () =>
          agentTool.execute(
            toolCall.id,
            toolCall.arguments as Record<string, unknown>,
            signal,
            sdkOnUpdate,
          ),
        catch: (error) =>
          new PiAiToolRuntimeError({
            code: 'tool-execution-failed',
            message: `Tool '${toolCall.name}' failed: ${error instanceof Error ? error.message : String(error)}`,
            cause: Option.some(error),
          }),
      })
      return {
        role: 'toolResult' as const,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: result.content,
        details: (result as any).details,
        isError: false,
        timestamp: Date.now(),
      }
    })
}
