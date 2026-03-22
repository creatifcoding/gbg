import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type ChatMessageStatusBadgesSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatMessageStatusBadgesSlot = forwardRef<HTMLDivElement, ChatMessageStatusBadgesSlotProps>(
  ({ className, ...props }, ref) => {
    const { messageAnchorId } = useChatMessageAttachmentLaneContext(
      'ChatMessage.AttachmentLane.StatusBadges',
    )

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-status-badges-slot"
        data-message-anchor-id={messageAnchorId}
        className={cn('flex items-center gap-1.5', className)}
        {...props}
      />
    )
  },
)

ChatMessageStatusBadgesSlot.displayName = 'ChatMessage.AttachmentLane.StatusBadges'
