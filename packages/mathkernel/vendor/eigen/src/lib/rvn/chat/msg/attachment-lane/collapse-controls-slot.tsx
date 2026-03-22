import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatMessageAttachmentLaneContext } from './attachment-lane-context'

export type RvnChatMessageCollapseControlsSlotProps = ComponentPropsWithoutRef<'div'>

export const RvnChatMessageCollapseControlsSlot = forwardRef<
  HTMLDivElement,
  RvnChatMessageCollapseControlsSlotProps
>(({ className, ...props }, ref) => {
  const { messageAnchorId } = useRvnChatMessageAttachmentLaneContext(
    'RvnChatMessage.AttachmentLane.CollapseControls',
  )

  return (
    <div
      ref={ref}
      data-slot="rvn-chat-message-collapse-controls-slot"
      data-message-anchor-id={messageAnchorId}
      className={cn('rvn-chat__message-attachment-collapse-controls', className)}
      {...props}
    />
  )
})

RvnChatMessageCollapseControlsSlot.displayName = 'RvnChatMessage.AttachmentLane.CollapseControls'
