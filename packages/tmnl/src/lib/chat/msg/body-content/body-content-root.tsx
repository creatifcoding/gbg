import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export interface ChatMessageBodyContentRootProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export const ChatMessageBodyContentRoot = forwardRef<HTMLDivElement, ChatMessageBodyContentRootProps>(
  ({ streaming = false, className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-body-content"
      data-streaming={streaming || undefined}
      className={cn(
        'flex-1 min-w-0 font-mono text-neutral-200 leading-relaxed',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      {...props}
    />
  ),
)

ChatMessageBodyContentRoot.displayName = 'ChatMessage.BodyContent.Root'
