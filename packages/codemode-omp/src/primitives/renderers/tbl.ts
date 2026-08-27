/**
 * tbl renderer — auto-sized table columns
 *
 * Reuses the existing grid.ts table logic for arrays of objects.
 * @module
 */

import type { Tbl } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'
import { gridLines } from '../../grid.ts'

export function registerTblRenderer(registry: PrimitiveRegistry): void {
  registry.register<Tbl>('tbl', (prim: Tbl, width: number, ctx: RenderContext): string[] => {
    if (prim.d.length === 0) return [ctx.theme.fg('muted', '(empty table)')]
    return gridLines(prim.d, width, ctx)
  })
}
