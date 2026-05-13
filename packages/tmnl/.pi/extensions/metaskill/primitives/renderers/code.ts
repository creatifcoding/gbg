/**
 * code renderer — syntax-highlighted block
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { highlightCode } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Code } from '../types.ts'
import { register } from '../registry.ts'

register<Code>('code', (prim, width, theme) => {
  if (!prim.d) return [theme.fg('muted', '(empty)')]

  const lang = prim.lang ?? 'text'
  const highlighted = highlightCode(prim.d, lang)

  return highlighted.map(line => truncateToWidth(line, width))
})
