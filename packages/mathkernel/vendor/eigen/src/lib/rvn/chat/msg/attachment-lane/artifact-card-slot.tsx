import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type RvnChatMessageArtifactCardSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatMessageArtifactCardSlot = forwardRef<HTMLDivElement, RvnChatMessageArtifactCardSlotProps>(
  ({ className, ...props }, ref) => {
    const { messageAnchorId } = useRvnChatMessageAttachmentLaneContext(
      'RvnChatMessage.AttachmentLane.ArtifactCard',
    )

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-message-artifact-card-slot"
        data-message-anchor-id={messageAnchorId}
        className={cn('rvn-chat__message-attachment-artifact-card', className)}
        {...props}
      />
    )
  },
)

RvnChatMessageArtifactCardSlot.displayName = 'RvnChatMessage.AttachmentLane.ArtifactCard'
