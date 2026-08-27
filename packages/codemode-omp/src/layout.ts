/**
 * Auto-layout engine for mt tool expand view.
 *
 * Decides between stacked (eval above, result below) and side-by-side
 * (eval left, result right) based on terminal width, code height,
 * and result height. Only activates on expand (Ctrl+O).
 *
 * Decision algorithm:
 *   1. If width < MIN_SIDE_BY_SIDE (100) → always stacked
 *   2. Compute code panel width = max visible line width, clamped to 40% of width
 *   3. If code lines > result lines × 2 → stacked (code dominates)
 *   4. If result is single value or < 3 lines → stacked (not enough content)
 *   5. If code > MAX_CODE_LINES_FOR_SBS (15) → stacked (complex eval needs full width)
 *   6. Otherwise → side-by-side
 *
 * @module
 */

import type { RenderContext } from './render-core.ts'
import { sliceAfterVisible } from './render-core.ts'

// ─── Constants ───────────────────────────────────────────

/** Below this width, always stack vertically */
const MIN_SIDE_BY_SIDE = 100

/** Code panel gets at most this fraction of total width */
const MAX_CODE_FRACTION = 0.4

/** Minimum result panel width to bother with side-by-side */
const MIN_RESULT_WIDTH = 40

/** Gutter between panels (visual separator) */
const GUTTER_WIDTH = 3

/** Code longer than this → always stacked (complex eval needs full width) */
const MAX_CODE_LINES_FOR_SBS = 15

// ─── Types ───────────────────────────────────────────────

export type LayoutMode = 'stacked' | 'side-by-side'

export interface LayoutDecision {
  mode: LayoutMode
  codeWidth: number
  resultWidth: number
  reason: string
}

// ─── Decision ────────────────────────────────────────────

/**
 * Decide layout mode given terminal width and content dimensions.
 * Pure — no host calls needed.
 */
