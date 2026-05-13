/**
 * ls renderer — numbered list
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Ls } from '../types.ts'
import { register } from '../registry.ts'

register<Ls>('ls', (prim, width, theme) => {
  if (prim.d.length === 0) return [theme.fg('muted', '(empty list)')]

  const gutterWidth = String(prim.d.length).length + 2 // "1. " padding

  return prim.d.map((item, i) => {
    const num = theme.fg('dim', String(i + 1).padStart(String(prim.d.length).length) + '.')
    const text = typeof item === 'object' ? JSON.stringify(item) : String(item)
    return truncateToWidth(`${num} ${theme.fg('toolOutput', text)}`, width)
  })
})
