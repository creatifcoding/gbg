/**
 * kv renderer — key-value pairs with nested support
 *
 * Reuses existing grid.ts key-value logic for single objects.
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import type { Kv } from '../types.ts'
import { register } from '../registry.ts'
import { gridLines } from '../../grid.ts'

register<Kv>('kv', (prim, width, theme) => {
  const entries = Object.entries(prim.d)
  if (entries.length === 0) return [theme.fg('muted', '(empty)')]
  return gridLines(prim.d, width, theme)
})