export function decideLayout(
  codeLines: string[],
  resultLines: string[],
  width: number,
): LayoutDecision {
  // Gate 1: terminal too narrow
  if (width < MIN_SIDE_BY_SIDE) {
    return { mode: 'stacked', codeWidth: width, resultWidth: width, reason: `width ${width} < ${MIN_SIDE_BY_SIDE}` }
  }

  // Gate 2: no code to show
  if (codeLines.length === 0) {
    return { mode: 'stacked', codeWidth: 0, resultWidth: width, reason: 'no code' }
  }

  // Gate 3: result too small to justify split
  if (resultLines.length < 3) {
    return { mode: 'stacked', codeWidth: width, resultWidth: width, reason: `result ${resultLines.length} lines < 3` }
  }

  // Gate 4: code too long for side-by-side — complex eval needs full width
  if (codeLines.length > MAX_CODE_LINES_FOR_SBS) {
    return { mode: 'stacked', codeWidth: width, resultWidth: width, reason: `code ${codeLines.length} lines > ${MAX_CODE_LINES_FOR_SBS}` }
  }

  // Measure natural code width (longest visible line) via ANSI-stripping regex
  // (decideLayout is intentionally pure — no ctx.text needed here)
  const ANSI = /\x1b\[[0-9;]*[a-zA-Z]/g
  const naturalCodeWidth = codeLines.reduce(
    (max, line) => Math.max(max, line.replace(ANSI, '').length),
    0,
  )

  // Code panel: natural width + border, clamped to MAX_CODE_FRACTION
  const maxCodePanel = Math.floor(width * MAX_CODE_FRACTION)
  const codePanel = Math.min(naturalCodeWidth + 4, maxCodePanel) // +4 for "│ " prefix + padding

  // Result panel: remainder after code + gutter
  const resultPanel = width - codePanel - GUTTER_WIDTH

  // Gate 5: result panel too narrow
  if (resultPanel < MIN_RESULT_WIDTH) {
    return { mode: 'stacked', codeWidth: width, resultWidth: width, reason: `result panel ${resultPanel} < ${MIN_RESULT_WIDTH}` }
  }

  // Gate 6: code dominates — too tall relative to result
  if (codeLines.length > resultLines.length * 2) {
    return { mode: 'stacked', codeWidth: width, resultWidth: width, reason: `code ${codeLines.length} lines > 2× result ${resultLines.length}` }
  }

  return {
    mode: 'side-by-side',
    codeWidth: codePanel,
    resultWidth: resultPanel,
    reason: `${codePanel}+${GUTTER_WIDTH}+${resultPanel}=${width}`,
  }
}

// ─── Compositing ─────────────────────────────────────────

/**
 * Composite two column arrays into a single string[] with gutter.
 * Pads shorter column to match height. Respects ANSI escapes.
 */
export function compositeColumns(
  left: string[],
  right: string[],
  leftWidth: number,
  totalWidth: number,
  ctx: RenderContext,
): string[] {
  const height = Math.max(left.length, right.length)
  const gutter = ctx.theme.fg('dim', ' │ ')
  const lines: string[] = []

  for (let i = 0; i < height; i++) {
    const l = i < left.length ? padToWidth(left[i], leftWidth, ctx) : ' '.repeat(leftWidth)
    const r = i < right.length ? right[i] : ''
    lines.push(ctx.text.truncateToWidth(l + gutter + r, totalWidth))
  }

  return lines
}

/**
 * Pad a styled string to exact visible width.
 * Truncates if over, space-pads if under.
 */
function padToWidth(styled: string, target: number, ctx: RenderContext): string {
  const w = ctx.text.visibleWidth(styled)
  if (w > target) return ctx.text.truncateToWidth(styled, target)
  if (w < target) return styled + ' '.repeat(target - w)
  return styled
}

// ─── Code Panel (side-by-side) ───────────────────────────

/**
 * Render code into a bordered panel for side-by-side layout.
 * Uses rounded box-drawing characters. WRAPS long lines instead of truncating.
 */
export function codePanelLines(code: string, panelWidth: number, ctx: RenderContext): string[] {
  const contentWidth = Math.max(1, panelWidth - 4) // "│ " prefix + " │" suffix
  const lines: string[] = []

  // ╭─ eval ─────────────────────────────╮
  const label = ' eval '
  const topFill = Math.max(0, panelWidth - 2 - label.length) // -2 for ╭╮
  lines.push(ctx.theme.fg('dim', '╭─') + ctx.theme.fg('accent', label) + ctx.theme.fg('dim', '─'.repeat(topFill) + '╮'))

  const highlighted = ctx.code.highlight(code, 'javascript')
  for (const hl of highlighted) {
    for (const wl of wrapLine(hl, contentWidth, ctx)) {
      lines.push(
        ctx.theme.fg('dim', '│ ') +
        padToWidth(wl, contentWidth, ctx) +
        ctx.theme.fg('dim', ' │'),
      )
    }
  }

  // ╰───────────────────────────────────╯
  lines.push(ctx.theme.fg('dim', '╰' + '─'.repeat(Math.max(0, panelWidth - 2)) + '╯'))

  return lines
}

/**
 * Render code into a stacked block (full-width).
 * Uses rounded box-drawing characters. WRAPS long lines instead of truncating.
 */
export function codeBlockLines(code: string, width: number, ctx: RenderContext): string[] {
  const contentWidth = Math.max(1, width - 4) // "│ " prefix + " │" suffix
  const lines: string[] = []

  // ╭─ eval ─────────────────────────────╮
  const label = ' eval '
  const topFill = Math.max(0, width - 2 - label.length)
  lines.push('')
  lines.push(ctx.theme.fg('dim', '╭─') + ctx.theme.fg('accent', label) + ctx.theme.fg('dim', '─'.repeat(topFill) + '╮'))

  const highlighted = ctx.code.highlight(code, 'javascript')
  for (const hl of highlighted) {
    for (const wl of wrapLine(hl, contentWidth, ctx)) {
      lines.push(
        ctx.theme.fg('dim', '│ ') +
        padToWidth(wl, contentWidth, ctx) +
        ctx.theme.fg('dim', ' │'),
      )
    }
  }

  // ╰───────────────────────────────────╯
  lines.push(ctx.theme.fg('dim', '╰' + '─'.repeat(Math.max(0, width - 2)) + '╯'))

  return lines
}

// ─── Line Wrapping ───────────────────────────────────────

/**
 * Wrap a possibly-ANSI line to fit within maxWidth visible chars.
 * Returns array of wrapped segments (at least 1 element).
 */
function wrapLine(line: string, maxWidth: number, ctx: RenderContext): string[] {
  if (maxWidth <= 0) return [line]
  if (ctx.text.visibleWidth(line) <= maxWidth) return [line]

  const segments: string[] = []
  let remaining = line

  // Safety: max 20 wraps to prevent infinite loops on pathological input
  for (let i = 0; i < 20 && ctx.text.visibleWidth(remaining) > 0; i++) {
    if (ctx.text.visibleWidth(remaining) <= maxWidth) {
      segments.push(remaining)
      break
    }
    segments.push(ctx.text.truncateToWidth(remaining, maxWidth))
    const next = sliceAfterVisible(remaining, maxWidth)
    if (next === '' || next === remaining) break // safety: no progress
    remaining = next
  }

  return segments.length > 0 ? segments : [line]
}
