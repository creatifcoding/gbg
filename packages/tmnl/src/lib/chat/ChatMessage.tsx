import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool'

interface ChatMessageContextValue {
  readonly role: ChatMessageRole
  readonly streaming: boolean
}

const ChatMessageContext = createContext<ChatMessageContextValue | null>(null)

function useChatMessageContext(componentName: string) {
  const context = useContext(ChatMessageContext)
  if (!context) {
    throw new Error(`${componentName} must be used within ChatMessage.Root`)
  }
  return context
}

export interface ChatMessageRootProps extends ComponentPropsWithoutRef<'article'> {
  role: ChatMessageRole
  streaming?: boolean
  accentColor?: string
  backgroundColor?: string
  animated?: boolean
}

export type ChatMessageMetaProps = ComponentPropsWithoutRef<'header'>

export interface ChatMessageBodyProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export type ChatMessageFooterProps = ComponentPropsWithoutRef<'footer'>

const ROLE_BG: Record<ChatMessageRole, string> = {
  system: 'bg-amber-500/[0.03]',
  user: 'bg-transparent',
  assistant: 'bg-neutral-500/[0.03]',
  tool: 'bg-violet-500/[0.03]',
}

const ChatMessageRoot = forwardRef<HTMLElement, ChatMessageRootProps>(
  (
    {
      role,
      streaming = false,
      accentColor,
      backgroundColor,
      animated = true,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion()
    const contextValue = useMemo<ChatMessageContextValue>(
      () => ({ role, streaming }),
      [role, streaming],
    )

    const motionProps =
      animated && !prefersReducedMotion
        ? {
            initial: { opacity: 0, y: 6 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -4 },
            transition: { duration: 0.16, ease: 'easeOut' },
          }
        : {}

    return (
      <ChatMessageContext.Provider value={contextValue}>
        <motion.article
          ref={ref}
          data-slot="tmnl-chat-message"
          data-role={role}
          data-streaming={streaming || undefined}
          className={cn(
            'relative px-4 py-3',
            'border-b border-neutral-800/30',
            ROLE_BG[role],
            streaming && 'border-l-2 border-l-cyan-500/40',
            className,
          )}
          style={{
            '--chat-msg-accent': accentColor,
            '--chat-msg-bg': backgroundColor,
            ...style,
          } as CSSProperties}
          {...motionProps}
          {...props}
        >
          {children}
        </motion.article>
      </ChatMessageContext.Provider>
    )
  },
)
ChatMessageRoot.displayName = 'ChatMessage.Root'

const ChatMessageMeta = forwardRef<HTMLElement, ChatMessageMetaProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="tmnl-chat-message-meta"
      className={cn('flex items-center gap-2 mb-1', className)}
      {...props}
    />
  ),
)
ChatMessageMeta.displayName = 'ChatMessage.Meta'

const ChatMessageBody = forwardRef<HTMLDivElement, ChatMessageBodyProps>(
  ({ streaming, className, ...props }, ref) => {
    const context = useChatMessageContext('ChatMessage.Body')
    const isStreaming = streaming ?? context.streaming

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-message-body"
        data-streaming={isStreaming || undefined}
        className={cn(
          'font-mono text-neutral-200 leading-relaxed',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        {...props}
      />
    )
  },
)
ChatMessageBody.displayName = 'ChatMessage.Body'

const ChatMessageFooter = forwardRef<HTMLElement, ChatMessageFooterProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="tmnl-chat-message-footer"
      className={cn(
        'flex items-center gap-1 mt-2',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        className,
      )}
      {...props}
    />
  ),
)
ChatMessageFooter.displayName = 'ChatMessage.Footer'

const User = forwardRef<HTMLElement, Omit<ChatMessageRootProps, 'role'>>((props, ref) => (
  <ChatMessageRoot ref={ref} role="user" {...props} />
))
User.displayName = 'ChatMessage.User'

const Assistant = forwardRef<HTMLElement, Omit<ChatMessageRootProps, 'role'>>((props, ref) => (
  <ChatMessageRoot ref={ref} role="assistant" {...props} />
))
Assistant.displayName = 'ChatMessage.Assistant'

const System = forwardRef<HTMLElement, Omit<ChatMessageRootProps, 'role'>>((props, ref) => (
  <ChatMessageRoot ref={ref} role="system" {...props} />
))
System.displayName = 'ChatMessage.System'

interface ChatMessageComponent {
  (props: ChatMessageRootProps): ReactElement
  displayName?: string
  Root: typeof ChatMessageRoot
  Meta: typeof ChatMessageMeta
  Body: typeof ChatMessageBody
  Footer: typeof ChatMessageFooter
  User: typeof User
  Assistant: typeof Assistant
  System: typeof System
}

const ChatMessage = ChatMessageRoot as unknown as ChatMessageComponent
ChatMessage.Root = ChatMessageRoot
ChatMessage.Meta = ChatMessageMeta
ChatMessage.Body = ChatMessageBody
ChatMessage.Footer = ChatMessageFooter
ChatMessage.User = User
ChatMessage.Assistant = Assistant
ChatMessage.System = System

export { ChatMessage }
