import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface RvnChatMessageBodyContentRootProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export const RvnChatMessageBodyContentRoot = forwardRef<HTMLDivElement, RvnChatMessageBodyContentRootProps>(
  ({ streaming = false, className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-message-body-content"
      data-streaming={streaming || undefined}
      className={cn('rvn-chat__message-body', 'rvn-chat__message-body-content', className)}
      {...props}
    />
  ),
)

RvnChatMessageBodyContentRoot.displayName = 'RvnChatMessage.BodyContent.Root'
