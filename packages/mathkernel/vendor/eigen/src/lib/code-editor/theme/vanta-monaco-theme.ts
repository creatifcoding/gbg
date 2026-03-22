/**
 * VANTA Monaco Theme — defineTheme() Registration
 *
 * Converts the VANTA design system tokens into a Monaco editor theme.
 * Void-black surfaces, cyan phosphor accents, monospace precision.
 *
 * @module code-editor/theme/vanta-monaco-theme
 */

import type * as monaco from 'monaco-editor'
import { VANTA_COLORS } from '@/components/portal/tokens'

// =============================================================================
// Theme Name (constant)
// =============================================================================

export const VANTA_THEME_ID = 'vanta-void' as const

// =============================================================================
// Theme Definition
// =============================================================================

/**
 * The full VANTA theme definition for Monaco.
 * Register with: `monaco.editor.defineTheme(VANTA_THEME_ID, VANTA_THEME_DATA)`
 */
export const VANTA_THEME_DATA: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // ─── Syntax ──────────────────────────────────────
    { token: 'comment', foreground: '525252', fontStyle: 'italic' },
    { token: 'keyword', foreground: '22d3ee' },           // cyan
    { token: 'keyword.control', foreground: '22d3ee' },
    { token: 'keyword.operator', foreground: '737373' },
    { token: 'string', foreground: '34d399' },             // emerald
    { token: 'string.escape', foreground: '059669' },
    { token: 'number', foreground: 'fbbf24' },             // amber
    { token: 'number.hex', foreground: 'fbbf24' },
    { token: 'type', foreground: 'a78bfa' },               // violet
    { token: 'type.identifier', foreground: 'a78bfa' },
    { token: 'function', foreground: 'e5e5e5' },           // primary text
    { token: 'function.declaration', foreground: 'e5e5e5' },
    { token: 'variable', foreground: 'a3a3a3' },           // secondary text
    { token: 'variable.predefined', foreground: 'a78bfa' },
    { token: 'operator', foreground: '737373' },            // tertiary
    { token: 'delimiter', foreground: '525252' },           // muted
    { token: 'delimiter.bracket', foreground: '737373' },
    { token: 'tag', foreground: 'fb7185' },                 // rose
    { token: 'tag.id', foreground: 'fb7185' },
    { token: 'attribute.name', foreground: '22d3ee' },      // cyan
    { token: 'attribute.value', foreground: '34d399' },     // emerald

    // ─── Special ─────────────────────────────────────
    { token: 'regexp', foreground: 'fb7185' },              // rose
    { token: 'annotation', foreground: 'fbbf24' },          // amber
    { token: 'constant', foreground: 'a78bfa' },            // violet
    { token: 'constant.language', foreground: 'a78bfa' },

    // ─── Markup/Markdown ─────────────────────────────
    { token: 'markup.heading', foreground: '22d3ee', fontStyle: 'bold' },
    { token: 'markup.bold', fontStyle: 'bold' },
    { token: 'markup.italic', fontStyle: 'italic' },
    { token: 'markup.inline', foreground: '34d399' },

    // ─── Meta ────────────────────────────────────────
    { token: 'meta.tag', foreground: 'fb7185' },
    { token: 'metatag', foreground: '22d3ee' },
    { token: 'invalid', foreground: 'fb7185', fontStyle: 'underline' },
  ],
  colors: {
    // ─── Editor Chrome ───────────────────────────────
    'editor.background': VANTA_COLORS.surface.void,
    'editor.foreground': VANTA_COLORS.text.primary,
    'editor.lineHighlightBackground': VANTA_COLORS.surface.elevated,
    'editor.lineHighlightBorder': '#00000000',               // transparent
    'editor.selectionBackground': VANTA_COLORS.accent.cyanGlow,
    'editor.inactiveSelectionBackground': 'rgba(34, 211, 238, 0.08)',
    'editor.selectionHighlightBackground': 'rgba(34, 211, 238, 0.10)',
    'editorCursor.foreground': VANTA_COLORS.accent.cyan,
    'editorLineNumber.foreground': VANTA_COLORS.text.muted,
    'editorLineNumber.activeForeground': VANTA_COLORS.text.secondary,
    'editorIndentGuide.background': '#0f0f0f',
    'editorIndentGuide.activeBackground': VANTA_COLORS.surface.border,
    'editorWhitespace.foreground': VANTA_COLORS.text.muted,

    // ─── Gutter ──────────────────────────────────────
    'editorGutter.background': VANTA_COLORS.surface.void,
    'editorGutter.modifiedBackground': VANTA_COLORS.accent.amber,
    'editorGutter.addedBackground': VANTA_COLORS.accent.emerald,
    'editorGutter.deletedBackground': VANTA_COLORS.accent.rose,

    // ─── Widgets (autocomplete, hover) ───────────────
    'editorWidget.background': VANTA_COLORS.surface.base,
    'editorWidget.border': VANTA_COLORS.surface.border,
    'editorWidget.foreground': VANTA_COLORS.text.primary,
    'editorSuggestWidget.background': VANTA_COLORS.surface.base,
    'editorSuggestWidget.border': VANTA_COLORS.surface.border,
    'editorSuggestWidget.foreground': VANTA_COLORS.text.primary,
    'editorSuggestWidget.highlightForeground': VANTA_COLORS.accent.cyan,
    'editorSuggestWidget.selectedBackground': VANTA_COLORS.accent.cyanGlow,
    'editorHoverWidget.background': VANTA_COLORS.surface.base,
    'editorHoverWidget.border': VANTA_COLORS.surface.border,
    'editorHoverWidget.foreground': VANTA_COLORS.text.primary,

    // ─── Bracket Pair Colors ─────────────────────────
    'editorBracketMatch.background': 'rgba(34, 211, 238, 0.10)',
    'editorBracketMatch.border': VANTA_COLORS.accent.cyanMuted,
    'editorBracketHighlight.foreground1': VANTA_COLORS.accent.cyan,
    'editorBracketHighlight.foreground2': VANTA_COLORS.accent.violet,
    'editorBracketHighlight.foreground3': VANTA_COLORS.accent.amber,
    'editorBracketHighlight.foreground4': VANTA_COLORS.accent.emerald,
    'editorBracketHighlight.foreground5': VANTA_COLORS.accent.rose,
    'editorBracketHighlight.foreground6': VANTA_COLORS.text.secondary,

    // ─── Minimap (disabled but themed) ───────────────
    'minimap.background': VANTA_COLORS.surface.void,

    // ─── Scrollbar ───────────────────────────────────
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': 'rgba(255, 255, 255, 0.10)',
    'scrollbarSlider.hoverBackground': 'rgba(255, 255, 255, 0.15)',
    'scrollbarSlider.activeBackground': 'rgba(255, 255, 255, 0.20)',

    // ─── Find/Replace ────────────────────────────────
    'editor.findMatchBackground': 'rgba(251, 191, 36, 0.20)',
    'editor.findMatchHighlightBackground': 'rgba(251, 191, 36, 0.10)',
    'editor.findRangeHighlightBackground': 'rgba(34, 211, 238, 0.05)',

    // ─── Error/Warning Squiggles ─────────────────────
    'editorError.foreground': VANTA_COLORS.accent.rose,
    'editorWarning.foreground': VANTA_COLORS.accent.amber,
    'editorInfo.foreground': VANTA_COLORS.accent.cyan,

    // ─── Peek View ───────────────────────────────────
    'peekView.border': VANTA_COLORS.accent.cyanMuted,
    'peekViewEditor.background': VANTA_COLORS.surface.base,
    'peekViewResult.background': VANTA_COLORS.surface.elevated,
    'peekViewTitle.background': VANTA_COLORS.surface.base,
    'peekViewTitleLabel.foreground': VANTA_COLORS.text.primary,
    'peekViewTitleDescription.foreground': VANTA_COLORS.text.secondary,

    // ─── Diff Editor ─────────────────────────────────
    'diffEditor.insertedTextBackground': 'rgba(52, 211, 153, 0.08)',
    'diffEditor.removedTextBackground': 'rgba(251, 113, 133, 0.08)',

    // ─── Focus ───────────────────────────────────────
    focusBorder: VANTA_COLORS.accent.cyan,
  },
}

// =============================================================================
// TMNL Default Editor Options
// =============================================================================

/**
 * Standard Monaco editor constructor options with VANTA defaults.
 * Apply these when creating any editor instance in TMNL.
 */
export const TMNL_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: VANTA_THEME_ID,
  fontFamily: '"Share Tech Mono", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 13,
  lineHeight: 1.6,
  letterSpacing: 0.3,
  cursorStyle: 'block',
  cursorBlinking: 'phase',
  cursorSmoothCaretAnimation: 'on',
  smoothScrolling: true,
  minimap: { enabled: false },
  renderLineHighlight: 'gutter',
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  renderWhitespace: 'none',
  guides: {
    indentation: true,
    bracketPairs: true,
  },
  bracketPairColorization: {
    enabled: true,
    independentColorPoolPerBracketType: true,
  },
  // Accessibility
  accessibilitySupport: 'off',
  // Performance
  fastScrollSensitivity: 5,
  mouseWheelScrollSensitivity: 1,
}
