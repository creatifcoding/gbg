/**
 * Auto-layout engine for ms tool expand view.
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

import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from '@mariozechner/pi-tui'
import { highlightCode, type Theme } from '@mariozechner/pi-coding-agent'

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

  // Measure natural code width (longest visible line)
  const naturalCodeWidth = codeLines.reduce(
    (max, line) => Math.max(max, visibleWidth(line)),
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
  theme: Theme,
): string[] {
  const height = Math.max(left.length, right.length)
  const gutter = theme.fg('dim', ' │ ')
  const rightWidth = totalWidth - leftWidth - GUTTER_WIDTH
  const lines: string[] = []

  for (let i = 0; i < height; i++) {
    const l = i < left.length ? padToWidth(left[i], leftWidth) : ' '.repeat(leftWidth)
    const r = i < right.length ? right[i] : ''
    lines.push(truncateToWidth(l + gutter + r, totalWidth))
  }

  return lines
}

/**
 * Pad a styled string to exact visible width.
 * Truncates if over, space-pads if under.
 */
function padToWidth(styled: string, target: number): string {
  const w = visibleWidth(styled)
  if (w > target) return truncateToWidth(styled, target)
  if (w < target) return styled + ' '.repeat(target - w)
  return styled
}

// ─── Code Panel (side-by-side) ───────────────────────────

/**
 * Render code into a bordered panel for side-by-side layout.
 * Uses rounded box-drawing characters. WRAPS long lines instead of truncating.
 * Continuation lines get an accent-colored `↪` marker.
 */
export function codePanelLines(code: string, panelWidth: number, theme: Theme): string[] {
  // Border eats 4 visible chars: "│ " left + " │" right
  const contentWidth = Math.max(1, panelWidth - 4)
  const lines: string[] = []

  // ╭─ eval ──────────────────╮
  // Total visible = 1(╭) + 1(─) + label + fill + 1(╮) = panelWidth
  const label = ' eval '
  const topFill = Math.max(0, panelWidth - 3 - label.length) // 3 = ╭─ + ╮
  lines.push(theme.fg('dim', '╭─') + theme.fg('accent', label) + theme.fg('dim', '─'.repeat(topFill) + '╮'))

  // Highlight code and wrap each line to content width
  const highlighted = highlightCode(code, 'javascript')
  for (const hl of highlighted) {
    const wrapped = wrapLine(hl, contentWidth)
    for (let wi = 0; wi < wrapped.length; wi++) {
      const wl = wrapped[wi]
      if (wi > 0) {
        // Continuation line: accent ↪ marker eats 2 chars from content
        const contWidth = Math.max(1, contentWidth - 2)
        lines.push(
          theme.fg('dim', '│ ') +
          theme.fg('accent', '↪ ') +
          padToWidth(wl, contWidth) +
          theme.fg('dim', ' │'),
        )
      } else {
        lines.push(
          theme.fg('dim', '│ ') +
          padToWidth(wl, contentWidth) +
          theme.fg('dim', ' │'),
        )
      }
    }
  }

  // ╰──────────────────────────╯
  const botFill = Math.max(0, panelWidth - 2) // 2 = ╰ + ╯
  lines.push(theme.fg('dim', '╰' + '─'.repeat(botFill) + '╯'))

  // ── Safety: clamp every line to panelWidth ──
  return lines.map(l => visibleWidth(l) > panelWidth ? truncateToWidth(l, panelWidth) : l)
}

/**
 * Render code into a stacked block (full-width).
 * Uses rounded box-drawing characters. WRAPS long lines instead of truncating.
 * Continuation lines get an accent-colored `↪` marker.
 */
export function codeBlockLines(code: string, width: number, theme: Theme): string[] {
  // Border eats 4 visible chars: "│ " left + " │" right
  const contentWidth = Math.max(1, width - 4)
  const lines: string[] = []

  // ╭─ eval ──────────────────╮
  const label = ' eval '
  const topFill = Math.max(0, width - 3 - label.length) // 3 = ╭─ + ╮
  lines.push('')
  lines.push(theme.fg('dim', '╭─') + theme.fg('accent', label) + theme.fg('dim', '─'.repeat(topFill) + '╮'))

  const highlighted = highlightCode(code, 'javascript')
  for (const hl of highlighted) {
    const wrapped = wrapLine(hl, contentWidth)
    for (let wi = 0; wi < wrapped.length; wi++) {
      const wl = wrapped[wi]
      if (wi > 0) {
        // Continuation line: accent ↪ marker eats 2 chars from content
        const contWidth = Math.max(1, contentWidth - 2)
        lines.push(
          theme.fg('dim', '│ ') +
          theme.fg('accent', '↪ ') +
          padToWidth(wl, contWidth) +
          theme.fg('dim', ' │'),
        )
      } else {
        lines.push(
          theme.fg('dim', '│ ') +
          padToWidth(wl, contentWidth) +
          theme.fg('dim', ' │'),
        )
      }
    }
  }

  // ╰──────────────────────────╯
  const botFill = Math.max(0, width - 2) // 2 = ╰ + ╯
  lines.push(theme.fg('dim', '╰' + '─'.repeat(botFill) + '╯'))

  // ── Safety: clamp every line to width ──
  return lines.map(l => visibleWidth(l) > width ? truncateToWidth(l, width) : l)
}

// ─── Line Wrapping ───────────────────────────────────────

/**
 * Wrap a possibly-ANSI line to fit within maxWidth visible chars.
 * Returns array of wrapped segments (at least 1 element).
 * Uses truncateToWidth for ANSI-safe splitting.
 */
function wrapLine(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [line]
  const vis = visibleWidth(line)
  if (vis <= maxWidth) return [line]

  // Wrap by truncating at maxWidth, then processing remainder
  const segments: string[] = []
  let remaining = line

  // Safety: max 20 wraps to prevent infinite loops
  for (let i = 0; i < 20 && visibleWidth(remaining) > 0; i++) {
    if (visibleWidth(remaining) <= maxWidth) {
      segments.push(remaining)
      break
    }
    segments.push(truncateToWidth(remaining, maxWidth))
    // Calculate how many raw chars we consumed
    const consumed = truncateToWidth(remaining, maxWidth)
    // Strip the consumed portion — find where the visible content ends
    // Since ANSI makes this tricky, use a character-by-character approach
    remaining = sliceAfterVisible(remaining, maxWidth)
    if (remaining === '' || remaining === line) break // safety
  }

  return segments.length > 0 ? segments : [line]
}

/**
 * Get the portion of an ANSI string after the first `visChars` visible characters.
 * Preserves active ANSI state for the remainder.
 */
function sliceAfterVisible(str: string, visChars: number): string {
  let vis = 0
  let i = 0
  const len = str.length

  while (i < len && vis < visChars) {
    // Skip ANSI escape sequences
    if (str[i] === '\x1b' && i + 1 < len && str[i + 1] === '[') {
      i += 2
      while (i < len && str[i] !== 'm') i++
      if (i < len) i++ // skip 'm'
      continue
    }
    vis++
    i++
  }

  return str.slice(i)
}
