/**
 * ChatTokenUsage.Detail — Breakdown of input/output/reasoning/cache tokens.
 *
 * @module chat/msg/token-usage
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatTokenUsage } from './token-usage-context'

// =============================================================================
// Helpers
// =============================================================================

function formatTokens(n: number | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// =============================================================================
// Props
// =============================================================================

export interface ChatTokenUsageDetailProps extends ComponentPropsWithoutRef<'div'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatTokenUsageDetail = memo(forwardRef<HTMLDivElement, ChatTokenUsageDetailProps>(
  ({ className, ...props }, ref) => {
    const {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      totalTokens,
      maxTokens,
      usedPercent,
    } = useChatTokenUsage()

    const pctText = new Intl.NumberFormat('en-US', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(usedPercent)

    const rows: Array<{ label: string; value: number | undefined; color: string }> = [
      { label: 'Input', value: inputTokens, color: 'text-neutral-400' },
      { label: 'Output', value: outputTokens, color: 'text-neutral-400' },
      { label: 'Reasoning', value: reasoningTokens, color: 'text-violet-400' },
      { label: 'Cache', value: cachedTokens, color: 'text-emerald-400' },
    ].filter(r => r.value != null && r.value > 0)

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-token-detail"
        className={cn('space-y-1 font-mono', className)}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        {/* Summary line */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-500">{pctText}</span>
          <span className="text-neutral-500">
            {formatTokens(totalTokens)}{maxTokens ? ` / ${formatTokens(maxTokens)}` : ''}
          </span>
        </div>
        {/* Breakdown rows */}
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-neutral-600">{label}</span>
            <span className={color}>{formatTokens(value)}</span>
          </div>
        ))}
      </div>
    )
  },
))

ChatTokenUsageDetail.displayName = 'ChatTokenUsage.Detail'
