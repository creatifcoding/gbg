/**
 * Tool contribution contract.
 *
 * Each tool module exports a function that resolves its dependencies
 * and returns a ToolContribution — an array of tools plus metadata
 * about concurrent-friendliness.
 *
 * @module harness/tools/types
 */

/**
 * A single tool ready for the harness dispatch map.
 * Matches the pi-coding-agent AgentTool shape.
 */
export interface HarnessTool {
  readonly name: string
  readonly description: string
  readonly parameters: unknown
  readonly execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
    onUpdate?: (partial: {
      content: Array<{ type: string; text: string }>
      details?: unknown
    }) => void,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown; isError?: boolean }>
}

/**
 * What a tool module contributes to the runtime.
 */
export interface ToolContribution {
  /** Tools to register. */
  readonly tools: readonly HarnessTool[]
  /** Tool names that opt in to parallel execution. */
  readonly concurrentFriendly: readonly string[]
}

/** Empty contribution — used when a tool group's dependencies are unavailable. */
export const emptyContribution: ToolContribution = {
  tools: [],
  concurrentFriendly: [],
}
