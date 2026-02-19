/**
 * ChatToolBlock.Input — Displays tool input parameters as formatted JSON.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatToolBlock } from './tool-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockInputProps extends ComponentPropsWithoutRef<'div'> {
  /** Override label. Default: "Parameters" */
  label?: string
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockInput = memo(forwardRef<HTMLDivElement, ChatToolBlockInputProps>(
  ({ label = 'Parameters', className, ...props }, ref) => {
    const { input } = useChatToolBlock()

    if (input == null) return null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-tool-input"
        className={cn('space-y-1 px-3 pb-2', className)}
        {...props}
      >
        <span
          className="text-neutral-600 font-mono uppercase tracking-wide block"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {label}
        </span>
        <pre
          className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
        </pre>
      </div>
    )
  },
))

ChatToolBlockInput.displayName = 'ChatToolBlock.Input'
