/**
 * Interactive Shell — Harness-native PTY tool
 *
 * Public exports for the interactive shell subsystem.
 *
 * @module harness/interactive-shell
 */

export {
  InteractiveShellService,
  InteractiveShellServiceLive,
  SessionNotFoundError,
  type InteractiveShellServiceShape,
} from './InteractiveShellService'

export {
  INTERACTIVE_SHELL_TOOL_NAME,
  interactiveShellToolParameters,
  executeInteractiveShell,
} from './tool'

// Worker schema (for tests / direct worker usage)
export {
  PtyWorkerMessage,
  PtySpawn,
  PtyWrite,
  PtyResize,
  PtyKill,
  PtyOutputChunk,
  PtySpawnResult,
  PtyExitResult,
  PtyWorkerError,
} from './pty-worker-schema'

export {
  // Schemas
  ShellSessionId,
  ShellSessionStatus,
  InteractiveShellToolArgs,
  ShellSessionInfo,
  // WS Commands
  ShellInputCommand,
  ShellResizeCommand,
  ShellKillCommand,
  ShellCommand,
  // WS Events
  ShellDataEvent,
  ShellStartedEvent,
  ShellExitedEvent,
  ShellErrorEvent,
  ShellEvent,
} from './schemas'

export type {
  ShellSessionId as ShellSessionIdType,
  ShellSessionInfo as ShellSessionInfoType,
  ShellEvent as ShellEventType,
} from './schemas'
