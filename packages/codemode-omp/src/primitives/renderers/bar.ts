/**
 * bar renderer — progress/meter bar
 * @module
 */

import type { Bar } from '../types.ts'
import type { PrimitiveRegistry } from '../registry.ts'
import type { RenderContext } from '../render-host.ts'

export function registerBarRenderer(registry: PrimitiveRegistry): void {
  registry.register<Bar>('bar', (prim: Bar, width: number, ctx: RenderContext): string[] => {
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
      return [ctx.text.truncateToWidth(ctx.theme.fg('toolOutput', info), width)]
    }

    // Bar width: remaining after info + 1 space separator
    const barWidth = width - info.length - 1
    const filled = Math.round(pct * barWidth)
    const empty = barWidth - filled

    const barFilled = ctx.theme.fg(pct >= 0.9 ? 'success' : pct >= 0.5 ? 'accent' : 'warning',
      '█'.repeat(filled))
    const barEmpty = ctx.theme.fg('dim', '░'.repeat(empty))

    return [ctx.text.truncateToWidth(`${barFilled}${barEmpty} ${ctx.theme.fg('toolOutput', info)}`, width)]
  })
}
