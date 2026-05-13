/**
 * txt renderer — plain text with word wrap
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Txt } from '../types.ts'
import { register } from '../registry.ts'

register<Txt>('txt', (prim, width, theme) => {
  if (!prim.d) return [theme.fg('muted', '(empty)')]
  const color = prim.color ?? 'toolOutput'
  return prim.d.split('\n').map(line => truncateToWidth(theme.fg(color, line), width))
})
