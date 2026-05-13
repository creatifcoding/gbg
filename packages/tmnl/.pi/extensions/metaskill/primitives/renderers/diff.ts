/**
 * diff renderer — LCS-based side-by-side or unified diff
 *
 * Side-by-side when width ≥ 80, unified below that.
 * Uses Longest Common Subsequence for edit script.
 *
 * CRITICAL: Every output line MUST be ≤ width visible chars.
 *
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@mariozechner/pi-tui'
import type { Diff } from '../types.ts'
import { register } from '../registry.ts'

const SIDE_BY_SIDE_MIN = 80

register<Diff>('diff', (prim, width, theme) => {
  const aLines = prim.a.split('\n')
  const bLines = prim.b.split('\n')

  if (width >= SIDE_BY_SIDE_MIN) {
    return renderSideBySide(aLines, bLines, width, theme)
  }
  return renderUnified(aLines, bLines, width, theme)
})

// ─── LCS ─────────────────────────────────────────────────

function lcs(a: string[], b: string[]): boolean[][] {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const inA = new Array(m).fill(false)
  const inB = new Array(n).fill(false)
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      inA[i - 1] = true; inB[j - 1] = true; i--; j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  return [inA, inB]
}

// ─── Side-by-side ────────────────────────────────────────

function renderSideBySide(aLines: string[], bLines: string[], width: number, theme: Theme): string[] {
  const [inA, inB] = lcs(aLines, bLines)

  const pairs: Array<[string | null, string | null]> = []
  let ai = 0, bi = 0

  while (ai < aLines.length || bi < bLines.length) {
    if (ai < aLines.length && inA[ai] && bi < bLines.length && inB[bi]) {
      pairs.push([aLines[ai], bLines[bi]]); ai++; bi++
    } else if (ai < aLines.length && !inA[ai]) {
      pairs.push([aLines[ai], null]); ai++
    } else if (bi < bLines.length && !inB[bi]) {
      pairs.push([null, bLines[bi]]); bi++
    } else {
      if (ai < aLines.length) { pairs.push([aLines[ai], null]); ai++ }
      if (bi < bLines.length) { pairs.push([null, bLines[bi]]); bi++ }
    }
  }

  // Layout: numA │ left │ right │ numB
  const numWidth = String(Math.max(aLines.length, bLines.length)).length
  const gutterChars = 3 // " │ "
  // panelWidth: divide remaining space after line numbers and 3 gutters
  const panelWidth = Math.max(4, Math.floor((width - numWidth * 2 - gutterChars * 3) / 2))

  const sep = theme.fg('dim', ' │ ')
  const lines: string[] = []

  // Header
  lines.push(truncateToWidth(
    theme.fg('dim', ' '.repeat(numWidth)) + sep +
    padTrunc(theme.fg('accent', 'a (before)'), 'a (before)', panelWidth) + sep +
    padTrunc(theme.fg('accent', 'b (after)'), 'b (after)', panelWidth) +
    theme.fg('dim', ' '.repeat(numWidth)),
    width,
  ))
  lines.push(truncateToWidth(theme.fg('dim', '─'.repeat(width)), width))

  let aNum = 0, bNum = 0
  for (const [left, right] of pairs) {
    const aLabel = left !== null ? String(++aNum).padStart(numWidth) : ' '.repeat(numWidth)
    const bLabel = right !== null ? String(++bNum).padStart(numWidth) : ' '.repeat(numWidth)

    const leftText = left !== null
      ? padTrunc(
          right === null ? theme.fg('error', left) : left,
          left,
          panelWidth,
        )
      : ' '.repeat(panelWidth)

    const rightText = right !== null
      ? padTrunc(
          left === null ? theme.fg('success', right) : right,
          right,
          panelWidth,
        )
      : ' '.repeat(panelWidth)

    lines.push(truncateToWidth(
      theme.fg('dim', aLabel) + sep + leftText + sep + rightText + theme.fg('dim', bLabel),
      width,
    ))
  }

  return lines
}

// ─── Unified ─────────────────────────────────────────────

function renderUnified(aLines: string[], bLines: string[], width: number, theme: Theme): string[] {
  const [inA, inB] = lcs(aLines, bLines)
  const lines: string[] = []

  lines.push(truncateToWidth(theme.fg('error', `--- a`), width))
  lines.push(truncateToWidth(theme.fg('success', `+++ b`), width))
  lines.push(truncateToWidth(theme.fg('dim', '─'.repeat(Math.min(width, 40))), width))

  let ai = 0, bi = 0
  while (ai < aLines.length || bi < bLines.length) {
    if (ai < aLines.length && inA[ai] && bi < bLines.length && inB[bi]) {
      lines.push(truncateToWidth(theme.fg('dim', ' ') + aLines[ai], width))
      ai++; bi++
    } else if (ai < aLines.length && !inA[ai]) {
      lines.push(truncateToWidth(theme.fg('error', '-') + theme.fg('error', aLines[ai]), width))
      ai++
    } else if (bi < bLines.length && !inB[bi]) {
      lines.push(truncateToWidth(theme.fg('success', '+') + theme.fg('success', bLines[bi]), width))
      bi++
    } else {
      if (ai < aLines.length) { lines.push(truncateToWidth(theme.fg('error', '-') + aLines[ai], width)); ai++ }
      if (bi < bLines.length) { lines.push(truncateToWidth(theme.fg('success', '+') + bLines[bi], width)); bi++ }
    }
  }

  return lines
}

// ─── Helpers ─────────────────────────────────────────────

/** Pad or truncate styled text to exact visual width. `plain` is for measurement. */
function padTrunc(styled: string, plain: string, targetWidth: number): string {
  if (plain.length > targetWidth) {
    return truncateToWidth(styled, targetWidth)
  }
  if (plain.length < targetWidth) {
    return styled + ' '.repeat(targetWidth - plain.length)
  }
  return styled
}
