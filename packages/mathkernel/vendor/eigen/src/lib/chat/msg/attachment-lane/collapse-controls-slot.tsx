import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type ChatMessageCollapseControlsSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatMessageCollapseControlsSlot = forwardRef<
  HTMLDivElement,
  ChatMessageCollapseControlsSlotProps
>(({ className, ...props }, ref) => {
  const { messageAnchorId } = useChatMessageAttachmentLaneContext(
    'ChatMessage.AttachmentLane.CollapseControls',
  )

  return (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-collapse-controls-slot"
      data-message-anchor-id={messageAnchorId}
      className={cn('flex items-center gap-1', className)}
      {...props}
    />
  )
})

ChatMessageCollapseControlsSlot.displayName = 'ChatMessage.AttachmentLane.CollapseControls'
