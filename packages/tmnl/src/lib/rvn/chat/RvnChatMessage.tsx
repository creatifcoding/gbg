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

export type RvnChatMessageRole = 'system' | 'user' | 'assistant' | 'tool'

interface RvnChatMessageContextValue {
  readonly role: RvnChatMessageRole
  readonly streaming: boolean
}

const RvnChatMessageContext = createContext<RvnChatMessageContextValue | null>(null)

function useRvnChatMessageContext(componentName: string) {
  const context = useContext(RvnChatMessageContext)
  if (!context) {
    throw new Error(`${componentName} must be used within RvnChatMessage.Root`)
  }
  return context
}

export interface RvnChatMessageRootProps extends ComponentPropsWithoutRef<'article'> {
  role: RvnChatMessageRole
  streaming?: boolean
  accentColor?: string
  backgroundColor?: string
  animated?: boolean
}

export type RvnChatMessageMetaProps = ComponentPropsWithoutRef<'header'>

export interface RvnChatMessageBodyProps extends ComponentPropsWithoutRef<'div'> {
  streaming?: boolean
}

export type RvnChatMessageFooterProps = ComponentPropsWithoutRef<'footer'>

const RvnChatMessageRoot = forwardRef<HTMLElement, RvnChatMessageRootProps>(
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
    const contextValue = useMemo<RvnChatMessageContextValue>(
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
      <RvnChatMessageContext.Provider value={contextValue}>
        <motion.article
          ref={ref}
          data-slot="rvn-chat-message"
          data-role={role}
          className={cn('rvn-chat__message', `rvn-chat__message--${role}`, className)}
          style={{
            '--cchat-msg-accent': accentColor,
            '--cchat-msg-bg': backgroundColor,
            ...style,
          } as CSSProperties}
          {...motionProps}
          {...props}
        >
          {children}
        </motion.article>
      </RvnChatMessageContext.Provider>
    )
  },
)
RvnChatMessageRoot.displayName = 'RvnChatMessage.Root'

const RvnChatMessageMeta = forwardRef<HTMLElement, RvnChatMessageMetaProps>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      data-slot="rvn-chat-message-meta"
      className={cn('rvn-chat__message-meta', className)}
      {...props}
    />
  ),
)
RvnChatMessageMeta.displayName = 'RvnChatMessage.Meta'

const RvnChatMessageBody = forwardRef<HTMLDivElement, RvnChatMessageBodyProps>(
  ({ streaming, className, ...props }, ref) => {
    const context = useRvnChatMessageContext('RvnChatMessage.Body')
    const isStreaming = streaming ?? context.streaming

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-message-body"
        data-streaming={isStreaming || undefined}
        className={cn('rvn-chat__message-body', className)}
        {...props}
      />
    )
  },
)
RvnChatMessageBody.displayName = 'RvnChatMessage.Body'

const RvnChatMessageFooter = forwardRef<HTMLElement, RvnChatMessageFooterProps>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      data-slot="rvn-chat-message-footer"
      className={cn('rvn-chat__message-footer', className)}
      {...props}
    />
  ),
)
RvnChatMessageFooter.displayName = 'RvnChatMessage.Footer'

const User = forwardRef<HTMLElement, Omit<RvnChatMessageRootProps, 'role'>>((props, ref) => (
  <RvnChatMessageRoot ref={ref} role="user" {...props} />
))
User.displayName = 'RvnChatMessage.User'

const Assistant = forwardRef<HTMLElement, Omit<RvnChatMessageRootProps, 'role'>>((props, ref) => (
  <RvnChatMessageRoot ref={ref} role="assistant" {...props} />
))
Assistant.displayName = 'RvnChatMessage.Assistant'

const System = forwardRef<HTMLElement, Omit<RvnChatMessageRootProps, 'role'>>((props, ref) => (
  <RvnChatMessageRoot ref={ref} role="system" {...props} />
))
System.displayName = 'RvnChatMessage.System'

interface RvnChatMessageComponent {
  (props: RvnChatMessageRootProps): ReactElement
  displayName?: string
  Root: typeof RvnChatMessageRoot
  Meta: typeof RvnChatMessageMeta
  Body: typeof RvnChatMessageBody
  Footer: typeof RvnChatMessageFooter
  User: typeof User
  Assistant: typeof Assistant
  System: typeof System
}

const RvnChatMessage = RvnChatMessageRoot as RvnChatMessageComponent
RvnChatMessage.Root = RvnChatMessageRoot
RvnChatMessage.Meta = RvnChatMessageMeta
RvnChatMessage.Body = RvnChatMessageBody
RvnChatMessage.Footer = RvnChatMessageFooter
RvnChatMessage.User = User
RvnChatMessage.Assistant = Assistant
RvnChatMessage.System = System

export { RvnChatMessage }
