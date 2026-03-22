/**
 * VANTA Syntax Token Rules — Extended Language Support
 *
 * Granular TextMate-style token rules for specific languages.
 * These extend the base theme rules in vanta-monaco-theme.ts.
 *
 * Color assignments follow the VANTA accent palette:
 * - cyan (#22d3ee)   → keywords, control flow, attributes
 * - emerald (#34d399) → strings, values, inserted
 * - amber (#fbbf24)   → numbers, constants, annotations, warnings
 * - rose (#fb7185)    → tags, errors, deleted, regexp
 * - violet (#a78bfa)  → types, classes, interfaces
 * - primary (#e5e5e5) → function names, identifiers
 * - secondary (#a3a3a3) → variables, parameters
 * - tertiary (#737373)  → operators, punctuation
 * - muted (#525252)     → comments, delimiters
 *
 * @module code-editor/theme/vanta-syntax-tokens
 */

import type * as monaco from 'monaco-editor'

// =============================================================================
// TypeScript / JavaScript Specific
// =============================================================================

export const TYPESCRIPT_TOKENS: monaco.editor.ITokenThemeRule[] = [
  // Interfaces / Types
  { token: 'type.identifier.ts', foreground: 'a78bfa' },
  { token: 'type.identifier.tsx', foreground: 'a78bfa' },

  // Decorators
  { token: 'tag.ts', foreground: 'fbbf24' },
  { token: 'tag.tsx', foreground: 'fbbf24' },

  // Template literals
  { token: 'string.template.ts', foreground: '34d399' },
  { token: 'string.template.tsx', foreground: '34d399' },

  // JSX
  { token: 'tag.tsx', foreground: 'fb7185' },
  { token: 'attribute.name.tsx', foreground: '22d3ee' },
  { token: 'attribute.value.tsx', foreground: '34d399' },
  { token: 'delimiter.tsx', foreground: '737373' },
]

// =============================================================================
// Rust Specific
// =============================================================================

export const RUST_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'keyword.rust', foreground: '22d3ee' },
  { token: 'keyword.control.rust', foreground: '22d3ee' },
  { token: 'type.identifier.rust', foreground: 'a78bfa' },
  { token: 'attribute.rust', foreground: 'fbbf24' },
  { token: 'string.rust', foreground: '34d399' },
  { token: 'number.rust', foreground: 'fbbf24' },
  { token: 'comment.rust', foreground: '525252', fontStyle: 'italic' },
  { token: 'macro.rust', foreground: 'fb7185' },
  { token: 'lifetime.rust', foreground: 'a78bfa', fontStyle: 'italic' },
]

// =============================================================================
// Python Specific
// =============================================================================

export const PYTHON_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'keyword.python', foreground: '22d3ee' },
  { token: 'type.identifier.python', foreground: 'a78bfa' },
  { token: 'string.python', foreground: '34d399' },
  { token: 'string.escape.python', foreground: '059669' },
  { token: 'number.python', foreground: 'fbbf24' },
  { token: 'decorator.python', foreground: 'fbbf24' },
  { token: 'builtin.python', foreground: 'a78bfa' },
]

// =============================================================================
// CSS / SCSS
// =============================================================================

export const CSS_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'tag.css', foreground: 'fb7185' },
  { token: 'attribute.name.css', foreground: '22d3ee' },
  { token: 'attribute.value.css', foreground: '34d399' },
  { token: 'attribute.value.number.css', foreground: 'fbbf24' },
  { token: 'attribute.value.unit.css', foreground: 'a78bfa' },
  { token: 'delimiter.css', foreground: '737373' },
  { token: 'variable.css', foreground: '22d3ee' },
]

// =============================================================================
// HTML
// =============================================================================

export const HTML_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'tag.html', foreground: 'fb7185' },
  { token: 'attribute.name.html', foreground: '22d3ee' },
  { token: 'attribute.value.html', foreground: '34d399' },
  { token: 'delimiter.html', foreground: '737373' },
  { token: 'metatag.html', foreground: '22d3ee' },
  { token: 'metatag.content.html', foreground: '34d399' },
]

// =============================================================================
// JSON
// =============================================================================

export const JSON_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'string.key.json', foreground: '22d3ee' },
  { token: 'string.value.json', foreground: '34d399' },
  { token: 'number.json', foreground: 'fbbf24' },
  { token: 'keyword.json', foreground: 'a78bfa' },
  { token: 'delimiter.json', foreground: '737373' },
]

// =============================================================================
// YAML / TOML
// =============================================================================

export const YAML_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'type.yaml', foreground: '22d3ee' },
  { token: 'string.yaml', foreground: '34d399' },
  { token: 'number.yaml', foreground: 'fbbf24' },
  { token: 'keyword.yaml', foreground: 'a78bfa' },
  { token: 'comment.yaml', foreground: '525252', fontStyle: 'italic' },
]

// =============================================================================
// Markdown
// =============================================================================

export const MARKDOWN_TOKENS: monaco.editor.ITokenThemeRule[] = [
  { token: 'markup.heading.markdown', foreground: '22d3ee', fontStyle: 'bold' },
  { token: 'markup.bold.markdown', fontStyle: 'bold' },
  { token: 'markup.italic.markdown', fontStyle: 'italic' },
  { token: 'markup.underline.link.markdown', foreground: '22d3ee' },
  { token: 'string.link.markdown', foreground: '34d399' },
  { token: 'markup.inline.raw.markdown', foreground: 'fbbf24' },
  { token: 'variable.markdown', foreground: 'a78bfa' },
]

// =============================================================================
// Combined: All extended tokens
// =============================================================================

/**
 * All language-specific syntax tokens combined.
 * Merge with the base theme rules to get complete coverage.
 */
export const ALL_SYNTAX_TOKENS: monaco.editor.ITokenThemeRule[] = [
  ...TYPESCRIPT_TOKENS,
  ...RUST_TOKENS,
  ...PYTHON_TOKENS,
  ...CSS_TOKENS,
  ...HTML_TOKENS,
  ...JSON_TOKENS,
  ...YAML_TOKENS,
  ...MARKDOWN_TOKENS,
]
