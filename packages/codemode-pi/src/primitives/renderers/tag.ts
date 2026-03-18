/**
 * tag renderer — inline colored badge
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Tag } from '../types.js'
import { register } from '../registry.js'

register<Tag>('tag', (prim, width, theme) => {
  const color = prim.color ?? 'accent'
  return [truncateToWidth(theme.fg(color, `[${prim.text}]`), width)]
})
