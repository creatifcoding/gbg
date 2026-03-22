import { forwardRef, useMemo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import {
  RvnChatMessageAttachmentLaneContext,
  normalizeMessageAnchorId,
} from './attachment-lane-context'

export interface RvnChatMessageAttachmentLaneRootProps extends ComponentPropsWithoutRef<'section'> {
  messageAnchorId: string
}

export const RvnChatMessageAttachmentLaneRoot = forwardRef<
  HTMLElement,
  RvnChatMessageAttachmentLaneRootProps
>(({ messageAnchorId, className, children, ...props }, ref) => {
  const normalizedMessageAnchorId = useMemo(
    () => normalizeMessageAnchorId(messageAnchorId),
    [messageAnchorId],
  )

  return (
    <RvnChatMessageAttachmentLaneContext.Provider
      value={{ messageAnchorId: normalizedMessageAnchorId }}
    >
      <section
        ref={ref}
        data-slot="rvn-chat-message-attachment-lane"
        data-message-anchor-id={normalizedMessageAnchorId}
        className={cn('rvn-chat__message-attachment-lane', className)}
        {...props}
      >
        {children}
      </section>
    </RvnChatMessageAttachmentLaneContext.Provider>
  )
})

RvnChatMessageAttachmentLaneRoot.displayName = 'RvnChatMessage.AttachmentLane.Root'
