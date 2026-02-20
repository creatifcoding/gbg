import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessageRole } from '../msg-role-rail'
import { ChatMessageShellContext } from './message-shell-context'
import { CHAT_TOKENS } from '../../tokens'

export interface ChatMessageShellRootProps extends ComponentPropsWithoutRef<'article'> {
  role: ChatMessageRole
  streaming?: boolean
  messageAnchorId?: string
  children: ReactNode
}

// ── Role-aware layout maps (from CHAT_TOKENS) ──────────────

const ROLE_ALIGNMENT: Record<ChatMessageRole, string> = {
  user:      CHAT_TOKENS.message.user.alignment,
  assistant: CHAT_TOKENS.message.assistant.alignment,
  system:    CHAT_TOKENS.message.system.alignment,
  tool:      CHAT_TOKENS.message.tool.alignment,
}

const ROLE_MAX_WIDTH: Record<ChatMessageRole, string> = {
  user:      CHAT_TOKENS.message.user.maxWidth,
  assistant: CHAT_TOKENS.message.assistant.maxWidth,
  system:    CHAT_TOKENS.message.system.maxWidth,
  tool:      CHAT_TOKENS.message.tool.maxWidth,
}

const ROLE_PADDING: Record<ChatMessageRole, string> = {
  user:      CHAT_TOKENS.message.user.padding,
  assistant: CHAT_TOKENS.message.assistant.padding,
  system:    CHAT_TOKENS.message.system.padding,
  tool:      CHAT_TOKENS.message.tool.padding,
}

export const ChatMessageShellRoot = forwardRef<HTMLElement, ChatMessageShellRootProps>(
  ({ role, streaming = false, messageAnchorId, children, className, ...props }, ref) => {
    const contextValue = useMemo(
      () => ({ role, streaming, messageAnchorId }),
      [messageAnchorId, role, streaming],
    )

    return (
      <ChatMessageShellContext.Provider value={contextValue}>
        <article
          ref={ref}
          data-slot="tmnl-chat-message-shell"
          data-role={role}
          data-streaming={streaming || undefined}
          className={cn(
            'relative flex gap-3',
            role === 'user' ? 'flex-row-reverse' : 'flex-row',
            ROLE_PADDING[role],
            ROLE_ALIGNMENT[role],
            ROLE_MAX_WIDTH[role],
            role === 'user' ? 'w-fit' : 'w-full',
            'group/message',
            'transition-colors duration-150',
            streaming && (role === 'user' ? 'border-r-2 border-r-cyan-500/40' : 'border-l-2 border-l-cyan-500/40'),
            className,
          )}
          {...props}
        >
          {children}
        </article>
      </ChatMessageShellContext.Provider>
    )
  },
)

ChatMessageShellRoot.displayName = 'ChatMessageShell.Root'
