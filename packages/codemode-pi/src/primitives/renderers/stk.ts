/**
 * stk renderer — vertical stack with gap
 *
 * Renders each child at full width, separated by gap blank lines.
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import type { Stk } from '../types.js'
import { register, renderPrimitive } from '../registry.js'

register<Stk>('stk', (prim, width, theme) => {
  const gap = prim.gap ?? 1
  const lines: string[] = []

  for (let i = 0; i < prim.items.length; i++) {
    if (i > 0 && gap > 0) {
      for (let g = 0; g < gap; g++) lines.push('')
    }
    lines.push(...renderPrimitive(prim.items[i], width, theme))
  }

  return lines
})
