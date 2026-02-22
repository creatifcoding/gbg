/**
 * Terminal rendering primitives for tool output.
 *
 * Architecture:
 *   TerminalCore     — Shared ghostty-web base (WASM init, theme, ref API)
 *     ├── TerminalOutput       — Read-only (bash tool results, streaming)
 *     └── InteractiveTerminal  — Read-write (PTY-connected interactive shell)
 *
 * @module chat/msg/tool-block/renderers/terminal
 */

// ── Core ────────────────────────────────────────────────────────────────────
export { TerminalCore, TMNL_TERMINAL_THEME, stripAnsi, toTerminalLineEndings } from './terminal-core'
export type { TerminalCoreRef, TerminalCoreProps } from './terminal-core'

// ── Read-only output (bash tool) ────────────────────────────────────────────
export { TerminalOutput } from './terminal-output'
export type { TerminalOutputProps } from './terminal-output'

// ── Interactive terminal (interactive_shell tool) ───────────────────────────
export { InteractiveTerminal } from './interactive-terminal'
export type { InteractiveTerminalProps, InteractiveTerminalRef } from './interactive-terminal'

// ── Streaming infrastructure ────────────────────────────────────────────────
export { useToolStream } from './use-tool-stream'
export type { UseToolStreamResult } from './use-tool-stream'

export { toolStreamSink, toolStreamFinalize, toolStreamError } from './tool-stream-sink'
export type { ToolStreamEvent } from './tool-stream-sink'

export { toolStreamRegistry, toolStreamsAtom, toolStreamFamily } from './tool-stream-registry'

export type { ToolStreamLine, ToolStreamState, ToolStreamChunk, ToolStreamPhase } from './schemas'
export { EMPTY_TOOL_STREAM_STATE, ToolStreamChunk as ToolStreamChunkSchema } from './schemas'
