/**
 * code renderer — syntax-highlighted block
 * @module
 */

import type { Code } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerCodeRenderer(registry: PrimitiveRegistry): void {
  registry.register<Code>('code', (prim: Code, width: number, ctx: RenderContext): string[] => {
    if (!prim.d) return [ctx.theme.fg('muted', '(empty)')]

    const lang = prim.lang ?? 'text'
    const highlighted = ctx.code.highlight(prim.d, lang)

    return highlighted.map(line => ctx.text.truncateToWidth(line, width))
  })
}
