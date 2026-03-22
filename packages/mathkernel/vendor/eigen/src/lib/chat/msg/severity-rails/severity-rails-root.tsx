import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessageRole } from '../msg-role-rail'

export type SeverityRailPlacement = 'left' | 'right'

export interface ChatMessageSeverityRailsRootProps extends ComponentPropsWithoutRef<'div'> {
  role: ChatMessageRole
  severity?: 'info' | 'warn' | 'error'
  /** Which edge the gutter mark sits on. Default: 'left' */
  placement?: SeverityRailPlacement
}

const SEVERITY_BORDER_LEFT: Record<string, string> = {
  info: 'border-l-neutral-700/50',
  warn: 'border-l-amber-500/50',
  error: 'border-l-red-500/50',
}

const SEVERITY_BORDER_RIGHT: Record<string, string> = {
  info: 'border-r-neutral-700/50',
  warn: 'border-r-amber-500/50',
  error: 'border-r-red-500/50',
}

export const ChatMessageSeverityRailsRoot = forwardRef<HTMLDivElement, ChatMessageSeverityRailsRootProps>(
  ({ role, severity = 'info', placement = 'left', className, ...props }, ref) => {
    const isRight = placement === 'right'
    const borderMap = isRight ? SEVERITY_BORDER_RIGHT : SEVERITY_BORDER_LEFT

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-severity-rails"
        data-role={role}
        data-severity={severity}
        data-placement={placement}
        className={cn(
          'flex items-start gap-2',
          isRight ? 'pr-2 border-r-2 flex-row-reverse' : 'pl-2 border-l-2',
          borderMap[severity] ?? borderMap.info,
          className,
        )}
        {...props}
      />
    )
  },
)

ChatMessageSeverityRailsRoot.displayName = 'ChatMessage.SeverityRails.Root'
