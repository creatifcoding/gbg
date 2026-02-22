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
  PtyPoolConfigTag,
  PtyPoolConfigDefault,
  type InteractiveShellServiceShape,
  type PtyPoolConfig,
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

// Client-side shell event bridge (browser only)
export {
  subscribeShellEvents,
  subscribeAllShellEvents,
  dispatchShellEvent,
  sendShellInput,
  sendShellResize,
  sendShellKill,
  registerShellCommandSender,
  clearShellCommandSender,
} from './shell-client-atoms'

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
