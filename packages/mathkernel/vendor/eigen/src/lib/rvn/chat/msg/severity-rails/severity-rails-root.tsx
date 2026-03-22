import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import type { RvnChatMessageRole } from '../../RvnChatMessage'

export interface RvnChatMessageSeverityRailsRootProps extends ComponentPropsWithoutRef<'div'> {
  role: RvnChatMessageRole
  severity?: 'info' | 'warn' | 'error'
}

export const RvnChatMessageSeverityRailsRoot = forwardRef<HTMLDivElement, RvnChatMessageSeverityRailsRootProps>(
  ({ role, severity = 'info', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="rvn-chat-message-severity-rails"
      data-role={role}
      data-severity={severity}
      className={cn('rvn-chat__message-severity-rails', className)}
      {...props}
    />
  ),
)

RvnChatMessageSeverityRailsRoot.displayName = 'RvnChatMessage.SeverityRails.Root'
