/**
 * row renderer — horizontal flex layout
 *
 * Uses flexLayout to distribute width across children.
 * Falls back to stk (vertical) when width < COLLAPSE_THRESHOLD.
 * Renders children side-by-side with separator gutter.
 *
 * CRITICAL: Every composed line MUST be ≤ width visible chars.
 *
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@mariozechner/pi-tui'
import type { Row, Primitive } from '../types.js'
import { register, renderPrimitive } from '../registry.js'
import { flexLayout, DEFAULT_GAP, type FlexChild } from '../flex.js'

register<Row>('row', (prim, width, theme) => {
  const gap = prim.gap ?? DEFAULT_GAP
  const items = prim.items

  if (items.length === 0) return []
  if (items.length === 1) return renderPrimitive(items[0], width, theme)

  // Build flex children from items
  const flexChildren: FlexChild[] = items.map((item, i) => ({
    flex: prim.weights?.[i] ?? (item as { flex?: number }).flex ?? 1,
  }))

  // Try flex layout
  const widths = flexLayout(flexChildren, width, gap)

  if (widths === null) {
    // Collapsed to stack
    return renderAsStack(items, width, gap, theme)
  }

  // Render each child at allocated width
  const columns = items.map((item, i) =>
    renderPrimitive(item, widths[i], theme)
  )

  // Compose side-by-side
  return composeSideBySide(columns, widths, gap, width, theme)
})

// ─── Fallback stack ──────────────────────────────────────

function renderAsStack(
  items: ReadonlyArray<Primitive>,
  width: number,
  gap: number,
  theme: Theme,
): string[] {
  const lines: string[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && gap > 0) {
      for (let g = 0; g < gap; g++) lines.push('')
    }
    lines.push(...renderPrimitive(items[i], width, theme))
  }
  return lines
}

// ─── Side-by-side composition ────────────────────────────

function composeSideBySide(
  columns: string[][],
  widths: number[],
  gap: number,
  totalWidth: number,
  theme: Theme,
): string[] {
  const maxRows = Math.max(...columns.map(c => c.length))
  const gutterStr = gap > 0 ? theme.fg('dim', '│') + ' '.repeat(Math.max(0, gap - 1)) : ''
  const lines: string[] = []

  for (let row = 0; row < maxRows; row++) {
    let line = ''
    for (let col = 0; col < columns.length; col++) {
      if (col > 0) line += gutterStr
      const cell = columns[col][row] ?? ''
      line += padToWidth(cell, widths[col])
    }
    // Final safety: truncate composed line to total width
    lines.push(truncateToWidth(line, totalWidth))
  }

  return lines
}

/** Pad or truncate a possibly-ANSI string to exact visual width */
function padToWidth(text: string, targetWidth: number): string {
  const vis = visibleWidth(text)
  if (vis > targetWidth) {
    return truncateToWidth(text, targetWidth)
  }
  if (vis < targetWidth) {
    return text + ' '.repeat(targetWidth - vis)
  }
  return text
}
