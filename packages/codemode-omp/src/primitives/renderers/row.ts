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

import type { Row, Primitive } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'
import { flexLayout, DEFAULT_GAP, type FlexChild } from '../flex.ts'

export function registerRowRenderer(registry: PrimitiveRegistry): void {
  registry.register<Row>('row', (prim: Row, width: number, ctx: RenderContext): string[] => {
    const gap = prim.gap ?? DEFAULT_GAP
    const items = prim.items

    if (items.length === 0) return []
    if (items.length === 1) return registry.renderPrimitive(items[0], width, ctx)

    // Build flex children from items
    const flexChildren: FlexChild[] = items.map((item, i) => {
      // 'flex' is a reserved primitive key not expressed in the union type; read via record
      const r = item as Record<string, unknown>
      const flex = prim.weights?.[i] ?? (typeof r['flex'] === 'number' ? r['flex'] : 1)
      return { flex }
    })

    // Try flex layout
    const widths = flexLayout(flexChildren, width, gap)

    if (widths === null) {
      // Collapsed to stack
      return renderAsStack(items, width, gap, ctx, registry)
    }

    // Render each child at allocated width
    const columns = items.map((item, i) =>
      registry.renderPrimitive(item, widths[i], ctx)
    )

    // Compose side-by-side
    return composeSideBySide(columns, widths, gap, width, ctx)
  })
}

// ─── Fallback stack ──────────────────────────────────────

function renderAsStack(
  items: ReadonlyArray<Primitive>,
  width: number,
  gap: number,
  ctx: RenderContext,
  registry: PrimitiveRegistry,
): string[] {
  const lines: string[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && gap > 0) {
      for (let g = 0; g < gap; g++) lines.push('')
    }
    lines.push(...registry.renderPrimitive(items[i], width, ctx))
  }
  return lines
}

// ─── Side-by-side composition ────────────────────────────

function composeSideBySide(
  columns: string[][],
  widths: number[],
  gap: number,
  totalWidth: number,
  ctx: RenderContext,
): string[] {
  const maxRows = Math.max(...columns.map(c => c.length))
  const gutterStr = gap > 0 ? ctx.theme.fg('dim', '│') + ' '.repeat(Math.max(0, gap - 1)) : ''
  const lines: string[] = []

  for (let row = 0; row < maxRows; row++) {
    let line = ''
    for (let col = 0; col < columns.length; col++) {
      if (col > 0) line += gutterStr
      const cell = columns[col][row] ?? ''
      line += padToWidth(cell, widths[col], ctx)
    }
    // Final safety: truncate composed line to total width
    lines.push(ctx.text.truncateToWidth(line, totalWidth))
  }

  return lines
}

/** Pad or truncate a possibly-ANSI string to exact visual width. */
function padToWidth(text: string, targetWidth: number, ctx: RenderContext): string {
  const vis = ctx.text.visibleWidth(text)
  if (vis > targetWidth) return ctx.text.truncateToWidth(text, targetWidth)
  if (vis < targetWidth) return text + ' '.repeat(targetWidth - vis)
  return text
}
