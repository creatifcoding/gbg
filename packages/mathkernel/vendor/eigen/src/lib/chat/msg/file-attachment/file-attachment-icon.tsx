/**
 * ChatFileAttachment.Icon — File type icon based on MIME type.
 *
 * @module chat/msg/file-attachment
 */

import { forwardRef, memo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { FileIcon, FileCodeIcon, FileTextIcon, ImageIcon, FileVideoIcon, FileAudioIcon } from 'lucide-react'
import { useChatFileAttachment } from './file-attachment-context'

// =============================================================================
// Helpers
// =============================================================================

function getFileIcon(mediaType: string) {
  if (mediaType.startsWith('image/')) return ImageIcon
  if (mediaType.startsWith('video/')) return FileVideoIcon
  if (mediaType.startsWith('audio/')) return FileAudioIcon
  if (mediaType.includes('json') || mediaType.includes('javascript') || mediaType.includes('typescript'))
    return FileCodeIcon
  if (mediaType.startsWith('text/')) return FileTextIcon
  return FileIcon
}

// =============================================================================
// Props
// =============================================================================

export interface ChatFileAttachmentIconProps extends ComponentPropsWithoutRef<'span'> {}

// =============================================================================
// Component
// =============================================================================

export const ChatFileAttachmentIcon = memo(forwardRef<HTMLSpanElement, ChatFileAttachmentIconProps>(
  ({ className, ...props }, ref) => {
    const { mediaType } = useChatFileAttachment()
    const Icon = getFileIcon(mediaType)

    return (
      <span ref={ref} data-slot="tmnl-chat-file-icon" className={cn('shrink-0', className)} {...props}>
        <Icon className="size-3.5 text-neutral-500" />
      </span>
    )
  },
))

ChatFileAttachmentIcon.displayName = 'ChatFileAttachment.Icon'
