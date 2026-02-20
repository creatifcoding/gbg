/**
 * PiAiToolRuntimeBuiltins — Wires the pi-coding-agent SDK's 7 built-in tools
 * (read, bash, edit, write, grep, ls, find) into PiAiToolRuntime.
 *
 * Bridges from AgentTool.execute (Promise-based) to PiAiToolRuntime.execute (Effect-based).
 *
 * @module harness/PiAiToolRuntimeBuiltins
 */

import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from '@mariozechner/pi-coding-agent'
import type { ToolCall as PiAiToolCall, ToolResultMessage as PiAiToolResultMessage } from '@mariozechner/pi-ai'
import { Effect, Layer, Option } from 'effect'
import { PiAiToolRuntime, PiAiToolRuntimeError } from './PiAiToolRuntime'
import * as path from 'node:path'

// =============================================================================
// Configuration
// =============================================================================

export interface ToolSandboxConfig {
  /** Working directory for tool execution. Defaults to process.cwd() */
  cwd?: string
  /** Maximum tool execution rounds before the engine stops the loop. Default: 8 */
  maxToolRounds?: number
  /** Bash tool timeout in milliseconds. Default: 30000 */
  bashTimeout?: number
}

const DEFAULT_CONFIG: Required<ToolSandboxConfig> = {
  cwd: process.cwd(),
  maxToolRounds: 8,
  bashTimeout: 30_000,
}

// =============================================================================
// Create SDK tools configured for project CWD
// =============================================================================

function createSdkTools(config: Required<ToolSandboxConfig>) {
  const cwd = path.resolve(config.cwd)
  return [
    createReadTool(cwd),
    createBashTool(cwd, { timeout: config.bashTimeout }),
    createEditTool(cwd),
    createWriteTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
    createLsTool(cwd),
  ]
}

// =============================================================================
// Layer Factory + Default
// =============================================================================

/**
 * Create a PiAiToolRuntime Layer with configurable sandbox.
 */
export function createToolRuntimeLayer(userConfig?: ToolSandboxConfig) {
  const config = { ...DEFAULT_CONFIG, ...userConfig }
  const tools = createSdkTools(config)
  const map = new Map(tools.map((t) => [t.name, t]))

  const execute = (toolCall: PiAiToolCall): Effect.Effect<PiAiToolResultMessage, PiAiToolRuntimeError> =>
    Effect.gen(function* () {
      const agentTool = map.get(toolCall.name)
      if (!agentTool) {
        return yield* Effect.fail(
          new PiAiToolRuntimeError({
            code: 'tool-not-found',
            message: `No built-in tool registered for '${toolCall.name}'. Available: ${[...map.keys()].join(', ')}`,
            cause: Option.none(),
          }),
        )
      }
      const result = yield* Effect.tryPromise({
        try: () => agentTool.execute(toolCall.id, toolCall.arguments as Record<string, unknown>),
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
        isError: false,
        timestamp: Date.now(),
      }
    })

  return Layer.succeed(
    PiAiToolRuntime,
    PiAiToolRuntime.of({
      tools: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) as any,
      maxToolRounds: config.maxToolRounds,
      execute: (toolCall) =>
        execute(toolCall).pipe(
          Effect.catchTag('PiAiToolRuntimeError', (error) =>
            Effect.succeed({
              role: 'toolResult' as const,
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              content: [{ type: 'text' as const, text: `Tool execution error: ${error.message}` }],
              isError: true,
              timestamp: Date.now(),
            }),
          ),
        ),
    }),
  )
}

/** Default built-in tool runtime with process.cwd(), 8 rounds, 30s bash timeout */
export const PiAiToolRuntimeWithBuiltins = createToolRuntimeLayer()
