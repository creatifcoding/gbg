/**
 * Interactive Shell Schemas
 *
 * WS protocol schemas for bidirectional PTY communication.
 * Server → Client: terminal data, exit events
 * Client → Server: terminal input, resize commands
 *
 * @module harness/interactive-shell/schemas
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Session Identity
// ─────────────────────────────────────────────────────────────────────────────

export const ShellSessionId = Schema.String.pipe(Schema.brand('ShellSessionId'))
export type ShellSessionId = typeof ShellSessionId.Type

export const ShellSessionStatus = Schema.Literal(
  'starting',
  'running',
  'exited',
  'killed',
  'error',
)
export type ShellSessionStatus = typeof ShellSessionStatus.Type

// ─────────────────────────────────────────────────────────────────────────────
// Session Config (tool call arguments)
// ─────────────────────────────────────────────────────────────────────────────

export const InteractiveShellToolArgs = Schema.Struct({
  /** Command to execute (shell, or specific program) */
  command: Schema.String,
  /** Working directory for the shell */
  cwd: Schema.optional(Schema.String),
  /** Optional session name (for display / reconnect) */
  name: Schema.optional(Schema.String),
  /** Initial cols (default: 120) */
  cols: Schema.optional(Schema.Number),
  /** Initial rows (default: 24) */
  rows: Schema.optional(Schema.Number),
})
export type InteractiveShellToolArgs = typeof InteractiveShellToolArgs.Type

// ─────────────────────────────────────────────────────────────────────────────
// Session Info (returned to agent / stored in state)
// ─────────────────────────────────────────────────────────────────────────────

export const ShellSessionInfo = Schema.Struct({
  sessionId: ShellSessionId,
  name: Schema.optional(Schema.String),
  pid: Schema.optional(Schema.Number),
  shell: Schema.String,
  cwd: Schema.String,
  cols: Schema.Number,
  rows: Schema.Number,
  status: ShellSessionStatus,
  createdAt: Schema.Number,
  exitCode: Schema.optional(Schema.Number),
})
export type ShellSessionInfo = typeof ShellSessionInfo.Type

// ─────────────────────────────────────────────────────────────────────────────
// WS Commands (Client → Server)
// ─────────────────────────────────────────────────────────────────────────────

export const ShellInputCommand = Schema.TaggedStruct('remote:shell_input', {
  sessionId: ShellSessionId,
  /** Raw terminal input data (keystrokes, paste, etc.) */
  data: Schema.String,
})

export const ShellResizeCommand = Schema.TaggedStruct('remote:shell_resize', {
  sessionId: ShellSessionId,
  cols: Schema.Number.pipe(Schema.int(), Schema.positive()),
  rows: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export const ShellKillCommand = Schema.TaggedStruct('remote:shell_kill', {
  sessionId: ShellSessionId,
  signal: Schema.optional(Schema.Number),
})

export const ShellCommand = Schema.Union(
  ShellInputCommand,
  ShellResizeCommand,
  ShellKillCommand,
)
export type ShellCommand = typeof ShellCommand.Type

// ─────────────────────────────────────────────────────────────────────────────
// WS Events (Server → Client)
// ─────────────────────────────────────────────────────────────────────────────

/** Raw PTY output data — binary-safe via base64 or raw string */
export const ShellDataEvent = Schema.TaggedStruct('shell:data', {
  sessionId: ShellSessionId,
  /** Raw terminal output (contains ANSI escape sequences) */
  data: Schema.String,
})
export type ShellDataEvent = typeof ShellDataEvent.Type

/** Session started, PTY allocated */
export const ShellStartedEvent = Schema.TaggedStruct('shell:started', {
  sessionId: ShellSessionId,
  info: ShellSessionInfo,
})
export type ShellStartedEvent = typeof ShellStartedEvent.Type

/** Session exited */
export const ShellExitedEvent = Schema.TaggedStruct('shell:exited', {
  sessionId: ShellSessionId,
  exitCode: Schema.Number,
  signal: Schema.optional(Schema.Number),
})
export type ShellExitedEvent = typeof ShellExitedEvent.Type

/** Session error */
export const ShellErrorEvent = Schema.TaggedStruct('shell:error', {
  sessionId: ShellSessionId,
  message: Schema.String,
})
export type ShellErrorEvent = typeof ShellErrorEvent.Type

/** Union of all shell events */
export const ShellEvent = Schema.Union(
  ShellDataEvent,
  ShellStartedEvent,
  ShellExitedEvent,
  ShellErrorEvent,
)
export type ShellEvent = typeof ShellEvent.Type
