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
  command: Schema.optional(Schema.String),
  /** Working directory for the shell */
  cwd: Schema.optional(Schema.String),
  /** Optional session name (for display / reconnect) */
  name: Schema.optional(Schema.String),
  /** Existing session ID to interact with */
  sessionId: Schema.optional(Schema.String),
  /** Raw terminal input text */
  input: Schema.optional(Schema.String),
  /** Named keys with modifier support (e.g. "ctrl+c", "up", "enter") */
  inputKeys: Schema.optional(Schema.Array(Schema.String)),
  /** Raw hex escape sequences (e.g. "0x1b", "0x5b") */
  inputHex: Schema.optional(Schema.Array(Schema.String)),
  /** Bracketed paste text (prevents shell auto-execution) */
  inputPaste: Schema.optional(Schema.String),
  /** Kill the session */
  kill: Schema.optional(Schema.Boolean),
  /** Signal to send on kill (default: SIGTERM/15) */
  signal: Schema.optional(Schema.Number),
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
  data: Schema.optional(Schema.String),
  /** Named keys with modifier support */
  inputKeys: Schema.optional(Schema.Array(Schema.String)),
  /** Raw hex escape sequences */
  inputHex: Schema.optional(Schema.Array(Schema.String)),
  /** Bracketed paste text */
  inputPaste: Schema.optional(Schema.String),
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

// ─────────────────────────────────────────────────────────────────────────────
// Control Model — Mode-Based Switching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three control modes governing who owns terminal stdin:
 * - agent-controlled: Agent writes freely, human input blocked (or triggers takeover)
 * - human-controlled: Human writes freely, agent writes queued/rejected
 * - supervised: Agent runs, human can interrupt by typing (auto-yields back after idle)
 */
export const ControlMode = Schema.Literal(
  'agent-controlled',
  'human-controlled',
  'supervised',
)
export type ControlMode = typeof ControlMode.Type

/** Who currently holds stdin */
export const ControllerRole = Schema.Literal('agent', 'human')
export type ControllerRole = typeof ControllerRole.Type

// ── Control Events (flow through shell-session-atoms) ────────────────────────

/** Human requests control of the terminal */
export const RequestTakeover = Schema.TaggedStruct('control:request_takeover', {
  sessionId: ShellSessionId,
  timestamp: Schema.Number,
})
export type RequestTakeover = typeof RequestTakeover.Type

/** Current controller yields back to the other party */
export const YieldControl = Schema.TaggedStruct('control:yield', {
  sessionId: ShellSessionId,
  from: ControllerRole,
  timestamp: Schema.Number,
})
export type YieldControl = typeof YieldControl.Type

/** Agent wrote to the terminal (for activity tracking + typing indicator) */
export const AgentWrite = Schema.TaggedStruct('control:agent_write', {
  sessionId: ShellSessionId,
  /** The command/data the agent sent */
  data: Schema.String,
  timestamp: Schema.Number,
})
export type AgentWrite = typeof AgentWrite.Type

/** Human typed in the terminal (for activity tracking + auto-takeover) */
export const HumanKeystroke = Schema.TaggedStruct('control:human_keystroke', {
  sessionId: ShellSessionId,
  /** Byte count of the keystroke (not the actual content for privacy) */
  byteCount: Schema.Number,
  timestamp: Schema.Number,
})
export type HumanKeystroke = typeof HumanKeystroke.Type

/** Explicit mode switch request */
export const ModeSwitch = Schema.TaggedStruct('control:mode_switch', {
  sessionId: ShellSessionId,
  mode: ControlMode,
  timestamp: Schema.Number,
})
export type ModeSwitch = typeof ModeSwitch.Type

/** Union of all control events */
export const ControlEvent = Schema.Union(
  RequestTakeover,
  YieldControl,
  AgentWrite,
  HumanKeystroke,
  ModeSwitch,
)
export type ControlEvent = typeof ControlEvent.Type

// ── Activity Log Entry ───────────────────────────────────────────────────────

/** Tracks who did what, when — feeds the activity log panel */
export const ActivitySource = Schema.Literal('agent', 'human', 'system')
export type ActivitySource = typeof ActivitySource.Type

export const ActivityEntry = Schema.Struct({
  source: ActivitySource,
  action: Schema.String,
  timestamp: Schema.Number,
  /** Optional: the actual command text (only for commands, not raw keystrokes) */
  command: Schema.optional(Schema.String),
})
export type ActivityEntry = typeof ActivityEntry.Type

// ── Control WS Commands (Client → Server) ────────────────────────────────────

export const ShellTakeControlCommand = Schema.TaggedStruct('remote:shell_take_control', {
  sessionId: ShellSessionId,
})

export const ShellYieldControlCommand = Schema.TaggedStruct('remote:shell_yield_control', {
  sessionId: ShellSessionId,
})

export const ShellSwitchModeCommand = Schema.TaggedStruct('remote:shell_switch_mode', {
  sessionId: ShellSessionId,
  mode: ControlMode,
})

// ── Control WS Events (Server → Client) ──────────────────────────────────────

/** Broadcast when control state changes */
export const ShellControlChangedEvent = Schema.TaggedStruct('shell:control_changed', {
  sessionId: ShellSessionId,
  mode: ControlMode,
  controller: ControllerRole,
  timestamp: Schema.Number,
})
export type ShellControlChangedEvent = typeof ShellControlChangedEvent.Type

// ─────────────────────────────────────────────────────────────────────────────
// Unified Unions (updated with control additions)
// ─────────────────────────────────────────────────────────────────────────────

export const ShellCommand = Schema.Union(
  ShellInputCommand,
  ShellResizeCommand,
  ShellKillCommand,
  ShellTakeControlCommand,
  ShellYieldControlCommand,
  ShellSwitchModeCommand,
)
export type ShellCommand = typeof ShellCommand.Type

/** Union of all shell events */
export const ShellEvent = Schema.Union(
  ShellDataEvent,
  ShellStartedEvent,
  ShellExitedEvent,
  ShellErrorEvent,
  ShellControlChangedEvent,
)
export type ShellEvent = typeof ShellEvent.Type
