/**
 * ChatToolBlock.Output — Displays tool output/result or error.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatToolBlock } from './tool-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockOutputProps extends ComponentPropsWithoutRef<'div'> {
  /** Override label. Default: "Result" or "Error" based on state. */
  label?: string
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockOutput = memo(forwardRef<HTMLDivElement, ChatToolBlockOutputProps>(
  ({ label, className, ...props }, ref) => {
    const { output, errorText, state } = useChatToolBlock()

    if (output == null && errorText == null) return null

    const isError = state === 'error' || errorText != null
    const resolvedLabel = label ?? (isError ? 'Error' : 'Result')

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-tool-output"
        className={cn('space-y-1 px-3 pb-2', className)}
        {...props}
      >
        <span
          className={cn(
            'font-mono uppercase tracking-wide block',
            isError ? 'text-red-500' : 'text-neutral-600',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {resolvedLabel}
        </span>
        {errorText != null && (
          <pre
            className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {errorText}
          </pre>
        )}
        {output != null && (
          <pre
            className="bg-neutral-900/50 rounded p-2 text-neutral-400 font-mono overflow-x-auto"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
          </pre>
        )}
      </div>
    )
  },
))

ChatToolBlockOutput.displayName = 'ChatToolBlock.Output'
