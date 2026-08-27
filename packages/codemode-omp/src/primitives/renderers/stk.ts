/**
 * stk renderer — vertical stack with gap
 *
 * Renders each child at full width, separated by gap blank lines.
 * @module
 */

import type { Stk } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerStkRenderer(registry: PrimitiveRegistry): void {
  registry.register<Stk>('stk', (prim: Stk, width: number, ctx: RenderContext): string[] => {
    const gap = prim.gap ?? 1
    const lines: string[] = []

    for (let i = 0; i < prim.items.length; i++) {
      if (i > 0 && gap > 0) {
        for (let g = 0; g < gap; g++) lines.push('')
      }
      lines.push(...registry.renderPrimitive(prim.items[i], width, ctx))
    }

    return lines
  })
}
