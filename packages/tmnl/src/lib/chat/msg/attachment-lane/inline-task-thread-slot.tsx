import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type ChatMessageInlineTaskThreadSlotProps = ComponentPropsWithoutRef<'div'>

export const ChatMessageInlineTaskThreadSlot = forwardRef<
  HTMLDivElement,
  ChatMessageInlineTaskThreadSlotProps
>(({ className, ...props }, ref) => {
  const { messageAnchorId } = useChatMessageAttachmentLaneContext(
    'ChatMessage.AttachmentLane.InlineTaskThread',
  )

  return (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-inline-task-thread-slot"
      data-message-anchor-id={messageAnchorId}
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  )
})

ChatMessageInlineTaskThreadSlot.displayName = 'ChatMessage.AttachmentLane.InlineTaskThread'
