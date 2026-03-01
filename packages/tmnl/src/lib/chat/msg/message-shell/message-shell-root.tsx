import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
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

/**
 * Role-directional initial values for mount animation (EPOCH-0005).
 * User messages slide in from the right, assistant/system/tool from below.
 * layout={false} prevents Framer Motion from re-firing on content growth.
 */
const ROLE_INITIAL: Record<ChatMessageRole, { opacity: number; x?: number; y?: number }> = {
  user:      { opacity: 0, x: 12 },
  assistant: { opacity: 0, y: 8 },
  system:    { opacity: 0, y: 8 },
  tool:      { opacity: 0, y: 8 },
}

const ENTRY_TRANSITION = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1] as readonly number[],
}

export const ChatMessageShellRoot = forwardRef<HTMLElement, ChatMessageShellRootProps>(
  ({ role, streaming = false, messageAnchorId, children, className, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    const contextValue = useMemo(
      () => ({ role, streaming, messageAnchorId }),
      [messageAnchorId, role, streaming],
    )

    // Reduced motion: opacity-only fallback
    const initial = prefersReducedMotion
      ? { opacity: 0 }
      : ROLE_INITIAL[role]

    return (
      <ChatMessageShellContext.Provider value={contextValue}>
        <motion.article
          ref={ref as React.Ref<HTMLElement>}
          initial={initial}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={ENTRY_TRANSITION}
          layout={false}
          data-slot="tmnl-chat-message-shell"
          data-role={role}
          data-streaming={streaming || undefined}
          className={cn(
            'relative flex gap-3 overflow-hidden',
            role === 'user' ? 'flex-row-reverse' : 'flex-row',
            ROLE_PADDING[role],
            ROLE_ALIGNMENT[role],
            ROLE_MAX_WIDTH[role],
            role === 'user' ? 'w-fit' : 'w-full',
            'group/message',
            // EPOCH-0005: Border dissolve on stream completion.
            // Always render the 2px border — toggle color from cyan to transparent.
            // transition-[border-color] duration-200 handles the dissolve.
            'transition-[border-color] duration-200',
            role === 'user' ? 'border-r-2' : 'border-l-2',
            streaming
              ? (role === 'user' ? 'border-r-cyan-500/40' : 'border-l-cyan-500/40')
              : 'border-l-transparent border-r-transparent',
            className,
          )}
          {...props}
        >
          {children}
        </motion.article>
      </ChatMessageShellContext.Provider>
    )
  },
)

ChatMessageShellRoot.displayName = 'ChatMessageShell.Root'
