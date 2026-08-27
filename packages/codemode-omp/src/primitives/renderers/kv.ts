/**
 * kv renderer — key-value pairs with nested support
 *
 * Reuses existing grid.ts key-value logic for single objects.
 * @module
 */

import type { Kv } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'
import { gridLines } from '../../grid.ts'

export function registerKvRenderer(registry: PrimitiveRegistry): void {
  registry.register<Kv>('kv', (prim: Kv, width: number, ctx: RenderContext): string[] => {
    const entries = Object.entries(prim.d)
    if (entries.length === 0) return [ctx.theme.fg('muted', '(empty)')]
    return gridLines(prim.d, width, ctx)
  })
}
