/**
 * txt renderer — plain text with word wrap
 * @module
 */

import type { Txt } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerTxtRenderer(registry: PrimitiveRegistry): void {
  registry.register<Txt>('txt', (prim: Txt, width: number, ctx: RenderContext): string[] => {
    if (!prim.d) return [ctx.theme.fg('muted', '(empty)')]
    const color = prim.color ?? 'toolOutput'
    return prim.d.split('\n').map(line => ctx.text.truncateToWidth(ctx.theme.fg(color, line), width))
  })
}
