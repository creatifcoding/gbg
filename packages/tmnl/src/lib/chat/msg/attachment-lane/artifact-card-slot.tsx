import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type ChatMessageArtifactCardSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatMessageArtifactCardSlot = forwardRef<HTMLDivElement, ChatMessageArtifactCardSlotProps>(
  ({ className, ...props }, ref) => {
    const { messageAnchorId } = useChatMessageAttachmentLaneContext(
      'ChatMessage.AttachmentLane.ArtifactCard',
    )

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-artifact-card-slot"
        data-message-anchor-id={messageAnchorId}
        className={cn('rounded-lg border border-neutral-800/50 p-3', className)}
        {...props}
      />
    )
  },
)

ChatMessageArtifactCardSlot.displayName = 'ChatMessage.AttachmentLane.ArtifactCard'
