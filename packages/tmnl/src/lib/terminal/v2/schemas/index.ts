/**
 * Terminal v2 Schemas
 *
 * Effect Schema definitions for terminal state and events.
 */

import { Schema } from 'effect'

// =============================================================================
// Terminal Status
// =============================================================================

export const TerminalStatus = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'error'
)
export type TerminalStatus = typeof TerminalStatus.Type

// =============================================================================
// Terminal Mode
// =============================================================================

export const TerminalMode = Schema.Literal('ghostty', 'openwarp')
export type TerminalMode = typeof TerminalMode.Type

// =============================================================================
// Cursor Style
// =============================================================================

export const CursorStyle = Schema.Literal('block', 'underline', 'bar')
export type CursorStyle = typeof CursorStyle.Type

// =============================================================================
// Terminal Theme
// =============================================================================

export const TerminalTheme = Schema.Struct({
  foreground: Schema.String,
  background: Schema.String,
  cursor: Schema.String,
  cursorAccent: Schema.optional(Schema.String),
  selectionBackground: Schema.optional(Schema.String),
  selectionForeground: Schema.optional(Schema.String),
  selectionInactiveBackground: Schema.optional(Schema.String),
  black: Schema.String,
  red: Schema.String,
  green: Schema.String,
  yellow: Schema.String,
  blue: Schema.String,
  magenta: Schema.String,
  cyan: Schema.String,
  white: Schema.String,
  brightBlack: Schema.String,
  brightRed: Schema.String,
  brightGreen: Schema.String,
  brightYellow: Schema.String,
  brightBlue: Schema.String,
  brightMagenta: Schema.String,
  brightCyan: Schema.String,
  brightWhite: Schema.String,
})
export type TerminalTheme = typeof TerminalTheme.Type

// =============================================================================
// Terminal Config
// =============================================================================

export const TerminalConfig = Schema.Struct({
  fontSize: Schema.Number.pipe(Schema.between(8, 32)),
  fontFamily: Schema.String,
  fontWeight: Schema.Literal('normal', 'bold'),
  lineHeight: Schema.Number.pipe(Schema.greaterThanOrEqualTo(1)),
  letterSpacing: Schema.Number,
  cursorBlink: Schema.Boolean,
  cursorStyle: CursorStyle,
  scrollback: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  theme: TerminalTheme,
})
export type TerminalConfig = typeof TerminalConfig.Type

// =============================================================================
// Terminal Instance State
// =============================================================================

export const TerminalInstanceState = Schema.Struct({
  id: Schema.String,
  status: TerminalStatus,
  mode: TerminalMode,
  pwd: Schema.optional(Schema.String),
  lastActivity: Schema.Number, // timestamp
  isReady: Schema.Boolean,
})
export type TerminalInstanceState = typeof TerminalInstanceState.Type

// =============================================================================
// PTY Spawn Options
// =============================================================================

export const PtySpawnOptions = Schema.Struct({
  shell: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.String),
  env: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  rows: Schema.Number.pipe(Schema.greaterThan(0)),
  cols: Schema.Number.pipe(Schema.greaterThan(0)),
})
export type PtySpawnOptions = typeof PtySpawnOptions.Type

// =============================================================================
// Terminal Events (for Effect.Stream)
// =============================================================================

export const TerminalDataEvent = Schema.TaggedStruct('TerminalData', {
  terminalId: Schema.String,
  data: Schema.String,
})
export type TerminalDataEvent = typeof TerminalDataEvent.Type

export const TerminalExitEvent = Schema.TaggedStruct('TerminalExit', {
  terminalId: Schema.String,
  code: Schema.Number,
})
export type TerminalExitEvent = typeof TerminalExitEvent.Type

export const TerminalPwdChangeEvent = Schema.TaggedStruct('TerminalPwdChange', {
  terminalId: Schema.String,
  pwd: Schema.String,
})
export type TerminalPwdChangeEvent = typeof TerminalPwdChangeEvent.Type

export const TerminalEvent = Schema.Union(
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalPwdChangeEvent
)
export type TerminalEvent = typeof TerminalEvent.Type

// =============================================================================
// Block Schemas (OpenWarp mode)
// =============================================================================

export {
  // Types
  BlockType,
  ToolCallStatus,
  // Block variants
  ToolCall,
  TokenUsage,
  CommandBlock,
  AIResponseBlock,
  InteractiveBlock,
  ErrorBlock,
  SystemBlock,
  Block,
  // State
  BlockTerminalState,
  INITIAL_BLOCK_STATE,
  // Helpers
  isInteractiveCommand,
  createCommandBlock,
  createAIResponseBlock,
  createInteractiveBlock,
  createErrorBlock,
  createSystemBlock,
  getBlockTime,
  isBlockActive,
} from './blocks'

export type {
  BlockType,
  ToolCallStatus,
  ToolCall,
  TokenUsage,
  CommandBlock,
  AIResponseBlock,
  InteractiveBlock,
  ErrorBlock,
  SystemBlock,
  Block,
  BlockTerminalState,
} from './blocks'
