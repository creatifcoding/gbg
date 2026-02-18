import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessageRole } from '../msg-role-rail'

export interface ChatMessageSeverityRailsRootProps extends ComponentPropsWithoutRef<'div'> {
  role: ChatMessageRole
  severity?: 'info' | 'warn' | 'error'
}

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-neutral-700/50',
  warn: 'border-l-amber-500/50',
  error: 'border-l-red-500/50',
}

export const ChatMessageSeverityRailsRoot = forwardRef<HTMLDivElement, ChatMessageSeverityRailsRootProps>(
  ({ role, severity = 'info', className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-severity-rails"
      data-role={role}
      data-severity={severity}
      className={cn(
        'flex items-start gap-2 pl-2 border-l-2',
        SEVERITY_BORDER[severity] ?? SEVERITY_BORDER.info,
        className,
      )}
      {...props}
    />
  ),
)

ChatMessageSeverityRailsRoot.displayName = 'ChatMessage.SeverityRails.Root'
