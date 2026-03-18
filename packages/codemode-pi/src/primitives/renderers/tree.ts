/**
 * tree renderer — indented tree with box-drawing connectors
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Tree } from '../types.js'
import { register } from '../registry.js'

register<Tree>('tree', (prim, width, theme) => {
  const lines: string[] = []
  renderNode(prim.d, '', true, lines, width, theme)
  return lines.length > 0 ? lines : [theme.fg('muted', '(empty tree)')]
})

function renderNode(
  node: unknown,
  prefix: string,
  isRoot: boolean,
  lines: string[],
  width: number,
  theme: Theme,
): void {
  if (typeof node !== 'object' || node === null) {
    lines.push(truncateToWidth(prefix + theme.fg('toolOutput', String(node)), width))
    return
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const isLast = i === node.length - 1
      const connector = isRoot ? '' : (isLast ? '└─ ' : '├─ ')
      const childPrefix = isRoot ? prefix : prefix + (isLast ? '   ' : '│  ')
      const item = node[i]
      if (typeof item === 'object' && item !== null) {
        renderNode(item, childPrefix, false, lines, width, theme)
      } else {
        lines.push(truncateToWidth(
          prefix + theme.fg('dim', connector) + theme.fg('toolOutput', String(item)),
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
      lines.push(truncateToWidth(
        prefix + theme.fg('dim', connector) + theme.fg('accent', key),
        width,
      ))
      renderNode(value, childPrefix, false, lines, width, theme)
    } else {
      const val = value === null ? 'null' : value === undefined ? '' : String(value)
      lines.push(truncateToWidth(
        prefix + theme.fg('dim', connector) + theme.fg('accent', key) + ' ' + theme.fg('toolOutput', val),
        width,
      ))
    }
  }
}
