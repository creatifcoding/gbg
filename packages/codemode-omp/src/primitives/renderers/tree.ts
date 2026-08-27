/**
 * tree renderer — indented tree with box-drawing connectors
 * @module
 */

import type { Tree } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerTreeRenderer(registry: PrimitiveRegistry): void {
  registry.register<Tree>('tree', (prim: Tree, width: number, ctx: RenderContext): string[] => {
    const lines: string[] = []
    renderNode(prim.d, '', true, lines, width, ctx)
    return lines.length > 0 ? lines : [ctx.theme.fg('muted', '(empty tree)')]
  })
}

function renderNode(
  node: unknown,
  prefix: string,
  isRoot: boolean,
  lines: string[],
  width: number,
  ctx: RenderContext,
): void {
  if (typeof node !== 'object' || node === null) {
    lines.push(ctx.text.truncateToWidth(prefix + ctx.theme.fg('toolOutput', String(node)), width))
    return
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const isLast = i === node.length - 1
      const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ')
      const childPrefix = isRoot ? prefix : prefix + (isLast ? '   ' : '│  ')
      const item = node[i]
      if (typeof item === 'object' && item !== null) {
        renderNode(item, childPrefix, false, lines, width, ctx)
      } else {
        lines.push(ctx.text.truncateToWidth(
          prefix + ctx.theme.fg('dim', connector) + ctx.theme.fg('toolOutput', String(item)),
          width,
        ))
      }
    }
    return
  }

  const entries = Object.entries(node as Record<string, unknown>)
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i]
    const isLast = i === entries.length - 1
    const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ')
    const childPrefix = isRoot ? prefix : prefix + (isLast ? '   ' : '│  ')

    if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
      lines.push(ctx.text.truncateToWidth(
        prefix + ctx.theme.fg('dim', connector) + ctx.theme.fg('accent', key),
        width,
      ))
      renderNode(value, childPrefix, false, lines, width, ctx)
    } else {
      const val = value === null ? 'null' : value === undefined ? '' : String(value)
      lines.push(ctx.text.truncateToWidth(
        prefix + ctx.theme.fg('dim', connector) + ctx.theme.fg('accent', key) + ' ' + ctx.theme.fg('toolOutput', val),
        width,
      ))
    }
  }
}
