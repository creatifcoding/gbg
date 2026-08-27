/**
 * Dimension-aware grid renderer for structured data.
 *
 * Detects data shape and renders the appropriate layout:
 *   - Array of objects → table (columns auto-sized to terminal width)
 *   - Single object → key-value pairs (two-column)
 *   - Array of primitives → bulleted list
 *   - Primitive → single line
 *
 * All layouts respect the `width` parameter — columns shrink, truncate,
 * or collapse gracefully. No line exceeds width. Ever.
 *
 * Usage:
 *   import { gridLines } from './grid.ts'
 *   const lines = gridLines(data, width, ctx)
 *
 * @module
 */

import type { RenderContext } from './render-core.ts'
import { cellStr, colorValue, fitColumns, applyBold } from './render-core.ts'

// ─── Public API ──────────────────────────────────────────

/**
 * Render structured data as dimension-aware grid lines.
 * Returns string[] ready for Component.render().
 */
export function gridLines(data: unknown, width: number, ctx: RenderContext): string[] {
  if (data === null || data === undefined) {
    return [ctx.theme.fg('muted', '(empty)')]
  }

  if (typeof data === 'string') {
    return data.split('\n').map(line => ctx.text.truncateToWidth(ctx.theme.fg('toolOutput', line), width))
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return [ctx.theme.fg('accent', String(data))]
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return [ctx.theme.fg('muted', '(empty array)')]

    // Array of objects → table
    if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      return renderTable(data as Record<string, unknown>[], width, ctx)
    }

    // Array of primitives → list
    return data.map((item, i) =>
      ctx.text.truncateToWidth(
        ctx.theme.fg('dim', `${i + 1}.`) + ' ' + ctx.theme.fg('toolOutput', String(item)),
        width,
      )
    )
  }

  if (typeof data === 'object') {
    return renderKeyValue(data as Record<string, unknown>, width, ctx)
  }

  return [ctx.text.truncateToWidth(String(data), width)]
}

// ─── Table (array of objects) ────────────────────────────

/** Collect all unique keys across rows in first-seen order */
function orderedKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        result.push(key)
      }
    }
  }
  return result
}

function renderTable(rows: Record<string, unknown>[], width: number, ctx: RenderContext): string[] {
  if (rows.length === 0) return []

  const keys = orderedKeys(rows)
  if (keys.length === 0) return [ctx.theme.fg('muted', '(empty objects)')]

  // Measure column widths: max of header and all cell values
  const colWidths = keys.map(k => {
    const headerW = k.length
    const maxCellW = rows.reduce((max, row) => Math.max(max, cellStr(row[k]).length), 0)
    return Math.max(headerW, maxCellW)
  })

  // Budget: width minus separators (│ + spaces between columns)
  // Layout: │ col │ col │ col │  →  1 + (colW + 3) per col
  const separatorCost = 1 + keys.length * 3
  const contentBudget = width - separatorCost

  if (contentBudget < keys.length * 3) {
    // Terminal too narrow for table — fall back to key-value per row
    return rows.flatMap((row, i) => {
      const header = i > 0 ? [ctx.theme.fg('dim', '─'.repeat(Math.min(width, 20)))] : []
      return [...header, ...renderKeyValue(row, width, ctx)]
    })
  }

  const fitted = fitColumns(colWidths, contentBudget)

  const lines: string[] = []
  const sep = ctx.theme.fg('dim', '│')

  // Header
  const headerCells = keys.map((k, i) =>
    padCell(ctx.theme.fg('accent', applyBold(ctx.theme.bold, k)), k, fitted[i], ctx)
  )
  lines.push(sep + ' ' + headerCells.join(' ' + sep + ' ') + ' ' + sep)

  // Divider
  const divParts = fitted.map(w => ctx.theme.fg('dim', '─'.repeat(w + 2)))
  lines.push(ctx.theme.fg('dim', '├') + divParts.join(ctx.theme.fg('dim', '┼')) + ctx.theme.fg('dim', '┤'))

  // Rows
  for (const row of rows) {
    const cells = keys.map((k, i) => {
      const val = cellStr(row[k])
      const colored = colorValue(val, row[k], ctx.theme)
      return padCell(colored, val, fitted[i], ctx)
    })
    lines.push(sep + ' ' + cells.join(' ' + sep + ' ') + ' ' + sep)
  }

  return lines
}

// ─── Key-Value (single object) ───────────────────────────

function renderKeyValue(obj: Record<string, unknown>, width: number, ctx: RenderContext): string[] {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return [ctx.theme.fg('muted', '(empty object)')]

  const maxKeyLen = Math.min(
    entries.reduce((max, [k]) => Math.max(max, k.length), 0),
    Math.floor(width * 0.3),
  )

  return entries.flatMap(([key, value]) => {
    const keyCol = ctx.theme.fg('accent', key.padEnd(maxKeyLen))

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        if (value.length === 0) return [keyCol + '  ' + ctx.theme.fg('muted', '[]')]
        const inline = value.map(v => cellStr(v)).join(', ')
        if (inline.length + maxKeyLen + 4 <= width) {
          return [keyCol + '  ' + ctx.theme.fg('toolOutput', inline)]
        }
        return [
          keyCol,
          ...value.map(v =>
            ctx.text.truncateToWidth(
              '  ' + ctx.theme.fg('dim', '·') + ' ' + colorValue(cellStr(v), v, ctx.theme),
              width,
            )
          ),
        ]
      }
      // Nested object — recurse indented
      const nested = renderKeyValue(value as Record<string, unknown>, width - 4, ctx)
      return [keyCol, ...nested.map(l => '    ' + l)]
    }

    const val = cellStr(value)
    const colored = colorValue(val, value, ctx.theme)
    return [ctx.text.truncateToWidth(keyCol + '  ' + colored, width)]
  })
}

// ─── Cell padding ─────────────────────────────────────────────────────────────

/**
 * Pad or truncate a styled cell to exactly `targetWidth` visible characters.
 * `plain` is the unstyled text for width calculation.
 */
function padCell(styled: string, plain: string, targetWidth: number, ctx: RenderContext): string {
  if (plain.length > targetWidth) {
    // Truncate by visible width so ANSI escapes are preserved up to the cut
    styled = ctx.text.truncateToWidth(styled, targetWidth)
  }
  const pad = targetWidth - ctx.text.visibleWidth(styled)
  return pad > 0 ? styled + ' '.repeat(pad) : styled
}
