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
 *   import { gridLines } from './grid.js'
 *   const lines = gridLines(data, width, theme)
 *
 * @module
 */

import { visibleWidth, truncateToWidth } from '@mariozechner/pi-tui'
import type { Theme } from '@mariozechner/pi-coding-agent'

// ─── Public API ──────────────────────────────────────────

/**
 * Render structured data as dimension-aware grid lines.
 * Returns string[] ready for Component.render().
 */
export function gridLines(data: unknown, width: number, theme: Theme): string[] {
  if (data === null || data === undefined) {
    return [theme.fg('muted', '(empty)')]
  }

  if (typeof data === 'string') {
    return wrapPlain(data, width, theme)
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return [theme.fg('accent', String(data))]
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return [theme.fg('muted', '(empty array)')]

    // Array of objects → table
    if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
      return renderTable(data as Record<string, unknown>[], width, theme)
    }

    // Array of primitives → list
    return data.map((item, i) =>
      truncateToWidth(theme.fg('dim', `${i + 1}.`) + ' ' + theme.fg('toolOutput', String(item)), width)
    )
  }

  if (typeof data === 'object') {
    return renderKeyValue(data as Record<string, unknown>, width, theme)
  }

  return [truncateToWidth(String(data), width)]
}

// ─── Key collection ──────────────────────────────────────

/** Collect all unique keys across rows, preserving first-seen order. */
function orderedKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(k)
      }
    }
  }
  return keys
}

// ─── Table (array of objects) ────────────────────────────

function renderTable(rows: Record<string, unknown>[], width: number, theme: Theme): string[] {
  if (rows.length === 0) return []

  // Collect all keys across all rows
  const keys = orderedKeys(rows)
  if (keys.length === 0) return [theme.fg('muted', '(empty objects)')]

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
      const header = i > 0 ? [theme.fg('dim', '─'.repeat(Math.min(width, 20)))] : []
      return [...header, ...renderKeyValue(row, width, theme)]
    })
  }

  // Distribute budget proportionally, with min 3 per column
  const fitted = fitColumns(colWidths, contentBudget)

  const lines: string[] = []
  const sep = theme.fg('dim', '│')

  // Header
  const headerCells = keys.map((k, i) => pad(theme.fg('accent', theme.bold(k)), k, fitted[i]))
  lines.push(sep + ' ' + headerCells.join(' ' + sep + ' ') + ' ' + sep)

  // Divider
  const divParts = fitted.map(w => theme.fg('dim', '─'.repeat(w + 2)))
  lines.push(theme.fg('dim', '├') + divParts.join(theme.fg('dim', '┼')) + theme.fg('dim', '┤'))

  // Rows
  for (const row of rows) {
    const cells = keys.map((k, i) => {
      const val = cellStr(row[k])
      const colored = colorValue(val, row[k], theme)
      return pad(colored, val, fitted[i])
    })
    lines.push(sep + ' ' + cells.join(' ' + sep + ' ') + ' ' + sep)
  }

  return lines
}

// ─── Key-Value (single object) ───────────────────────────

function renderKeyValue(obj: Record<string, unknown>, width: number, theme: Theme): string[] {
  const entries = Object.entries(obj).filter(([_, v]) => v !== undefined)
  if (entries.length === 0) return [theme.fg('muted', '(empty object)')]

  const maxKeyLen = Math.min(
    entries.reduce((max, [k]) => Math.max(max, k.length), 0),
    Math.floor(width * 0.3),
  )

  return entries.flatMap(([key, value]) => {
    const keyCol = theme.fg('accent', key.padEnd(maxKeyLen))

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        if (value.length === 0) return [keyCol + '  ' + theme.fg('muted', '[]')]
        // Nested array — try inline, else multi-line
        const inline = value.map(v => cellStr(v)).join(', ')
        if (inline.length + maxKeyLen + 4 <= width) {
          return [keyCol + '  ' + theme.fg('toolOutput', inline)]
        }
        return [
          keyCol,
          ...value.map(v =>
            truncateToWidth('  ' + theme.fg('dim', '·') + ' ' + colorValue(cellStr(v), v, theme), width)
          ),
        ]
      }
      // Nested object — recurse indented
      const nested = renderKeyValue(value as Record<string, unknown>, width - 4, theme)
      return [keyCol, ...nested.map(l => '    ' + l)]
    }

    const val = cellStr(value)
    const colored = colorValue(val, value, theme)
    return [truncateToWidth(keyCol + '  ' + colored, width)]
  })
}

// ─── Column fitting ──────────────────────────────────────

function fitColumns(natural: number[], budget: number): number[] {
  const total = natural.reduce((s, w) => s + w, 0)

  if (total <= budget) return natural

  // Proportional shrink with min 3
  const minCol = 3
  const result = natural.map(w => Math.max(minCol, Math.floor((w / total) * budget)))

  // Distribute remainder
  let used = result.reduce((s, w) => s + w, 0)
  for (let i = 0; used < budget && i < result.length; i++) {
    result[i]++
    used++
  }

  return result
}

// ─── Cell formatting ─────────────────────────────────────

function cellStr(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'object') return Array.isArray(value) ? `[${value.length}]` : '{…}'
  return String(value)
}

function colorValue(text: string, raw: unknown, theme: Theme): string {
  // Booleans
  if (raw === true) return theme.fg('success', text)
  if (raw === false) return theme.fg('error', text)

  // Numbers
  if (typeof raw === 'number') return theme.fg('accent', text)

  // Status-like strings
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase()
    if (lower === 'complete' || lower === 'clean' || lower === 'passed') return theme.fg('success', text)
    if (lower === 'missing' || lower === 'error' || lower === 'failed') return theme.fg('error', text)
    if (lower === 'exists' || lower === 'governed' || lower === 'warning') return theme.fg('warning', text)
  }

  return theme.fg('toolOutput', text)
}

/** Pad a styled string to a visual width. `plain` is the unstyled text for width calc. */
function pad(styled: string, plain: string, targetWidth: number): string {
  const plainTrunc = plain.length > targetWidth ? plain.slice(0, targetWidth - 1) + '…' : plain
  if (plainTrunc !== plain) {
    // Re-style the truncated version
    styled = styled.slice(0, styled.length - (plain.length - plainTrunc.length))
    // Simpler: just truncate by visible width
    styled = truncateToWidth(styled, targetWidth)
  }
  const pad = targetWidth - visibleWidth(styled)
  return pad > 0 ? styled + ' '.repeat(pad) : styled
}

function wrapPlain(text: string, width: number, theme: Theme): string[] {
  return text.split('\n').map(line => truncateToWidth(theme.fg('toolOutput', line), width))
}
