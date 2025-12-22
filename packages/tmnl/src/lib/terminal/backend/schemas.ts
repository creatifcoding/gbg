/**
 * Terminal Backend Schemas
 *
 * Unified configuration schemas for terminal backends (PTY, SSH, etc.)
 * All configs are Schema-backed for runtime validation and type inference.
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Common Terminal Settings
// ─────────────────────────────────────────────────────────────────────────────

export const TerminalDimensions = Schema.Struct({
  cols: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 80,
  }),
  rows: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 24,
  }),
})
export type TerminalDimensions = typeof TerminalDimensions.Type

export const TerminalEnv = Schema.Record({
  key: Schema.String,
  value: Schema.String,
})
export type TerminalEnv = typeof TerminalEnv.Type

// ─────────────────────────────────────────────────────────────────────────────
// PTY Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const PtyConfig = Schema.Struct({
  _tag: Schema.optionalWith(Schema.Literal('PtyConfig'), {
    default: () => 'PtyConfig' as const,
  }),
  shell: Schema.optionalWith(Schema.String, {
    default: () => (process.platform === 'win32' ? 'powershell.exe' : 'bash'),
  }),
  args: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  cwd: Schema.optional(Schema.String),
  env: Schema.optional(TerminalEnv),
  cols: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 80,
  }),
  rows: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 24,
  }),
  term: Schema.optionalWith(Schema.String, { default: () => 'xterm-256color' }),
})
export type PtyConfig = typeof PtyConfig.Type

// ─────────────────────────────────────────────────────────────────────────────
// SSH Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const SshAuthMethod = Schema.Union(
  Schema.TaggedStruct('PrivateKey', {
    privateKey: Schema.String,
    passphrase: Schema.optional(Schema.String),
  }),
  Schema.TaggedStruct('Password', {
    password: Schema.String,
  }),
  Schema.TaggedStruct('Agent', {
    agentSocket: Schema.optional(Schema.String), // defaults to SSH_AUTH_SOCK
  })
)
export type SshAuthMethod = typeof SshAuthMethod.Type

export const SshConfig = Schema.Struct({
  _tag: Schema.optionalWith(Schema.Literal('SshConfig'), {
    default: () => 'SshConfig' as const,
  }),
  host: Schema.String,
  port: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 22,
  }),
  username: Schema.String,
  auth: SshAuthMethod,
  // Terminal settings
  cols: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 80,
  }),
  rows: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), {
    default: () => 24,
  }),
  term: Schema.optionalWith(Schema.String, { default: () => 'xterm-256color' }),
  // SSH-specific options
  keepaliveInterval: Schema.optionalWith(Schema.Number, { default: () => 10000 }),
  keepaliveCountMax: Schema.optionalWith(Schema.Number, { default: () => 3 }),
  readyTimeout: Schema.optionalWith(Schema.Number, { default: () => 20000 }),
})
export type SshConfig = typeof SshConfig.Type

// ─────────────────────────────────────────────────────────────────────────────
// Unified Terminal Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const TerminalConfig = Schema.Union(PtyConfig, SshConfig)
export type TerminalConfig = typeof TerminalConfig.Type

// ─────────────────────────────────────────────────────────────────────────────
// Session Info (backend-agnostic)
// ─────────────────────────────────────────────────────────────────────────────

export const BackendType = Schema.Literal('pty', 'ssh')
export type BackendType = typeof BackendType.Type

export const SessionStatus = Schema.Literal('connecting', 'ready', 'disconnected', 'error')
export type SessionStatus = typeof SessionStatus.Type

export const TerminalSessionInfo = Schema.Struct({
  id: Schema.String,
  backend: BackendType,
  status: SessionStatus,
  cols: Schema.Number,
  rows: Schema.Number,
  createdAt: Schema.DateFromSelf,
  // PTY-specific (optional)
  pid: Schema.optional(Schema.Number),
  shell: Schema.optional(Schema.String),
  // SSH-specific (optional)
  host: Schema.optional(Schema.String),
  username: Schema.optional(Schema.String),
})
export type TerminalSessionInfo = typeof TerminalSessionInfo.Type
