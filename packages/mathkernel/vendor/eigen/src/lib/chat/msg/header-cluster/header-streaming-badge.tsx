/**
 * ChatMessageHeaderStreamingBadge — Live streaming metrics display.
 *
 * EPOCH-0005: Replaces static 'streaming' label with live token counter,
 * rate, and elapsed time from StreamingMetrics context.
 *
 * During streaming: `🤖 247 tok · 38/s · 6s`
 * During idle: `🤖 IDLE`
 *
 * PURPOSE: Token counter + rate communicates model performance to the user.
 * Claude Code does this — users expect it from a serious coding harness.
 *
 * @module chat/msg/header-cluster/header-streaming-badge
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Bot } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import {
  CHAT_ICON_STROKE_WIDTH,
  CHAT_UTILITY_ICON_SIZE,
  normalizeChatRole,
  type ChatRawRole,
} from '../iconography'
import { useStreamingMetrics } from '@/lib/morphchat/components/streaming-metrics-provider'

export interface ChatMessageHeaderStreamingBadgeProps extends ComponentPropsWithoutRef<'span'> {
  streaming?: boolean
  role?: ChatRawRole
  label?: string
}

/**
 * Format metrics for display: `247 tok · 38/s · 6s`
 * Only shows non-zero values. Rate appears after 0.5s stabilization.
 */
function formatStreamingMetrics(tokens: number, rate: number, elapsed: number): string {
  const parts: string[] = []
  if (tokens > 0) parts.push(`${tokens} tok`)
  if (rate > 0) parts.push(`${rate}/s`)
  if (elapsed > 0) parts.push(`${elapsed}s`)
  return parts.length > 0 ? parts.join(' · ') : 'streaming'
}

export const ChatMessageHeaderStreamingBadge = forwardRef<
  HTMLSpanElement,
  ChatMessageHeaderStreamingBadgeProps
>(({ streaming = false, role = 'agent', label, className, ...props }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const semanticRole = normalizeChatRole(role)
  const animateIcon = semanticRole === 'agent' && streaming && !prefersReducedMotion
  const metrics = useStreamingMetrics()

  // Derive display label
  const displayLabel = label
    ?? (streaming && metrics.active
      ? formatStreamingMetrics(metrics.tokensReceived, metrics.tokensPerSecond, metrics.elapsedSec)
      : streaming
        ? 'streaming'
        : 'idle')

  return (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-header-streaming-badge"
      data-streaming={streaming || undefined}
      data-role={semanticRole}
      className={cn(
        'inline-flex items-center gap-1 font-mono',
        streaming ? 'text-cyan-400' : 'text-neutral-600',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
      {...props}
    >
      <motion.span
        className="inline-flex"
        animate={animateIcon ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
        transition={
          animateIcon
            ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0 }
        }
      >
        <Bot
          size={CHAT_UTILITY_ICON_SIZE}
          strokeWidth={CHAT_ICON_STROKE_WIDTH}
          aria-hidden="true"
        />
      </motion.span>
      <span className={cn(
        streaming ? '' : 'uppercase tracking-wider',
        'tabular-nums',
      )}>
        {streaming ? displayLabel : 'IDLE'}
      </span>
    </span>
  )
})

ChatMessageHeaderStreamingBadge.displayName = 'ChatMessage.HeaderCluster.StreamingBadge'
