/**
 * ls renderer — numbered list
 * @module
 */

import type { Ls } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerLsRenderer(registry: PrimitiveRegistry): void {
  registry.register<Ls>('ls', (prim: Ls, width: number, ctx: RenderContext): string[] => {
    if (prim.d.length === 0) return [ctx.theme.fg('muted', '(empty list)')]

    return prim.d.map((item, i) => {
      const num = ctx.theme.fg('dim', String(i + 1).padStart(String(prim.d.length).length) + '.')
      const text = typeof item === 'object' ? JSON.stringify(item) : String(item)
      return ctx.text.truncateToWidth(`${num} ${ctx.theme.fg('toolOutput', text)}`, width)
    })
  })
}
