import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatMessageFooterActionsRootProps = ComponentPropsWithoutRef<'footer'>

export const ChatMessageFooterActionsRoot = forwardRef<HTMLElement, ChatMessageFooterActionsRootProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="tmnl-chat-message-footer-actions"
      className={cn(
        'flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100',
        'transition-opacity duration-150',
        className,
      )}
      {...props}
    />
  ),
)

ChatMessageFooterActionsRoot.displayName = 'ChatMessage.FooterActions.Root'
