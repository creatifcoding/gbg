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

// Quiet monitor (hands-free / dispatch lifecycle)
export {
  makeCompletionGate,
  makeHandsFreeUpdates,
  DEFAULT_HANDS_FREE_CONFIG,
  type HandsFreeConfig,
  type CompletionInfo,
  type HandsFreeUpdate,
} from './quiet-monitor'

// Config
export {
  InteractiveShellConfig,
  InteractiveShellConfigTag,
  InteractiveShellConfigDefault,
  InteractiveShellConfigFromEnv,
} from './config'

// Key encoding utilities
export {
  translateInput,
  encodeKeyToken,
  decodeHexBytes,
  type StructuredInput,
} from './key-encoding'

// Worker schema (for tests / direct worker usage)
export {
  PtyWorkerMessage,
  PtySpawn,
  PtyWrite,
  PtyResize,
  PtyKill,
  PtyDumpScreen,
  PtyReadOutput,
  PtyOutputChunk,
  PtySpawnResult,
  PtyExitResult,
  PtyScreenDumpResult,
  PtyRawOutputResult,
  PtyWorkerError,
  ScreenDumpMode,
} from './pty-worker-schema'

// Client-side Atom.family session state + shell IO bridge
export {
  shellSessionFamily,
  activeSessionIds$,
  activeSessionCount$,
  subscribeShellData,
  dispatchShellEvent,
  cleanupSession,
  setShellRegistry,
  registerShellCommandSender,
  clearShellCommandSender,
  sendShellInput,
  sendShellResize,
  sendShellKill,
  type ShellSessionAtoms,
} from './shell-session-atoms'

// Legacy callback bridge (backward compat)
export {
  subscribeShellEvents,
  subscribeAllShellEvents,
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
