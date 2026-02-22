/**
 * interactive_shell harness tool definition
 *
 * Defines the tool that the LLM can invoke to spawn/interact with
 * interactive terminal sessions. The tool bridges to InteractiveShellService.
 *
 * Tool operations (via JSON arguments):
 *   - { command: "bash" }           → spawn new session
 *   - { sessionId, input: "ls\n" }  → write to session
 *   - { sessionId, kill: true }     → kill session
 *   - { sessionId }                 → read output (status check)
 *
 * @module harness/interactive-shell/tool
 */

import { Effect, Option } from 'effect'
import { InteractiveShellService, SessionNotFoundError } from './InteractiveShellService'
import type { ShellSessionId, InteractiveShellToolArgs } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Tool JSON Schema (for LLM function calling)
// ─────────────────────────────────────────────────────────────────────────────

export const INTERACTIVE_SHELL_TOOL_NAME = 'interactive_shell'

export const interactiveShellToolParameters = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description:
        'Command to execute in the terminal. If this is a new session, the command is used to spawn the shell (e.g., "bash", "python3", "node"). For complex commands, use "bash" and then send input.',
    },
    cwd: {
      type: 'string',
      description: 'Working directory for the shell session.',
    },
    name: {
      type: 'string',
      description: 'Optional session name for display and reconnection.',
    },
    sessionId: {
      type: 'string',
      description:
        'Existing session ID to interact with. If provided with input, writes to the session. If provided alone, returns current output.',
    },
    input: {
      type: 'string',
      description:
        'Raw terminal input to send to an existing session. Requires sessionId. Include \\n for Enter key.',
    },
    kill: {
      type: 'boolean',
      description: 'Kill the session identified by sessionId.',
    },
    signal: {
      type: 'number',
      description: 'Signal number to send when killing (default: SIGTERM/15).',
    },
    cols: {
      type: 'number',
      description: 'Terminal width in columns (default: 120).',
    },
    rows: {
      type: 'number',
      description: 'Terminal height in rows (default: 24).',
    },
  },
  required: [],
  additionalProperties: false,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Tool Executor
// ─────────────────────────────────────────────────────────────────────────────

interface ToolArgs {
  command?: string
  cwd?: string
  name?: string
  sessionId?: string
  input?: string
  kill?: boolean
  signal?: number
  cols?: number
  rows?: number
}

/**
 * Execute the interactive_shell tool.
 *
 * Routes to spawn/write/kill/read based on provided arguments.
 * Returns a content array with text result (matches pi-ai ToolResultMessage shape).
 */
export const executeInteractiveShell = (
  _toolCallId: string,
  params: Record<string, unknown>,
  _signal: AbortSignal | undefined,
  onUpdate?: (partial: {
    content: Array<{ type: string; text: string }>
    details?: unknown
  }) => void,
) =>
  Effect.gen(function* () {
    const shell = yield* InteractiveShellService
    const args = params as ToolArgs

    // ── Kill session ──────────────────────────────────────────────────
    if (args.sessionId && args.kill) {
      yield* shell.kill(args.sessionId as ShellSessionId, args.signal)
      return {
        content: [{ type: 'text' as const, text: `Session ${args.sessionId} killed.` }],
        isError: false,
      }
    }

    // ── Write input to existing session ────────────────────────────────
    if (args.sessionId && args.input !== undefined) {
      yield* shell.write(args.sessionId as ShellSessionId, args.input)

      // Brief wait for output to accumulate
      yield* Effect.sleep('200 millis')

      // Return recent output
      const output = yield* shell.readOutput(args.sessionId as ShellSessionId, 50)
      const info = yield* shell.getSession(args.sessionId as ShellSessionId)

      return {
        content: [
          {
            type: 'text' as const,
            text: `[session:${args.sessionId} status:${info.status} pid:${info.pid ?? 'unknown'}]\n${output}`,
          },
        ],
        isError: false,
      }
    }

    // ── Read output from existing session (status check) ──────────────
    if (args.sessionId && !args.command) {
      const output = yield* shell.readOutput(args.sessionId as ShellSessionId, 50)
      const info = yield* shell.getSession(args.sessionId as ShellSessionId)

      return {
        content: [
          {
            type: 'text' as const,
            text: `[session:${args.sessionId} status:${info.status} pid:${info.pid ?? 'unknown'}]\n${output}`,
          },
        ],
        isError: false,
      }
    }

    // ── Spawn new session ─────────────────────────────────────────────
    if (args.command) {
      const info = yield* shell.spawn({
        command: args.command,
        cwd: args.cwd,
        name: args.name,
        cols: args.cols,
        rows: args.rows,
      })

      // Stream initial output to the tool update callback
      if (onUpdate) {
        // Wait a bit for initial shell prompt
        yield* Effect.sleep('500 millis')

        const output = yield* shell.readOutput(info.sessionId, 20)
        onUpdate({
          content: [
            {
              type: 'text',
              text: `[session:${info.sessionId} status:${info.status} pid:${info.pid ?? 'unknown'}]\n${output}`,
            },
          ],
        })
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Interactive shell session started.\nsessionId: ${info.sessionId}\npid: ${info.pid ?? 'unknown'}\nstatus: ${info.status}\n\nUse sessionId with input parameter to send commands, or kill parameter to terminate.`,
          },
        ],
        isError: false,
      }
    }

    // ── No valid operation ────────────────────────────────────────────
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Error: interactive_shell requires either "command" (to spawn) or "sessionId" (to interact with existing session).',
        },
      ],
      isError: true,
    }
  }).pipe(
    // Catch service-level errors and convert to tool result
    Effect.catchTag('SessionNotFoundError', (e) =>
      Effect.succeed({
        content: [{ type: 'text' as const, text: `Error: ${e.message}` }],
        isError: true,
      }),
    ),
    Effect.catchTag('TerminalConnectError', (e) =>
      Effect.succeed({
        content: [{ type: 'text' as const, text: `Error: Failed to spawn PTY — ${e.message}` }],
        isError: true,
      }),
    ),
    Effect.catchTag('TerminalWriteError', (e) =>
      Effect.succeed({
        content: [{ type: 'text' as const, text: `Error: Write failed — ${e.message}` }],
        isError: true,
      }),
    ),
    Effect.catchAll((e) =>
      Effect.succeed({
        content: [{ type: 'text' as const, text: `Error: ${String(e)}` }],
        isError: true,
      }),
    ),
  )
