/**
 * ChatCodeBlock.CopyButton — Copy-to-clipboard with check feedback.
 *
 * Positioned absolute top-right within the code block.
 * Shows CopyIcon → CheckIcon transition on click.
 *
 * @module chat/msg/code-block
 */

import { forwardRef, memo, useCallback, useState, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useChatCodeBlock } from './code-block-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatCodeBlockCopyButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Callback after successful copy */
  onCopy?: () => void
  /** Callback on copy error */
  onError?: (error: Error) => void
  /** Duration to show check icon (ms) */
  timeout?: number
}

// =============================================================================
// Component
// =============================================================================

export const ChatCodeBlockCopyButton = memo(forwardRef<HTMLButtonElement, ChatCodeBlockCopyButtonProps>(
  ({ onCopy, onError, timeout = 2000, className, children, ...props }, ref) => {
    const { code } = useChatCodeBlock()
    const [isCopied, setIsCopied] = useState(false)

    const handleCopy = useCallback(async () => {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        onError?.(new Error('Clipboard API not available'))
        return
      }
      try {
        await navigator.clipboard.writeText(code)
        setIsCopied(true)
        onCopy?.()
        setTimeout(() => setIsCopied(false), timeout)
      } catch (err) {
        onError?.(err as Error)
      }
    }, [code, onCopy, onError, timeout])

    const Icon = isCopied ? CheckIcon : CopyIcon

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-code-copy"
        onClick={handleCopy}
        className={cn(
          'absolute top-2 right-2 p-1.5 rounded',
          'text-neutral-600 hover:text-neutral-300',
          'bg-neutral-900/80 hover:bg-neutral-800',
          'opacity-0 group-hover:opacity-100',
          'transition-all duration-150',
          'border border-neutral-800',
          isCopied && 'text-emerald-400',
          className,
        )}
        aria-label={isCopied ? 'Copied' : 'Copy code'}
        {...props}
      >
        {children ?? <Icon className="size-3.5" />}
      </button>
    )
  },
))

ChatCodeBlockCopyButton.displayName = 'ChatCodeBlock.CopyButton'
