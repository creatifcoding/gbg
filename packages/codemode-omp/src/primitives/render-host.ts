/**
 * Host-neutral render context interfaces.
 *
 * These interfaces define the capability surface that renderers and the
 * primitive registry need from a host. Neither Pi-specific nor OMP-specific
 * symbols are imported here — hosts implement these interfaces in their own
 * adapter layers.
 *
 * @module
 */

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * Minimal theming surface: apply a semantic color token to text.
 * The actual escape sequences are host-specific.
 */
export interface RendererTheme {
  /** Apply semantic color `color` to `text` (e.g. ANSI escapes, HTML spans). */
  fg(color: string, text: string): string
  /** Embolden text if the host supports it (optional). */
  bold?(text: string): string
}

// ─── Text metrics ─────────────────────────────────────────────────────────────

/**
 * ANSI-aware text measurement and truncation.
 * Hosts provide their own implementation because ANSI escape handling is
 * host-specific.
 */
export interface TextMetrics {
  /** Visible (printable) character width of `text`, ignoring escape sequences. */
  visibleWidth(text: string): number
  /** Truncate `text` to at most `width` visible characters, preserving escapes. */
  truncateToWidth(text: string, width: number): string
}

// ─── Code highlighting ────────────────────────────────────────────────────────

/**
 * Syntax highlighter for code blocks.
 * Returns one element per line (already split).
 */
export interface CodeHighlighter {
  highlight(code: string, lang: string): string[]
}

// ─── Optional capabilities ────────────────────────────────────────────────────

/**
 * Host-provided markdown renderer for rich text blocks.
 * Optional — hosts that do not support markdown omit this.
 */
export interface MarkdownRenderer {
  render(md: string, width: number): string[]
}

/**
 * Key binding hint formatter.
 * Optional — terminal hosts can show key hints; others omit.
 */
export interface KeyHinter {
  hint(key: string, label: string): string
}

// ─── RenderContext ────────────────────────────────────────────────────────────

/**
 * Composition of all host capabilities required by the shared render core.
 *
 * Create one per session or render pass; pass it through the call chain so
 * every renderer and the registry itself resolves host utilities through this
 * context rather than through module-level imports.
 */
export interface RenderContext {
  theme: RendererTheme
  text: TextMetrics
  code: CodeHighlighter
  markdown?: MarkdownRenderer
  keys?: KeyHinter
}

// ─── Legacy compatibility ─────────────────────────────────────────────────────

/** ANSI escape sequences — used by the fallback TextMetrics. */
const ANSI_SEQ = /\x1b\[[0-9;]*[a-zA-Z]/g

/**
 * Fallback TextMetrics that strips ANSI escapes for width measurement.
 * Truncation on the fallback path loses ANSI styling beyond the cut point —
 * acceptable for the safety-net guard since conforming renderers already
 * respect the requested width.
 */
const FALLBACK_TEXT: TextMetrics = {
  visibleWidth: (s) => s.replace(ANSI_SEQ, '').length,
  truncateToWidth: (s, w) => {
    const clean = s.replace(ANSI_SEQ, '')
    return clean.length <= w ? s : clean.slice(0, w)
  },
}

const FALLBACK_CODE: CodeHighlighter = {
  highlight: (src) => src.split('\n'),
}

/**
 * Build a RenderContext from a bare RendererTheme.
 *
 * Used by the legacy module-level registry functions so they can accept any
 * structurally compatible host theme without importing a host package.
 *
 * Callers may supply precise host implementations for `text` and `code`
 * once they migrate to the full context API.
 */
export function createLegacyRenderContext(
  theme: RendererTheme,
  text?: TextMetrics,
  code?: CodeHighlighter,
): RenderContext {
  return {
    theme,
    text: text ?? FALLBACK_TEXT,
    code: code ?? FALLBACK_CODE,
  }
}
