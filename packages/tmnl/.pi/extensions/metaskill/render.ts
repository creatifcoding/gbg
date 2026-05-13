/**
 * Metaskill Tool Renderer
 *
 * Inline streaming TUI for the `ms` tool — modeled on the built-in write tool.
 * Shows the eval script and pretty-prints structured output.
 *
 * The LLM gets raw content text (unchanged). This is purely human-facing.
 *
 * - renderCall: compact code preview (truncated to ~3 lines, JS-highlighted)
 * - renderResult: two states controlled by pi's Ctrl+O (expandTools):
 *     collapsed: result capped at 15 lines
 *     expanded:  eval code box + full result (always shows the code)
 *
 * @module
 */

import { Text, visibleWidth, truncateToWidth } from '@mariozechner/pi-tui'
import { highlightCode, getLanguageFromPath, keyHint, type Theme } from '@mariozechner/pi-coding-agent'
import { gridLines } from './grid.ts'
import { steer, renderAnnotations } from './steer.ts'
import { decideLayout, compositeColumns, codePanelLines, codeBlockLines } from './layout.ts'
import { isPrimitive, type Primitive } from './primitives/types.ts'
import { tryRenderPrimitive } from './primitives/index.ts'

// Re-export rendering utilities for downstream consumers
export { highlightCode, getLanguageFromPath, keyHint, Text, type Theme }
export { gridLines } from './grid.ts'
export { steer, renderAnnotations } from './steer.ts'
export { decideLayout, type LayoutMode, type LayoutDecision } from './layout.ts'

// ─── renderCall ──────────────────────────────────────────

/**
 * Renders the tool invocation inline — shows `ms` label + code being eval'd.
 * Truncates long code to 3 lines with expand hint.
 */
export function renderCall(
  args: { code?: string },
  theme: Theme,
): InstanceType<typeof Text> {
  const code = args.code ?? ''
  const lines = code.split('\n')

  let text = theme.fg('toolTitle', theme.bold('ms'))

  if (!code) {
    text += ' ' + theme.fg('muted', '(empty)')
    return new Text(text, 0, 0)
  }

  // Single short line: show inline
  if (lines.length === 1 && code.length <= 80) {
    const hl = highlightCode(code, 'javascript')
    text += ' ' + (hl[0] ?? code)
    return new Text(text, 0, 0)
  }

  // Multi-line: show first 3 lines, syntax-highlighted
  const maxPreview = 3
  const highlighted = highlightCode(lines.slice(0, maxPreview).join('\n'), 'javascript')
  text += '\n\n' + highlighted.join('\n')

  const remaining = lines.length - maxPreview
  if (remaining > 0) {
    text += '\n' + theme.fg('muted', `... (${remaining} more line${remaining > 1 ? 's' : ''}, ${lines.length} total)`)
  }

  return new Text(text, 0, 0)
}

// ─── renderResult ────────────────────────────────────────

export interface MsToolDetails {
  code: string
  result?: unknown
  primitive?: Primitive
  error?: string
}

/**
 * Renders the tool result as a dimension-aware grid.
 *
 * Returns a custom component so we get `width` at render time for grid layout.
 *
 * Collapsed (default): result capped at 15 lines, expand hint.
 * Expanded (Ctrl+O): eval code box + full result. Always shows the code.
 * Partial (streaming): shows "evaluating..." with code hint.
 *
 * The LLM still gets the raw `content` text — this is visual only.
 */
