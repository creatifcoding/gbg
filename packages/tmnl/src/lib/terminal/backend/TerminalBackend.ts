/**
 * TerminalBackend — Abstract terminal interface as Effect.Service
 *
 * This is the swappable layer that abstracts over different terminal backends:
 * - PTY (local shell via bun-pty)
 * - SSH (remote shell via ssh2)
 * - Future: Serial, Telnet, etc.
 *
 * The backend handles raw terminal operations. Session management
 * is handled by TerminalSessionManager which uses this service.
 */

import { Context, Effect, Layer, Stream, Scope, Data } from 'effect'
import type { TerminalConfig, BackendType } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Handle (backend-agnostic interface)
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalHandle {
  /** Unique identifier for this connection */
  readonly id: string

  /** Backend type (pty, ssh, etc.) */
  readonly backend: BackendType

  /** Current terminal dimensions */
  readonly cols: number
  readonly rows: number

  /** Backend-specific identifier (PID for PTY, undefined for SSH) */
  readonly pid?: number

  /** Write data to terminal stdin */
  readonly write: (data: string) => Effect.Effect<void, TerminalWriteError>

  /** Resize terminal */
  readonly resize: (cols: number, rows: number) => Effect.Effect<void, TerminalResizeError>

  /** Close/kill the terminal connection */
  readonly close: (signal?: string) => Effect.Effect<void>

  /** Stream of data from terminal stdout */
  readonly output: Stream.Stream<string, TerminalStreamError>

  /** Effect that completes when terminal exits/disconnects */
  readonly exited: Effect.Effect<TerminalExit>
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Info
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalExit {
  readonly exitCode: number
  readonly signal?: number | string
  readonly reason?: 'exit' | 'disconnect' | 'error'
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors (Tagged for Effect.catchTag)
// ─────────────────────────────────────────────────────────────────────────────

export class TerminalConnectError extends Data.TaggedError('TerminalConnectError')<{
  readonly reason: 'ConnectionFailed' | 'AuthFailed' | 'Timeout' | 'InvalidConfig' | 'BackendError'
  readonly message: string
  readonly cause?: unknown
}> {}

export class TerminalWriteError extends Data.TaggedError('TerminalWriteError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class TerminalResizeError extends Data.TaggedError('TerminalResizeError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class TerminalStreamError extends Data.TaggedError('TerminalStreamError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalBackendShape {
  /**
   * Connect to a terminal (spawn PTY or establish SSH connection)
   * Returns a scoped TerminalHandle that auto-cleans on scope close
   */
  readonly connect: (
    config: TerminalConfig
  ) => Effect.Effect<TerminalHandle, TerminalConnectError, Scope.Scope>

  /** Backend type identifier */
  readonly type: BackendType
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class TerminalBackend extends Context.Tag('tmnl/terminal/TerminalBackend')<
  TerminalBackend,
  TerminalBackendShape
>() {}
