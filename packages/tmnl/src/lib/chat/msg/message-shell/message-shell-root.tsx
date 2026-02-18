import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ChatMessageRole } from '../msg-role-rail'
import { ChatMessageShellContext } from './message-shell-context'

export interface ChatMessageShellRootProps extends ComponentPropsWithoutRef<'article'> {
  role: ChatMessageRole
  streaming?: boolean
  messageAnchorId?: string
  children: ReactNode
}

const ROLE_BG: Record<ChatMessageRole, string> = {
  system: 'bg-amber-500/[0.03]',
  user: 'bg-transparent',
  assistant: 'bg-neutral-500/[0.03]',
  tool: 'bg-violet-500/[0.03]',
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
            'relative flex gap-3 px-4 py-3',
            'border-b border-neutral-800/30',
            'transition-colors duration-150',
            ROLE_BG[role],
            streaming && 'border-l-2 border-l-cyan-500/40',
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
