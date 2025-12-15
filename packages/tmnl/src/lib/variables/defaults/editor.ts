/**
 * TMNL Variables — Editor Variables
 *
 * Default editor-related variables.
 * Import this module to register the variables.
 */

import { Schema } from 'effect'
import { defineVariable } from '../define'

// ─────────────────────────────────────────────────────────────────────────────
// Indentation
// ─────────────────────────────────────────────────────────────────────────────

export const tabWidth = defineVariable({
  id: 'editor.tabWidth',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 16)),
  default: 4,
  description: 'Number of spaces per tab character',
  group: 'editor',
  scope: 'editor',
})

export const insertSpaces = defineVariable({
  id: 'editor.insertSpaces',
  schema: Schema.Boolean,
  default: true,
  description: 'Insert spaces when pressing Tab',
  group: 'editor',
  scope: 'editor',
})

export const detectIndentation = defineVariable({
  id: 'editor.detectIndentation',
  schema: Schema.Boolean,
  default: true,
  description: 'Automatically detect indentation settings from file content',
  group: 'editor',
  scope: 'editor',
})

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

export const fontSize = defineVariable({
  id: 'editor.fontSize',
  schema: Schema.Number.pipe(Schema.between(8, 72)),
  default: 14,
  description: 'Font size in pixels',
  group: 'editor',
  scope: 'global',
})

export const fontFamily = defineVariable({
  id: 'editor.fontFamily',
  schema: Schema.String.pipe(Schema.minLength(1)),
  default: 'JetBrains Mono, Fira Code, Consolas, monospace',
  description: 'Font family for editor text',
  group: 'editor',
  scope: 'global',
})

export const lineHeight = defineVariable({
  id: 'editor.lineHeight',
  schema: Schema.Number.pipe(Schema.between(1, 3)),
  default: 1.5,
  description: 'Line height multiplier',
  group: 'editor',
  scope: 'global',
})

export const wordWrap = defineVariable({
  id: 'editor.wordWrap',
  schema: Schema.Literal('off', 'on', 'wordWrapColumn', 'bounded'),
  default: 'off',
  description: 'How to wrap long lines',
  group: 'editor',
  scope: 'editor',
})

export const wordWrapColumn = defineVariable({
  id: 'editor.wordWrapColumn',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(40, 200)),
  default: 80,
  description: 'Column at which to wrap lines (when wordWrap is wordWrapColumn)',
  group: 'editor',
  scope: 'editor',
})

// ─────────────────────────────────────────────────────────────────────────────
// Cursor
// ─────────────────────────────────────────────────────────────────────────────

export const cursorStyle = defineVariable({
  id: 'editor.cursorStyle',
  schema: Schema.Literal('line', 'block', 'underline', 'line-thin', 'block-outline', 'underline-thin'),
  default: 'line',
  description: 'Cursor style',
  group: 'editor',
  scope: 'global',
})

export const cursorBlinking = defineVariable({
  id: 'editor.cursorBlinking',
  schema: Schema.Literal('blink', 'smooth', 'phase', 'expand', 'solid'),
  default: 'blink',
  description: 'Cursor blinking animation style',
  group: 'editor',
  scope: 'global',
})

export const cursorWidth = defineVariable({
  id: 'editor.cursorWidth',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  default: 2,
  description: 'Cursor width in pixels (for line cursor)',
  group: 'editor',
  scope: 'global',
})

// ─────────────────────────────────────────────────────────────────────────────
// Minimap
// ─────────────────────────────────────────────────────────────────────────────

export const minimapEnabled = defineVariable({
  id: 'editor.minimap.enabled',
  schema: Schema.Boolean,
  default: true,
  description: 'Show minimap',
  group: 'editor',
  scope: 'global',
})

export const minimapSide = defineVariable({
  id: 'editor.minimap.side',
  schema: Schema.Literal('left', 'right'),
  default: 'right',
  description: 'Minimap position',
  group: 'editor',
  scope: 'global',
})

export const minimapMaxColumn = defineVariable({
  id: 'editor.minimap.maxColumn',
  schema: Schema.Number.pipe(Schema.int(), Schema.between(40, 200)),
  default: 120,
  description: 'Maximum column width for minimap',
  group: 'editor',
  scope: 'global',
})

// ─────────────────────────────────────────────────────────────────────────────
// Scrolling
// ─────────────────────────────────────────────────────────────────────────────

export const smoothScrolling = defineVariable({
  id: 'editor.smoothScrolling',
  schema: Schema.Boolean,
  default: true,
  description: 'Enable smooth scrolling animation',
  group: 'editor',
  scope: 'global',
})

export const scrollBeyondLastLine = defineVariable({
  id: 'editor.scrollBeyondLastLine',
  schema: Schema.Boolean,
  default: true,
  description: 'Allow scrolling past the last line',
  group: 'editor',
  scope: 'global',
})

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

export const renderWhitespace = defineVariable({
  id: 'editor.renderWhitespace',
  schema: Schema.Literal('none', 'boundary', 'selection', 'trailing', 'all'),
  default: 'selection',
  description: 'When to render whitespace characters',
  group: 'editor',
  scope: 'editor',
})

export const renderLineHighlight = defineVariable({
  id: 'editor.renderLineHighlight',
  schema: Schema.Literal('none', 'gutter', 'line', 'all'),
  default: 'line',
  description: 'How to highlight the current line',
  group: 'editor',
  scope: 'global',
})

export const lineNumbers = defineVariable({
  id: 'editor.lineNumbers',
  schema: Schema.Literal('off', 'on', 'relative', 'interval'),
  default: 'on',
  description: 'Line number display mode',
  group: 'editor',
  scope: 'editor',
})

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Features
// ─────────────────────────────────────────────────────────────────────────────

export const autoClosingBrackets = defineVariable({
  id: 'editor.autoClosingBrackets',
  schema: Schema.Literal('always', 'languageDefined', 'beforeWhitespace', 'never'),
  default: 'languageDefined',
  description: 'When to auto-close brackets',
  group: 'editor',
  scope: 'editor',
})

export const autoClosingQuotes = defineVariable({
  id: 'editor.autoClosingQuotes',
  schema: Schema.Literal('always', 'languageDefined', 'beforeWhitespace', 'never'),
  default: 'languageDefined',
  description: 'When to auto-close quotes',
  group: 'editor',
  scope: 'editor',
})

export const autoIndent = defineVariable({
  id: 'editor.autoIndent',
  schema: Schema.Literal('none', 'keep', 'brackets', 'advanced', 'full'),
  default: 'full',
  description: 'Auto-indentation mode',
  group: 'editor',
  scope: 'editor',
})

// ─────────────────────────────────────────────────────────────────────────────
// Export All
// ─────────────────────────────────────────────────────────────────────────────

export const allEditorVariables = [
  tabWidth,
  insertSpaces,
  detectIndentation,
  fontSize,
  fontFamily,
  lineHeight,
  wordWrap,
  wordWrapColumn,
  cursorStyle,
  cursorBlinking,
  cursorWidth,
  minimapEnabled,
  minimapSide,
  minimapMaxColumn,
  smoothScrolling,
  scrollBeyondLastLine,
  renderWhitespace,
  renderLineHighlight,
  lineNumbers,
  autoClosingBrackets,
  autoClosingQuotes,
  autoIndent,
] as const
