/**
 * bar renderer — progress/meter bar
 * @module
 */

import type { Theme } from '@mariozechner/pi-coding-agent'
import { truncateToWidth } from '@mariozechner/pi-tui'
import type { Bar } from '../types.js'
import { register } from '../registry.js'

register<Bar>('bar', (prim, width, theme) => {
  const { v, max, label } = prim
  const pct = max > 0 ? Math.min(1, Math.max(0, v / max)) : 0

  // Label + numbers: "label 3/71 (4%)"
  const labelText = label ? `${label} ` : ''
  const numbers = `${v}/${max}`
  const percent = `${Math.round(pct * 100)}%`
  const info = `${labelText}${numbers} (${percent})`

  // If width is too narrow for bar + info, just show info truncated
  const minBarAndInfo = 4 + 1 + info.length // 4-char bar + space + info
  if (width < minBarAndInfo) {
    return [truncateToWidth(theme.fg('toolOutput', info), width)]
  }

  // Bar width: remaining after info + 1 space separator
  const barWidth = width - info.length - 1
  const filled = Math.round(pct * barWidth)
  const empty = barWidth - filled

  const barFilled = theme.fg(pct >= 0.9 ? 'success' : pct >= 0.5 ? 'accent' : 'warning',
    '█'.repeat(filled))
  const barEmpty = theme.fg('dim', '░'.repeat(empty))

  return [truncateToWidth(`${barFilled}${barEmpty} ${theme.fg('toolOutput', info)}`, width)]
})
