import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type RvnChatMessageFooterActionsRootProps = ComponentPropsWithoutRef<'footer'>

export const RvnChatMessageFooterActionsRoot = forwardRef<HTMLElement, RvnChatMessageFooterActionsRootProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="rvn-chat-message-footer-actions"
      className={cn('rvn-chat__message-footer', 'rvn-chat__message-footer-actions', className)}
      {...props}
    />
  ),
)

RvnChatMessageFooterActionsRoot.displayName = 'RvnChatMessage.FooterActions.Root'
