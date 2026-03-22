import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatHeaderBandContext } from './header-band-context'

export type ChatHeaderAgentSelectorProps = ComponentPropsWithoutRef<'div'>

export const ChatHeaderAgentSelector = forwardRef<HTMLDivElement, ChatHeaderAgentSelectorProps>(
  ({ className, ...props }, ref) => {
    useChatHeaderBandContext('ChatShell.Header.AgentSelector')

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-shell-header-agent-selector"
        data-semantic-compound="agent-selector"
        className={cn('flex items-center gap-2', className)}
        {...props}
      />
    )
  },
)

ChatHeaderAgentSelector.displayName = 'ChatShell.Header.AgentSelector'
