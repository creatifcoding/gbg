/**
 * ChatCodeBlock.Header — Language label + filename bar at top of code block.
 *
 * @module chat/msg/code-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { CodeIcon } from 'lucide-react'
import { useChatCodeBlock } from './code-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatCodeBlockHeaderProps extends ComponentPropsWithoutRef<'div'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatCodeBlockHeader = memo(forwardRef<HTMLDivElement, ChatCodeBlockHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const { language, filename } = useChatCodeBlock()

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-code-header"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800',
          'bg-neutral-900/50',
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <CodeIcon className="size-3 text-neutral-600 shrink-0" />
            {filename ? (
              <span
                className="text-neutral-400 font-mono truncate"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {filename}
              </span>
            ) : (
              <span
                className="text-neutral-600 font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {language}
              </span>
            )}
          </>
        )}
      </div>
    )
  },
))

ChatCodeBlockHeader.displayName = 'ChatCodeBlock.Header'
