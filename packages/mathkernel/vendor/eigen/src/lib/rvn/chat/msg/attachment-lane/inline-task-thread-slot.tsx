import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type RvnChatMessageInlineTaskThreadSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatMessageInlineTaskThreadSlot = forwardRef<
  HTMLDivElement,
  RvnChatMessageInlineTaskThreadSlotProps
>(({ className, ...props }, ref) => {
  const { messageAnchorId } = useRvnChatMessageAttachmentLaneContext(
    'RvnChatMessage.AttachmentLane.InlineTaskThread',
  )

  return (
    <div
      ref={ref}
      data-slot="rvn-chat-message-inline-task-thread-slot"
      data-message-anchor-id={messageAnchorId}
      className={cn('rvn-chat__message-attachment-inline-task-thread', className)}
      {...props}
    />
  )
})

RvnChatMessageInlineTaskThreadSlot.displayName = 'RvnChatMessage.AttachmentLane.InlineTaskThread'
