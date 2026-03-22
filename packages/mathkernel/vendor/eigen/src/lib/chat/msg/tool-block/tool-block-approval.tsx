/**
 * ChatToolBlock.Approval — Action buttons for approval-required state.
 *
 * Renders Approve / Deny buttons when tool state is 'approval-required'.
 * Hidden for all other states.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { CheckIcon, XIcon } from 'lucide-react'
import { useChatToolBlock } from './tool-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockApprovalProps extends ComponentPropsWithoutRef<'div'> {
  /** Callback when user approves */
  onApprove?: (toolCallId: string) => void
  /** Callback when user denies */
  onDeny?: (toolCallId: string) => void
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockApproval = memo(forwardRef<HTMLDivElement, ChatToolBlockApprovalProps>(
  ({ onApprove, onDeny, className, ...props }, ref) => {
    const { toolCallId, state } = useChatToolBlock()

    if (state !== 'approval-required') return null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-tool-approval"
        className={cn(
          'flex items-center gap-2 px-3 py-2 border-t border-amber-500/20',
          className,
        )}
        {...props}
      >
        <span
          className="text-amber-400 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Requires approval
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => onApprove?.(toolCallId)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded font-mono',
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
              'hover:bg-emerald-500/20 transition-colors duration-150',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <CheckIcon className="size-3" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => onDeny?.(toolCallId)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded font-mono',
              'bg-red-500/10 text-red-400 border border-red-500/20',
              'hover:bg-red-500/20 transition-colors duration-150',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <XIcon className="size-3" />
            Deny
          </button>
        </div>
      </div>
    )
  },
))

ChatToolBlockApproval.displayName = 'ChatToolBlock.Approval'
