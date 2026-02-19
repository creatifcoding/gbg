/**
 * ChatToolBlock.Content — Animated collapsible panel wrapping Input + Output.
 *
 * Uses CSS grid trick for smooth expand/collapse animation.
 * Reads open state from compound context.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatToolBlock } from './tool-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockContentProps extends ComponentPropsWithoutRef<'div'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockContent = memo(forwardRef<HTMLDivElement, ChatToolBlockContentProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen, hasDetails } = useChatToolBlock()

    if (!hasDetails) return null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-tool-content"
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
              'border-t border-neutral-800/50 pt-2',
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    )
  },
))

ChatToolBlockContent.displayName = 'ChatToolBlock.Content'
