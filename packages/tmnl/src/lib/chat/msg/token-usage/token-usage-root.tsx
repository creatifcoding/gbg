/**
 * ChatTokenUsage.Root — Compound root providing token usage context.
 *
 * Computes derived values (usedPercent, totalTokens) from raw data.
 *
 * @module chat/msg/token-usage
 */

import {
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { useBlockDensity } from '../density-context'
import {
  ChatTokenUsageContext,
  type ChatTokenUsageContextValue,
  type TokenUsageData,
} from './token-usage-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatTokenUsageRootProps extends ComponentPropsWithoutRef<'div'>, TokenUsageData {
  /** Whether data is still loading */
  isLoading?: boolean
  children?: ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatTokenUsageRoot = memo(forwardRef<HTMLDivElement, ChatTokenUsageRootProps>(
  (
    {
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      totalTokens: totalProp,
      maxTokens,
      modelId,
      costUsd,
      isLoading = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const ctx = useMemo<ChatTokenUsageContextValue>(() => {
      const total = totalProp ?? (
        (inputTokens ?? 0) + (outputTokens ?? 0) + (reasoningTokens ?? 0)
      )
      const usedPercent = maxTokens && maxTokens > 0 ? Math.min(total / maxTokens, 1) : 0

      return {
        inputTokens,
        outputTokens,
        reasoningTokens,
        cachedTokens,
        totalTokens: total,
        maxTokens,
        modelId,
        costUsd,
        isLoading,
        usedPercent,
      }
    }, [inputTokens, outputTokens, reasoningTokens, cachedTokens, totalProp, maxTokens, modelId, costUsd, isLoading])

    const density = useBlockDensity('tokenUsage')

    // Pill density: token usage is typically hidden (tokenBudgetVisible=false)
    // but if explicitly rendered, show minimal inline
    if (density === 'pill') {
      return (
        <ChatTokenUsageContext.Provider value={ctx}>
          <span
            ref={ref}
            data-slot="tmnl-chat-token-usage"
            data-density="pill"
            className={cn('text-neutral-500 font-mono', className)}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            {...props}
          >
            {ctx.totalTokens.toLocaleString()}t
          </span>
        </ChatTokenUsageContext.Provider>
      )
    }

    // ── Expand/collapse toggle ─────────────────────────
    const [expanded, setExpanded] = useState(false)
    const toggleExpanded = useCallback(() => setExpanded((p) => !p), [])

    // Compact density: click-to-expand inline summary → full detail
    if (density === 'compact' && !expanded) {
      const label = ctx.modelId
        ? `${ctx.totalTokens.toLocaleString()} tokens · ${ctx.modelId}`
        : `${ctx.totalTokens.toLocaleString()} tokens`

      return (
        <ChatTokenUsageContext.Provider value={ctx}>
          <button
            ref={ref as React.Ref<HTMLButtonElement>}
            type="button"
            data-slot="tmnl-chat-token-usage"
            data-density="compact"
            data-state="collapsed"
            onClick={toggleExpanded}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded',
              'font-mono text-neutral-500 hover:text-neutral-400',
              'hover:bg-neutral-800/30 transition-colors duration-150',
              'cursor-pointer',
              className,
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            title="Click to expand token details"
            {...(props as React.ComponentPropsWithoutRef<'button'>)}
          >
            <span>{label}</span>
          </button>
        </ChatTokenUsageContext.Provider>
      )
    }

    return (
      <ChatTokenUsageContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="tmnl-chat-token-usage"
          data-density={density}
          data-state={expanded ? 'expanded' : undefined}
          className={cn('inline-flex items-center', className)}
          onClick={density === 'compact' ? toggleExpanded : undefined}
          {...props}
        >
          {children}
        </div>
      </ChatTokenUsageContext.Provider>
    )
  },
))

ChatTokenUsageRoot.displayName = 'ChatTokenUsage.Root'
