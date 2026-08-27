/**
 * tag renderer — inline colored badge
 * @module
 */

import type { Tag } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerTagRenderer(registry: PrimitiveRegistry): void {
  registry.register<Tag>('tag', (prim: Tag, width: number, ctx: RenderContext): string[] => {
    const color = prim.color ?? 'accent'
    return [ctx.text.truncateToWidth(ctx.theme.fg(color, `[${prim.text}]`), width)]
  })
}
