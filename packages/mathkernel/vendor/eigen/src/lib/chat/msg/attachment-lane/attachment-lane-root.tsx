import { forwardRef, useMemo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { ChatMessageAttachmentLaneContext, normalizeMessageAnchorId } from './attachment-lane-context'

export interface ChatMessageAttachmentLaneRootProps extends ComponentPropsWithoutRef<'section'> {
  messageAnchorId: string
}

export const ChatMessageAttachmentLaneRoot = forwardRef<
  HTMLElement,
  ChatMessageAttachmentLaneRootProps
>(({ messageAnchorId, className, children, ...props }, ref) => {
  const normalizedId = useMemo(
    () => normalizeMessageAnchorId(messageAnchorId),
    [messageAnchorId],
  )

  return (
    <ChatMessageAttachmentLaneContext.Provider value={{ messageAnchorId: normalizedId }}>
      <section
        ref={ref}
        data-slot="tmnl-chat-message-attachment-lane"
        data-message-anchor-id={normalizedId}
        className={cn(
          'mt-2 pt-2 border-t border-neutral-800/30',
          'flex flex-col gap-2',
          className,
        )}
        {...props}
      >
        {children}
      </section>
    </ChatMessageAttachmentLaneContext.Provider>
  )
})

ChatMessageAttachmentLaneRoot.displayName = 'ChatMessage.AttachmentLane.Root'
