/**
 * tag renderer — inline colored badge
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Tag } from '../types.ts'
import { register } from '../registry.ts'

register<Tag>('tag', (prim, width, theme) => {
  const color = prim.color ?? 'accent'
  return [truncateToWidth(theme.fg(color, `[${prim.text}]`), width)]
})
