/**
 * ChatFileAttachment.Size — Human-readable file size badge.
 *
 * @module chat/msg/file-attachment
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatFileAttachment } from './file-attachment-context'

// =============================================================================
// Helpers
// =============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// =============================================================================
// Props
// =============================================================================

export interface ChatFileAttachmentSizeProps extends ComponentPropsWithoutRef<'span'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatFileAttachmentSize = memo(forwardRef<HTMLSpanElement, ChatFileAttachmentSizeProps>(
  ({ className, ...props }, ref) => {
    const { size } = useChatFileAttachment()

    if (size == null) return null

    return (
      <span
        ref={ref}
        data-slot="tmnl-chat-file-size"
        className={cn('text-neutral-600 font-mono shrink-0', className)}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        {formatBytes(size)}
      </span>
    )
  },
))

ChatFileAttachmentSize.displayName = 'ChatFileAttachment.Size'
