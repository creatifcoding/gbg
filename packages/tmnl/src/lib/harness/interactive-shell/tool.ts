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

import { Effect, Duration, Option } from 'effect'
import { InteractiveShellService, SessionNotFoundError, checkQueryRate, type InteractiveShellServiceShape } from './InteractiveShellService'
import type { ShellSessionId, InteractiveShellToolArgs } from './schemas'
import { translateInput } from './key-encoding'
import {
  makeCompletionGate,
  DEFAULT_HANDS_FREE_CONFIG,
  type HandsFreeConfig,
  type CompletionInfo,
} from './quiet-monitor'

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
    inputKeys: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Named keys with modifier support: up, down, enter, ctrl+c, alt+x, shift+tab, ctrl+alt+delete, etc. (requires sessionId)',
    },
    inputHex: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Hex bytes to send as raw escape sequences (e.g., ["0x1b", "0x5b", "0x41"] for ESC[A). (requires sessionId)',
    },
    inputPaste: {
      type: 'string',
      description:
        'Text to paste with bracketed paste mode — prevents shells from auto-executing multiline input. (requires sessionId)',
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
    outputLines: {
      type: 'number',
      description: 'Number of lines to return when reading output (default: 20, max: 200).',
    },
    outputMaxChars: {
      type: 'number',
      description: 'Max chars to return when reading output (default: 5000, max: 50000).',
    },
    outputOffset: {
      type: 'number',
      description: 'Line offset for pagination (0-indexed). Use with outputLines.',
    },
    drain: {
      type: 'boolean',
      description: 'If true, return only NEW output since last read.',
    },
    incremental: {
      type: 'boolean',
      description: 'If true, return next N unseen lines (server tracks position).',
    },
    mode: {
      type: 'string',
      enum: ['interactive', 'hands-free', 'dispatch'],
      description:
        "Session mode. 'interactive' (default): blocking. 'hands-free': returns immediately, periodic updates. 'dispatch': returns immediately, notified on completion.",
    },
    timeout: {
      type: 'number',
      description: 'Auto-kill process after N milliseconds.',
    },
    handsFree: {
      type: 'object',
      description: 'Hands-free mode configuration.',
      properties: {
        autoExitOnQuiet: { type: 'boolean', description: 'Auto-kill session when output stops. Default: false.' },
        quietThreshold: { type: 'number', description: 'Silence duration (ms) before quiet detection. Default: 5000.' },
        updateInterval: { type: 'number', description: 'Max interval between updates (ms). Default: 60000.' },
        updateMaxChars: { type: 'number', description: 'Max chars per update. Default: 1500.' },
        maxTotalChars: { type: 'number', description: 'Total char budget. Default: 100000.' },
        updateMode: { type: 'string', enum: ['on-quiet', 'interval'], description: 'Update trigger mode. Default: on-quiet.' },
      },
    },
    background: {
      type: 'boolean',
      description: 'Run without overlay (headless). Use with mode=dispatch, or with sessionId to dismiss overlay.',
    },
    attach: {
      type: 'string',
      description: 'Background session ID to reattach (bring to foreground).',
    },
    listBackground: {
      type: 'boolean',
      description: 'List all background sessions.',
    },
    dismissBackground: {
      oneOf: [{ type: 'boolean' }, { type: 'string' }],
      description: 'Dismiss background sessions. true = all, string = specific session ID.',
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
  inputKeys?: string[]
  inputHex?: string[]
  inputPaste?: string
  kill?: boolean
  signal?: number
  cols?: number
  rows?: number
  outputLines?: number
  outputMaxChars?: number
  outputOffset?: number
  drain?: boolean
  incremental?: boolean
  mode?: 'interactive' | 'hands-free' | 'dispatch'
  timeout?: number
  background?: boolean
  attach?: string
  listBackground?: boolean
  dismissBackground?: boolean | string
  handsFree?: {
    autoExitOnQuiet?: boolean
    quietThreshold?: number
    updateInterval?: number
    updateMaxChars?: number
    maxTotalChars?: number
    updateMode?: 'on-quiet' | 'interval'
  }
}

/**
 * Read session output using dumpScreen (rendered) or readRawOutput (raw).
 * Falls back to legacy readOutput if pool RPC fails.
 */
const readSessionOutput = (
  shell: InteractiveShellServiceShape,
  args: ToolArgs,
) =>
  Effect.gen(function* () {
    const sid = args.sessionId as ShellSessionId
    const lines = Math.min(args.outputLines ?? 20, 200)
    const maxChars = Math.min(args.outputMaxChars ?? 5000, 50000)

    // Drain / incremental mode → raw output
    if (args.drain || args.incremental) {
      const raw = yield* shell.readRawOutput(sid, {
        drain: args.drain || args.incremental,
        limit: lines,
        offset: args.outputOffset,
      })
      const meta = `[${raw.sliceLineCount}/${raw.totalLines} lines, ${raw.totalChars} chars total]`
      return `${meta}\n${raw.text}`
    }

    // Paginated / default → screen dump (rendered viewport)
    const mode = args.outputOffset !== undefined ? 'slice' as const : 'tail' as const
    const dump = yield* shell.dumpScreen(sid, {
      mode,
      lines,
      offset: args.outputOffset,
      maxChars,
    })

    const meta = `[${dump.lines.length}/${dump.totalLines} lines${dump.truncated ? ' TRUNCATED' : ''}]`
    return `${meta}\n${dump.lines.join('\n')}`
  }).pipe(
    // Fallback to legacy readOutput if dumpScreen fails
    Effect.catchAll(() =>
      shell.readOutput(args.sessionId as ShellSessionId, args.outputLines ?? 50),
    ),
  )

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

    // ── List background sessions ─────────────────────────────────────
    if (args.listBackground) {
      const bgSessions = yield* shell.listBackgroundSessions()
      if (bgSessions.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No background sessions.' }],
          isError: false,
        }
      }
      const lines = bgSessions.map(
        (s) => `  ${s.sessionId} [${s.status}] ${s.name ?? '(unnamed)'} pid:${s.pid ?? '?'} cwd:${s.cwd}`,
      )
      return {
        content: [{ type: 'text' as const, text: `Background sessions:\n${lines.join('\n')}` }],
        isError: false,
      }
    }

    // ── Dismiss background sessions ───────────────────────────────────
    if (args.dismissBackground !== undefined) {
      if (typeof args.dismissBackground === 'string') {
        yield* shell.kill(args.dismissBackground as ShellSessionId).pipe(
          Effect.catchAll(() => Effect.void),
        )
        return {
          content: [{ type: 'text' as const, text: `Dismissed session ${args.dismissBackground}.` }],
          isError: false,
        }
      }
      // dismiss all background
      const bgSessions = yield* shell.listBackgroundSessions()
      for (const s of bgSessions) {
        yield* shell.kill(s.sessionId).pipe(Effect.catchAll(() => Effect.void))
      }
      return {
        content: [{ type: 'text' as const, text: `Dismissed ${bgSessions.length} background session(s).` }],
        isError: false,
      }
    }

    // ── Attach (reattach to background session) ───────────────────────
    if (args.attach) {
      const info = yield* shell.foregroundSession(args.attach as ShellSessionId)
      return {
        content: [
          {
            type: 'text' as const,
            text: `Reattached to session.\nsessionId: ${info.sessionId}\nname: ${info.name ?? '(unnamed)'}\nstatus: ${info.status}\npid: ${info.pid ?? 'unknown'}`,
          },
        ],
        isError: false,
      }
    }

    // ── Background existing session ───────────────────────────────────
    if (args.sessionId && args.background && !args.command) {
      yield* shell.backgroundSession(args.sessionId as ShellSessionId)
      return {
        content: [{ type: 'text' as const, text: `Session ${args.sessionId} moved to background.` }],
        isError: false,
      }
    }

    // ── Kill session ──────────────────────────────────────────────────
    if (args.sessionId && args.kill) {
      yield* shell.kill(args.sessionId as ShellSessionId, args.signal)
      return {
        content: [{ type: 'text' as const, text: `Session ${args.sessionId} killed.` }],
        isError: false,
      }
    }

    // ── Write input to existing session ────────────────────────────────
    const hasStructuredInput =
      args.inputKeys?.length || args.inputHex?.length || args.inputPaste
    if (
      args.sessionId &&
      (args.input !== undefined || hasStructuredInput)
    ) {
      // Translate structured input → escape sequences
      const translated = hasStructuredInput
        ? translateInput({
            text: args.input,
            keys: args.inputKeys,
            hex: args.inputHex,
            paste: args.inputPaste,
          })
        : args.input!

      yield* shell.write(args.sessionId as ShellSessionId, translated)

      // Brief wait for output to accumulate
      yield* Effect.sleep('200 millis')

      // Return recent output via screen dump
      const outputText = yield* readSessionOutput(shell, args)
      const info = yield* shell.getSession(args.sessionId as ShellSessionId)

      return {
        content: [
          {
            type: 'text' as const,
            text: `[session:${args.sessionId} status:${info.status} pid:${info.pid ?? 'unknown'}]\n${outputText}`,
          },
        ],
        isError: false,
      }
    }

    // ── Read output from existing session (status check) ──────────────
    if (args.sessionId && !args.command && !hasStructuredInput) {
      // Rate limit queries to prevent excessive polling
      const waitMs = checkQueryRate(args.sessionId)
      if (waitMs > 0) {
        yield* Effect.sleep(Duration.millis(waitMs))
      }

      const outputText = yield* readSessionOutput(shell, args)
      const info = yield* shell.getSession(args.sessionId as ShellSessionId)

      return {
        content: [
          {
            type: 'text' as const,
            text: `[session:${args.sessionId} status:${info.status} pid:${info.pid ?? 'unknown'}]\n${outputText}`,
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

      const mode = args.mode ?? 'interactive'

      // ── Dispatch mode: return immediately, resolve Deferred on exit ──
      if (mode === 'dispatch') {
        const hfConfig = args.handsFree ?? {}
        const autoExit = hfConfig.autoExitOnQuiet ?? true // dispatch defaults to auto-exit

        const { gate, dispose } = yield* makeCompletionGate(
          info.sessionId,
          shell.events,
          {
            autoExitOnQuiet: autoExit,
            quietThreshold: hfConfig.quietThreshold ?? DEFAULT_HANDS_FREE_CONFIG.quietThreshold,
            timeout: args.timeout,
            killSession: () => shell.kill(info.sessionId).pipe(Effect.catchAll(() => Effect.void)),
            readOutput: () =>
              shell.readOutput(info.sessionId, 50).pipe(Effect.catchAll(() => Effect.succeed(''))),
          },
        )

        // Fire completion watcher in background — results delivered via
        // shell events (agent gets notified on next tool call / status check)
        yield* Effect.fork(
          Effect.gen(function* () {
            const result: CompletionInfo = yield* Deferred.await(gate)
            // Emit completion as tool update if callback available
            onUpdate?.({
              content: [
                {
                  type: 'text',
                  text: `[dispatch:complete session:${info.sessionId} exit:${result.exitCode ?? 'null'}${result.timedOut ? ' TIMED_OUT' : ''}${result.autoExitedOnQuiet ? ' AUTO_EXITED_QUIET' : ''}]\n${result.outputSnapshot ?? ''}`,
                },
              ],
            })
            yield* dispose
          }),
        )

        return {
          content: [
            {
              type: 'text' as const,
              text: `Session dispatched (fire-and-forget).\nsessionId: ${info.sessionId}\npid: ${info.pid ?? 'unknown'}\nmode: dispatch\n${args.timeout ? `timeout: ${args.timeout}ms\n` : ''}${autoExit ? `autoExitOnQuiet: true (${hfConfig.quietThreshold ?? DEFAULT_HANDS_FREE_CONFIG.quietThreshold}ms)\n` : ''}\nYou will be notified when the session completes. Query with sessionId for status.`,
            },
          ],
          isError: false,
        }
      }

      // ── Hands-free mode: return immediately, periodic updates ────────
      if (mode === 'hands-free') {
        // Set up completion gate for timeout/auto-exit
        if (args.timeout || args.handsFree?.autoExitOnQuiet) {
          const hfConfig = args.handsFree ?? {}
          const { dispose } = yield* makeCompletionGate(
            info.sessionId,
            shell.events,
            {
              autoExitOnQuiet: hfConfig.autoExitOnQuiet,
              quietThreshold: hfConfig.quietThreshold ?? DEFAULT_HANDS_FREE_CONFIG.quietThreshold,
              timeout: args.timeout,
              killSession: () => shell.kill(info.sessionId).pipe(Effect.catchAll(() => Effect.void)),
              readOutput: () =>
                shell.readOutput(info.sessionId, 50).pipe(Effect.catchAll(() => Effect.succeed(''))),
            },
          )
          // Cleanup runs when session exits
          yield* Effect.fork(
            Effect.gen(function* () {
              yield* Effect.never // keep alive until scope closes
            }).pipe(Effect.onInterrupt(() => dispose)),
          )
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Session started in hands-free mode.\nsessionId: ${info.sessionId}\npid: ${info.pid ?? 'unknown'}\nstatus: ${info.status}\nmode: hands-free\n${args.timeout ? `timeout: ${args.timeout}ms\n` : ''}\nQuery with sessionId for output. Session runs in background.`,
            },
          ],
          isError: false,
        }
      }

      // ── Interactive mode (default): stream initial output ────────────
      if (onUpdate) {
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
