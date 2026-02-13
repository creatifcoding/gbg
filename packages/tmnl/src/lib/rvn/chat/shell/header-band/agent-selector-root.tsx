import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useRvnChatHeaderBandContext } from './header-band-context'

export type RvnChatHeaderAgentSelectorProps = ComponentPropsWithoutRef<'div'>

export const RvnChatHeaderAgentSelector = forwardRef<HTMLDivElement, RvnChatHeaderAgentSelectorProps>(
  ({ className, ...props }, ref) => {
    useRvnChatHeaderBandContext('RvnChatShell.Header.AgentSelector')

    return (
      <div
        ref={ref}
        data-slot="rvn-chat-shell-header-agent-selector"
        data-semantic-compound="agent-selector"
        className={cn('rvn-chat__agent-selector', 'rvn-chat-shell__header-agent-selector', className)}
        {...props}
      />
    )
  },
)

RvnChatHeaderAgentSelector.displayName = 'RvnChatShell.Header.AgentSelector'
