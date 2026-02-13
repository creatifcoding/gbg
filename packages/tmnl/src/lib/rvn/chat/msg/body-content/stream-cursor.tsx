import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageStreamCursorProps = ComponentPropsWithoutRef<'span'>

export const RvnChatMessageStreamCursor = forwardRef<HTMLSpanElement, RvnChatMessageStreamCursorProps>(
  ({ className, children = '▌', ...props }, ref) => (
    <span
      ref={ref}
      data-slot="rvn-chat-message-stream-cursor"
      className={cn('rvn-chat__message-stream-cursor', className)}
      {...props}
    >
      {children}
    </span>
  ),
)

RvnChatMessageStreamCursor.displayName = 'RvnChatMessage.BodyContent.StreamCursor'
