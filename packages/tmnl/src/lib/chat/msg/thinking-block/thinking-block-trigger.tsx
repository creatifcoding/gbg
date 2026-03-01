/**
 * ChatThinkingBlock.Trigger — Clickable header that toggles content visibility.
 *
 * Shows brain icon, duration/streaming label, and chevron indicator.
 * Reads state from compound context.
 *
 * @module chat/msg/thinking-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BrainIcon, ChevronDownIcon } from 'lucide-react'
import { useChatThinkingBlock } from './thinking-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatThinkingBlockTriggerProps extends ComponentPropsWithoutRef<'button'> {
  /** Custom label renderer. If omitted, uses default duration/streaming label. */
  getLabel?: (isStreaming: boolean, durationSec?: number) => ReactNode
}

// =============================================================================
// Default label
// =============================================================================

function defaultGetLabel(isStreaming: boolean, durationSec?: number): ReactNode {
  if (isStreaming) {
    return (
      <span className="text-violet-400 animate-pulse">
        Thinking… {durationSec != null && durationSec > 0 ? `${durationSec}s` : ''}
      </span>
    )
  }
  if (durationSec == null) {
    return <span className="text-neutral-500">Thought for a few seconds</span>
  }
  return (
    <span className="text-neutral-500">
      Thought for {durationSec}s
    </span>
  )
}

// =============================================================================
// Component
// =============================================================================

export const ChatThinkingBlockTrigger = memo(forwardRef<HTMLButtonElement, ChatThinkingBlockTriggerProps>(
  ({ getLabel = defaultGetLabel, className, children, ...props }, ref) => {
    const { isStreaming, isOpen, setIsOpen, durationSec } = useChatThinkingBlock()

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-thinking-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5',
          'text-left font-mono transition-colors duration-150',
          'hover:bg-violet-500/[0.04]',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
        aria-expanded={isOpen}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-3.5 text-violet-400 shrink-0" />
            {getLabel(isStreaming, durationSec)}
            <ChevronDownIcon
              className={cn(
                'size-3 text-neutral-600 ml-auto shrink-0 transition-transform duration-200',
                isOpen ? 'rotate-180' : 'rotate-0',
              )}
            />
          </>
        )}
      </button>
    )
  },
))

ChatThinkingBlockTrigger.displayName = 'ChatThinkingBlock.Trigger'
