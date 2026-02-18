import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

/** Standard LLM message roles */
export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool'

const ROLE_RAIL_COLORS: Record<ChatMessageRole, string> = {
  system: 'bg-amber-400/60',
  user: 'bg-cyan-400/60',
  assistant: 'bg-emerald-400/60',
  tool: 'bg-violet-400/60',
}

export interface ChatMessageRoleRailProps extends ComponentPropsWithoutRef<'div'> {
  role: ChatMessageRole
}

export const ChatMessageRoleRail = forwardRef<HTMLDivElement, ChatMessageRoleRailProps>(
  ({ role, className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="tmnl-chat-message-role-rail"
      data-role={role}
      className={cn(
        'w-0.5 self-stretch rounded-full shrink-0',
        ROLE_RAIL_COLORS[role],
        className,
      )}
      {...props}
    />
  ),
)

ChatMessageRoleRail.displayName = 'ChatMessage.RoleRail'
