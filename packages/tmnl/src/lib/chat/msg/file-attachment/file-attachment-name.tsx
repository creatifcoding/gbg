/**
 * ChatFileAttachment.Name — Clickable filename link.
 *
 * @module chat/msg/file-attachment
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatFileAttachment } from './file-attachment-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatFileAttachmentNameProps extends ComponentPropsWithoutRef<'a'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatFileAttachmentName = memo(forwardRef<HTMLAnchorElement, ChatFileAttachmentNameProps>(
  ({ className, children, ...props }, ref) => {
    const { url, filename } = useChatFileAttachment()

    return (
      <a
        ref={ref}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-slot="tmnl-chat-file-name"
        className={cn(
          'text-cyan-400 font-mono truncate hover:underline',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        {...props}
      >
        {children ?? filename}
      </a>
    )
  },
))

ChatFileAttachmentName.displayName = 'ChatFileAttachment.Name'
