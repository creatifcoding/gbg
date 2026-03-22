/**
 * ChatTokenUsage.Cost — Formatted USD cost display.
 *
 * @module chat/msg/token-usage
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatTokenUsage } from './token-usage-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatTokenUsageCostProps extends ComponentPropsWithoutRef<'span'> {
  /** Show "$0.00" when cost is zero or undefined. Default: false */
  showZero?: boolean
}

// =============================================================================
// Component
// =============================================================================

export const ChatTokenUsageCost = memo(forwardRef<HTMLSpanElement, ChatTokenUsageCostProps>(
  ({ showZero = false, className, ...props }, ref) => {
    const { costUsd } = useChatTokenUsage()

    if (!costUsd && !showZero) return null

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(costUsd ?? 0)

    return (
      <span
        ref={ref}
        data-slot="tmnl-chat-token-cost"
        className={cn('text-neutral-500 font-mono', className)}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        {formatted}
      </span>
    )
  },
))

ChatTokenUsageCost.displayName = 'ChatTokenUsage.Cost'