export function renderResult(
  result: { content?: Array<{ type: string; text: string }>; details?: MsToolDetails; isError?: boolean },
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
) {
  const { expanded, isPartial } = options
  const details = result.details as MsToolDetails | undefined
  const code = details?.code ?? ''
  const rawOutput = result.content?.[0]?.text ?? ''

  // Return a component with dimension-aware render()
  let cachedWidth: number | undefined
  let cachedLines: string[] | undefined

  return {
    render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines
      cachedWidth = width
      try {
        cachedLines = buildLines(width)
      } catch (err) {
        // ── Error boundary: NEVER crash pi ──
        const msg = err instanceof Error ? err.message : String(err)
        cachedLines = [
          theme.fg('toolTitle', theme.bold('ms')) + ' ' + theme.fg('error', '✗ render error'),
          theme.fg('error', truncateToWidth(msg, width)),
          '',
          theme.fg('muted', 'Raw output:'),
          ...rawOutput.split('\n').slice(0, 10).map(l => truncateToWidth(theme.fg('toolOutput', l), width)),
        ]
      }
      // ── Final safety net: clamp EVERY line to width ──
      for (let i = 0; i < cachedLines.length; i++) {
        if (visibleWidth(cachedLines[i]) > width) {
          cachedLines[i] = truncateToWidth(cachedLines[i], width)
        }
      }
      return cachedLines
    },
    invalidate() {
      cachedWidth = undefined
      cachedLines = undefined
    },
  }

  function buildLines(width: number): string[] {
    // ── Streaming ──
    if (isPartial) {
      return renderPartial(code, theme)
    }

    // ── Parse structured data ──
    const { parsed, isStructured } = tryParseJSON(rawOutput)

    // ── Error ──
    if (result.isError) {
      return renderError(code, rawOutput, expanded, width, theme)
    }

    // ── Success ──
    const primTag = details?.primitive?._v
    const header = renderHeader(parsed, isStructured, theme, primTag, expanded)
    const lines = [header]

    // ── Build result content ──
    // Priority: tagged primitive > structured JSON > plain text.
    // Primitives like `md` extract to a raw string, so isStructured may be false.
    const primitive = details?.primitive
    const resultContent = primitive
      ? (tryRenderPrimitive(primitive, width, theme) ?? gridLines(parsed ?? rawOutput, width, theme))
      : isStructured
        ? gridLines(parsed, width, theme)
        : renderPlainText(rawOutput, width, theme)

    if (expanded) {
      // ── Expanded: eval code box + full result ──
      if (code) {
        const codeRaw = code.split('\n')
        const layout = decideLayout(codeRaw, resultContent, width)

        if (layout.mode === 'side-by-side') {
          const codePanel = codePanelLines(code, layout.codeWidth, theme)
          lines.push('')
          lines.push(...compositeColumns(codePanel, resultContent, layout.codeWidth, width, theme))
        } else {
          lines.push(...codeBlockLines(code, width, theme))
          lines.push('')
          lines.push(theme.fg('dim', '─── ') + theme.fg('accent', 'output') + theme.fg('dim', ' ' + '─'.repeat(Math.max(0, width - 12))))
          lines.push('')
          lines.push(...resultContent)
        }
      } else {
        lines.push('')
        lines.push(...resultContent)
      }
    } else {
      // ── Collapsed: capped at 15 lines ──
      lines.push('')
      const cap = 15
      lines.push(...resultContent.slice(0, cap))
      if (resultContent.length > cap) {
        const remaining = resultContent.length - cap
        lines.push(theme.fg('muted', `... (${remaining} more, ${keyHint('expandTools', 'expand')})`))
      }
    }

    // ── Steering annotations (always, after content) ──
    const steerData = details?.primitive ?? details?.result ?? parsed
    if ((isStructured || primitive) && steerData) {
      const annotations = steer(steerData, code)
      lines.push(...renderAnnotations(annotations, width, theme))
    }

    return lines
  }
}

// ─── Render helpers ──────────────────────────────────────

function renderPartial(code: string, theme: Theme): string[] {
  const lines = [theme.fg('toolTitle', theme.bold('ms')) + ' ' + theme.fg('warning', 'evaluating...')]
  if (code) {
    const firstLine = code.split('\n')[0]
    const preview = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine
    const hl = highlightCode(preview, 'javascript')
    lines.push(hl[0] ?? theme.fg('muted', preview))
  }
  return lines
}

function renderHeader(parsed: unknown, isStructured: boolean, theme: Theme, primTag?: string, expanded?: boolean): string {
  const typeInfo = primTag
    ? theme.fg('dim', primTag)
    : isStructured
      ? theme.fg('dim', typeLabel(parsed))
      : ''
  const modeHint = expanded
    ? ' ' + theme.fg('accent', '⟨eval⟩')
    : ''
  return theme.fg('toolTitle', theme.bold('ms')) + ' ' + theme.fg('success', '✓')
    + (typeInfo ? ' ' + typeInfo : '')
    + modeHint
}

function renderError(code: string, rawOutput: string, expanded: boolean, width: number, theme: Theme): string[] {
  const lines = [theme.fg('toolTitle', theme.bold('ms')) + ' ' + theme.fg('error', '✗ error')]
  if (expanded && code) lines.push(...codeBlockLines(code, width, theme))
  lines.push('')
  lines.push(...rawOutput.split('\n').map(l => theme.fg('error', l)))
  return lines
}

function renderPlainText(rawOutput: string, width: number, theme: Theme): string[] {
  if (rawOutput.startsWith('(void')) {
    return [theme.fg('muted', rawOutput)]
  }
  return rawOutput.split('\n').map(l => theme.fg('toolOutput', l))
}

// ─── Utilities ───────────────────────────────────────────

function tryParseJSON(text: string): { parsed: unknown; isStructured: boolean } {
  try {
    return { parsed: JSON.parse(text), isStructured: true }
  } catch {
    return { parsed: null, isStructured: false }
  }
}

function typeLabel(data: unknown): string {
  if (Array.isArray(data)) return `array[${data.length}]`
  if (typeof data === 'object' && data !== null) return 'object'
  return typeof data
}
