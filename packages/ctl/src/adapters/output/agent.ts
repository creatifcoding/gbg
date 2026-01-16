/**
 * Agent Output Adapter
 *
 * Structured JSON output for agent steering framework.
 * Used when CTL is invoked with --agent flag.
 *
 * @module @gbg/ctl/adapters/output/agent
 */

import { Console, Effect, Layer } from "effect"
import type { OutputPort, RenderContext } from "../../core/ports/output.js"
import { Output } from "../../core/ports/output.js"
import {
  CtlAgentOutput,
  serialize,
  success,
  error,
} from "../../core/domain/agent-output.js"

// =============================================================================
// AGENT OUTPUT ADAPTER
// =============================================================================

/**
 * Current command context (set before rendering)
 */
let currentCommand = "unknown"

/**
 * Set the current command context for agent output
 */
export const setCommand = (cmd: string): void => {
  currentCommand = cmd
}

const make: OutputPort = {
  text: (content) =>
    Console.log(
      serialize(
        success(currentCommand, { text: content })
      )
    ),

  table: (data, columns) =>
    Console.log(
      serialize(
        success(currentCommand, {
          type: "table",
          columns: columns.map((c) => ({ key: String(c.key), header: c.header })),
          data,
        })
      )
    ),

  success: (message, details) =>
    Console.log(
      serialize(
        success(currentCommand, {
          message,
          details: details ?? {},
        })
      )
    ),

  error: (message, details) =>
    Console.log(
      serialize(
        error(currentCommand, {
          code: "ERROR",
          message,
          suggestion: details?.suggestion,
        })
      )
    ),

  warning: (message) =>
    Console.log(
      serialize(
        success(currentCommand, {
          type: "warning",
          message,
        })
      )
    ),

  spinner: (_label) =>
    // No spinner in agent mode - just return no-op
    Effect.succeed({ stop: () => {} }),

  progress: (label, value, max = 100) =>
    Console.log(
      serialize(
        new CtlAgentOutput({
          _type: "ctl_output",
          command: currentCommand,
          status: value >= max ? "success" : "streaming",
          result: {
            type: "progress",
            label,
            value,
            max,
            percent: Math.round((value / max) * 100),
          },
          streaming: value < max ? { complete: false, chunks: [] } : undefined,
        })
      )
    ),

  agentOutput: (output) =>
    // Direct passthrough - already structured
    Console.log(serialize(output)),

  json: (data) =>
    Console.log(
      serialize(
        success(currentCommand, data)
      )
    ),

  clear: () =>
    // No-op in agent mode
    Effect.void,

  getContext: () =>
    Effect.succeed<RenderContext>({
      mode: "agent",
      isTty: false,
      width: undefined,
      height: undefined,
    }),
}

// =============================================================================
// LAYER
// =============================================================================

export const AgentOutputLayer = Layer.succeed(Output, make)

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Create agent output layer with command context
 */
export const makeAgentOutputLayer = (command: string) => {
  setCommand(command)
  return AgentOutputLayer
}
