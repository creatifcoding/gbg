/**
 * CountBadge — pill with worst-severity icon + count.
 *
 * Tinted by the highest-severity toast in the stack.
 * Height: 18px. Border-radius: 9px (full pill).
 * Icon: 9px Lucide, strokeWidth 2.5.
 * Count: 9px font-weight 500.
 *
 * Colors derived from tokens — no hardcoded hex.
 *
 * @module morphchat/components/status-banner/count-badge
 */

import { memo, useMemo } from 'react'
import type { StatusRowLike } from './types'
import { categoryOf, SEVERITY_WEIGHT } from '@/lib/harness/error-detail/category-registry'
import { badgeBgColor, badgeBorderColor } from '@/lib/harness/error-detail/tokens'
import type { HarnessErrorCode } from '@/lib/harness/error-codes'

export interface CountBadgeProps {
  readonly count: number
  readonly items?: ReadonlyArray<StatusRowLike>
}

export const CountBadge = memo(function CountBadge({ count, items }: CountBadgeProps) {
  if (count <= 1) return null

  const worstCategory = useMemo(() => {
    if (!items || items.length === 0) return null
    let worstWeight = 0
    let worstConfig = items[0]?.code ? categoryOf(items[0].code as HarnessErrorCode) : null
    for (const item of items) {
      if (!item.code) continue
      const config = categoryOf(item.code as HarnessErrorCode)
      const weight = SEVERITY_WEIGHT[config.severityLabel] ?? 0
      if (weight > worstWeight) {
        worstWeight = weight
        worstConfig = config
      }
    }
    return worstConfig
  }, [items])

  const IconComponent = worstCategory?.Icon
  const accent = worstCategory?.accent ?? '#737373'

  return (
    <span
      className="relative shrink-0 inline-flex items-center justify-center gap-[3px] rounded-full tabular-nums font-mono"
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        fontSize: '9px',
        fontWeight: 500,
        color: accent,
        background: badgeBgColor(accent),
        border: `1px solid ${badgeBorderColor(accent)}`,
      }}
    >
      {IconComponent && (
        <IconComponent size={9} strokeWidth={2.5} style={{ color: accent }} />
      )}
      {count}
    </span>
  )
})

CountBadge.displayName = 'CountBadge'
