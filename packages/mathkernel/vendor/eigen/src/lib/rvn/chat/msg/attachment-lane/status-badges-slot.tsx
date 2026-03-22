import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type RvnChatMessageStatusBadgesSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatMessageStatusBadgesSlot = forwardRef<HTMLDivElement, RvnChatMessageStatusBadgesSlotProps>(
  ({ className, ...props }, ref) => {
    const { messageAnchorId } = useRvnChatMessageAttachmentLaneContext(
      'RvnChatMessage.AttachmentLane.StatusBadges',
    )

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-message-status-badges-slot"
        data-message-anchor-id={messageAnchorId}
        className={cn('rvn-chat__message-attachment-status-badges', className)}
        {...props}
      />
    )
  },
)

RvnChatMessageStatusBadgesSlot.displayName = 'RvnChatMessage.AttachmentLane.StatusBadges'
