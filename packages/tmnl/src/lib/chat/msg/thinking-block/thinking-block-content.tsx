/**
 * ChatThinkingBlock.Content — Collapsible content panel.
 *
 * Animated expand/collapse using CSS grid trick (grid-template-rows: 0fr → 1fr).
 * Renders thinking text in muted monospace.
 *
 * @module chat/msg/thinking-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatThinkingBlock } from './thinking-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatThinkingBlockContentProps extends ComponentPropsWithoutRef<'div'> {
  /** Thinking text content. Pass as prop OR as children. */
  content?: string
}

// =============================================================================
// Component
// =============================================================================

export const ChatThinkingBlockContent = memo(forwardRef<HTMLDivElement, ChatThinkingBlockContentProps>(
  ({ content, className, children, ...props }, ref) => {
    const { isOpen, isStreaming } = useChatThinkingBlock()

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-thinking-content"
        data-state={isOpen ? 'open' : 'closed'}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-150 ease-out will-change-[grid-template-rows]',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        aria-hidden={!isOpen}
        {...props}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'px-3 pb-2 font-mono leading-relaxed',
              'text-neutral-500',
              isStreaming && 'text-neutral-400',
              className,
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {children ?? content}
          </div>
        </div>
      </div>
    )
  },
))

ChatThinkingBlockContent.displayName = 'ChatThinkingBlock.Content'
