/**
 * tbl renderer — auto-sized table columns
 *
 * Reuses the existing grid.ts table logic for arrays of objects.
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import type { Tbl } from '../types.js'
import { register } from '../registry.js'
import { gridLines } from '../../grid.js'

register<Tbl>('tbl', (prim, width, theme) => {
  if (prim.d.length === 0) return [theme.fg('muted', '(empty table)')]
  return gridLines(prim.d, width, theme)
})
