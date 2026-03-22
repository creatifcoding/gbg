/**
 * ChatFileAttachment.Preview — Inline image preview (for image MIME types).
 *
 * Only renders when mediaType starts with 'image/'.
 * Lazy-loads with loading="lazy" for scroll perf.
 *
 * @module chat/msg/file-attachment
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatFileAttachment } from './file-attachment-context'

// =============================================================================
// Props
// =============================================================================

export interface ChatFileAttachmentPreviewProps extends ComponentPropsWithoutRef<'img'> {
  /** Max height for the preview. Default: 200px */
  maxHeight?: number
}

// =============================================================================
// Component
// =============================================================================

export const ChatFileAttachmentPreview = memo(forwardRef<HTMLImageElement, ChatFileAttachmentPreviewProps>(
  ({ maxHeight = 200, className, ...props }, ref) => {
    const { url, filename, isImage } = useChatFileAttachment()

    if (!isImage) return null

    return (
      <img
        ref={ref}
        src={url}
        alt={filename}
        loading="lazy"
        data-slot="tmnl-chat-file-preview"
        className={cn(
          'rounded border border-neutral-800 my-1.5 object-contain',
          className,
        )}
        style={{ maxHeight }}
        {...props}
      />
    )
  },
))

ChatFileAttachmentPreview.displayName = 'ChatFileAttachment.Preview'
