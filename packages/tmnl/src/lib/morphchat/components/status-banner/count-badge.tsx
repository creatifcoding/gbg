/**
 * Collapsed stack count badge.
 *
 * @module morphchat/components/status-banner/count-badge
 */

import { memo } from 'react'

export const CountBadge = memo(function CountBadge({ count }: { count: number }) {
  if (count <= 1) return null
  return (
    <span
      className="relative shrink-0 inline-flex items-center justify-center rounded-full bg-neutral-800/70 text-neutral-300 tabular-nums"
      style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
      }}
    >
      {count}
    </span>
  )
})

CountBadge.displayName = 'CountBadge'
