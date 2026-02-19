/**
 * ChatThinkingBlock — Displays reasoning/thinking content
 *
 * Phase A: Minimal functional renderer.
 * Phase B (task #1534): Full compound with collapsible trigger, duration display,
 * streaming shimmer, and auto-close behavior.
 *
 * @module chat/msg/thinking-block
 */

import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { BrainIcon } from 'lucide-react'

export interface ChatThinkingBlockProps extends ComponentPropsWithoutRef<'div'> {
  /** Thinking text content */
  content: string
  /** Whether thinking is still streaming */
  isStreaming?: boolean
  /** Thinking duration in ms (shown when complete) */
  durationMs?: number
}

export const ChatThinkingBlock = forwardRef<HTMLDivElement, ChatThinkingBlockProps>(
  ({ content, isStreaming = false, durationMs, className, ...props }, ref) => {
    const durationLabel = durationMs != null
      ? `${Math.ceil(durationMs / 1000)}s`
      : isStreaming
        ? 'thinking…'
        : 'thought'

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-thinking-block"
        data-streaming={isStreaming || undefined}
        className={cn(
          'rounded border px-3 py-2 my-1',
          'border-violet-500/20 bg-violet-500/5',
          isStreaming && 'animate-pulse',
          className,
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <BrainIcon className="size-3.5 text-violet-400" />
          <span
            className="text-violet-400 font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {durationLabel}
          </span>
        </div>
        {/* Content */}
        <div
          className="text-neutral-400 font-mono leading-relaxed"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {content}
        </div>
      </div>
    )
  },
)

ChatThinkingBlock.displayName = 'ChatMessage.ThinkingBlock'
