/**
 * Code Editor Domain Schemas
 *
 * Effect.Schema-backed types for the Monaco code editor system.
 * Defines tabs, document state, editor configuration, and LSP status.
 *
 * @module code-editor/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Branded IDs
// =============================================================================

/** Unique tab identifier */
export const TabId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('TabId'),
)
export type TabId = typeof TabId.Type

// =============================================================================
// Enums (Schema.Literal)
// =============================================================================

/** Editor layout mode */
export const EditorLayout = Schema.Literal('single', 'split-h', 'split-v')
export type EditorLayout = typeof EditorLayout.Type

/** LSP connection state */
export const LspStatus = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'error',
)
export type LspStatus = typeof LspStatus.Type

/** Supported languages */
export const LanguageId = Schema.Literal(
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact',
  'rust',
  'python',
  'lua',
  'css',
  'scss',
  'html',
  'json',
  'markdown',
  'yaml',
  'toml',
  'nix',
  'plaintext',
)
export type LanguageId = typeof LanguageId.Type

/** Indent style */
export const IndentStyle = Schema.Literal('spaces', 'tabs')
export type IndentStyle = typeof IndentStyle.Type

/** Cursor position */
export const CursorPosition = Schema.Struct({
  line: Schema.Number,
  column: Schema.Number,
})
export type CursorPosition = typeof CursorPosition.Type

// =============================================================================
// Core Domain Types
// =============================================================================

/** A single editor tab */
export const EditorTab = Schema.TaggedStruct('EditorTab', {
  id: TabId,
  /** File URI — e.g. file:///workspace/src/main.ts */
  uri: Schema.String,
  /** Language identifier for Monaco */
  language: Schema.String,
  /** Display label — e.g. main.ts */
  label: Schema.String,
  /** Whether the buffer has unsaved changes */
  dirty: Schema.Boolean,
  /** Whether the tab is pinned (won't close with "close all") */
  pinned: Schema.Boolean,
})
export type EditorTab = typeof EditorTab.Type

/** Editor state — the root atom shape */
export const EditorState = Schema.Struct({
  /** All open tabs */
  tabs: Schema.Array(EditorTab),
  /** Currently focused tab ID (null if no tabs open) */
  activeTabId: Schema.NullOr(TabId),
  /** Layout mode */
  layout: EditorLayout,
})
export type EditorState = typeof EditorState.Type

/** Editor configuration — user preferences */
export const EditorConfig = Schema.Struct({
  /** Font family */
  fontFamily: Schema.String,
  /** Font size in pixels */
  fontSize: Schema.Number.pipe(Schema.greaterThanOrEqualTo(8), Schema.lessThanOrEqualTo(72)),
  /** Line height multiplier */
  lineHeight: Schema.Number,
  /** Letter spacing in px */
  letterSpacing: Schema.Number,
  /** Tab size in spaces */
  tabSize: Schema.Number.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(8)),
  /** Indent style */
  indentStyle: IndentStyle,
  /** Whether minimap is enabled */
  minimap: Schema.Boolean,
  /** Whether line numbers are shown */
  lineNumbers: Schema.Boolean,
  /** Whether word wrap is enabled */
  wordWrap: Schema.Boolean,
  /** Whether vim mode is enabled */
  vimMode: Schema.Boolean,
})
export type EditorConfig = typeof EditorConfig.Type

/** Default editor configuration */
export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  fontFamily: '"Share Tech Mono", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 13,
  lineHeight: 1.6,
  letterSpacing: 0.3,
  tabSize: 2,
  indentStyle: 'spaces',
  minimap: false,
  lineNumbers: true,
  wordWrap: false,
  vimMode: true,
}

/** File metadata — information about an open file */
export const FileMetadata = Schema.TaggedStruct('FileMetadata', {
  /** File path on disk */
  path: Schema.String,
  /** File size in bytes */
  size: Schema.Number,
  /** Encoding (UTF-8, etc.) */
  encoding: Schema.String,
  /** Line ending style */
  lineEnding: Schema.Literal('lf', 'crlf'),
  /** Last modified timestamp */
  lastModified: Schema.Number,
})
export type FileMetadata = typeof FileMetadata.Type

/** Vim mode state */
export const VimMode = Schema.Literal('normal', 'insert', 'visual', 'replace', 'command')
export type VimMode = typeof VimMode.Type

/** Status line state — drives the bottom status bar */
export const StatusLineState = Schema.Struct({
  /** Cursor position */
  cursor: CursorPosition,
  /** Current language */
  language: Schema.String,
  /** File encoding */
  encoding: Schema.String,
  /** Indent info */
  indentStyle: IndentStyle,
  tabSize: Schema.Number,
  /** LSP connection status */
  lspStatus: LspStatus,
  /** Vim mode (if active) */
  vimMode: Schema.NullOr(VimMode),
  /** Selection count (chars selected) */
  selectionCount: Schema.Number,
})
export type StatusLineState = typeof StatusLineState.Type
