/**
 * Host-neutral render core.
 *
 * Re-exports the shared context interfaces from primitives/render-host.ts and
 * provides pure helpers that grid.ts, layout.ts, and steer.ts all depend on.
 * Host package imports are forbidden here.
 *
 * @module
 */

import type {
  RendererTheme,
  TextMetrics,
  CodeHighlighter,
  MarkdownRenderer,
  KeyHinter,
  RenderContext,
} from './primitives/render-host.ts'

// ─── Host-neutral context surface ────────────────────────────────────────────

export type {
  RendererTheme,
  TextMetrics,
  CodeHighlighter,
  MarkdownRenderer,
  KeyHinter,
  RenderContext,
}
export { createLegacyRenderContext } from './primitives/render-host.ts'

// ─── Data helpers (host-independent) ─────────────────────────────────────────

/**
 * Attempt to JSON-parse a raw output string.
 * Returns `{ parsed, isStructured: true }` on success, `{ parsed: null, isStructured: false }` on failure.
 */
export function tryParseJSON(text: string): { parsed: unknown; isStructured: boolean } {
  try {
    return { parsed: JSON.parse(text), isStructured: true }
  } catch {
    return { parsed: null, isStructured: false }
  }
}

/**
 * Human-readable type label for a JSON value.
 * Used in result headers.
 */
export function typeLabel(data: unknown): string {
  if (Array.isArray(data)) return `array[${data.length}]`
  if (typeof data === 'object' && data !== null) return 'object'
  return typeof data
}

// ─── Grid helpers (host-independent) ─────────────────────────────────────────

/**
 * Stringify a table cell value to a plain string for width measurement.
 */
export function cellStr(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}'
  return String(value)
}

/**
 * Distribute a pixel budget across columns proportionally with a minimum of 3.
 * Returns `natural` unchanged when it already fits within the budget.
 */
export function fitColumns(natural: number[], budget: number): number[] {
  const total = natural.reduce((s, w) => s + w, 0)
  if (total <= budget) return natural

  const minCol = 3
  const result = natural.map(w => Math.max(minCol, Math.floor((w / total) * budget)))

  // Distribute any remaining budget one column at a time
  let used = result.reduce((s, w) => s + w, 0)
  for (let i = 0; used < budget && i < result.length; i++) {
    result[i]++
    used++
  }

  return result
}

/**
 * Apply semantic color to a cell value based on its runtime type and content.
 * `text` is the pre-stringified cell; `raw` is the original value for type inspection.
 * Requires a `RendererTheme` — no host package needed.
 */
export function colorValue(text: string, raw: unknown, theme: RendererTheme): string {
  if (raw === true) return theme.fg('success', text)
  if (raw === false) return theme.fg('error', text)
  if (typeof raw === 'number') return theme.fg('syntaxNumber', text)
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase()
    if (lower === 'complete' || lower === 'clean' || lower === 'passed') return theme.fg('success', text)
    if (lower === 'missing' || lower === 'error' || lower === 'failed') return theme.fg('error', text)
    if (lower === 'exists' || lower === 'governed' || lower === 'warning') return theme.fg('warning', text)
  }
  return theme.fg('toolOutput', text)
}

/**
 * Apply bold formatting through a `RendererTheme` (or any object with an optional `bold` method).
 * Falls back to the plain text if the host does not implement bold.
 */
export function applyBold(bold: ((text: string) => string) | undefined, text: string): string {
  return typeof bold === 'function' ? bold(text) : text
}

// ─── ANSI helpers (host-independent) ─────────────────────────────────────────

/** Matches a single ANSI CSI escape sequence (e.g. \x1b[0m). */
export const ANSI_SEQ = /\x1b\[[0-9;]*[a-zA-Z]/g

/**
 * Slice an ANSI string to return only the portion AFTER the first `visChars`
 * visible (printable) characters. Skips over embedded escape sequences.
 */
export function sliceAfterVisible(str: string, visChars: number): string {
  let vis = 0
  let i = 0
  const len = str.length

  while (i < len && vis < visChars) {
    if (str[i] === '\x1b' && i + 1 < len && str[i + 1] === '[') {
      i += 2
      while (i < len && str[i] !== 'm') i++
      if (i < len) i++ // consume 'm'
      continue
    }
    vis++
    i++
  }

  return str.slice(i)
}
