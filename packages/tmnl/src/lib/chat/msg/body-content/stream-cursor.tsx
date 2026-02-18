import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageStreamCursorProps = ComponentPropsWithoutRef<'span'>

export const ChatMessageStreamCursor = forwardRef<HTMLSpanElement, ChatMessageStreamCursorProps>(
  ({ className, children = '▌', ...props }, ref) => (
    <span
      ref={ref}
      data-slot="tmnl-chat-message-stream-cursor"
      className={cn(
        'inline-block text-cyan-400 animate-pulse',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
)

ChatMessageStreamCursor.displayName = 'ChatMessage.BodyContent.StreamCursor'
