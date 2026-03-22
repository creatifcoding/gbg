import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type AgentSelectorMenuProps = ComponentPropsWithoutRef<'div'>

export const AgentSelectorMenu = forwardRef<HTMLDivElement, AgentSelectorMenuProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="listbox"
      data-slot="rvn-chat-agent-selector-menu"
      className={cn('rvn-chat__agent-selector-menu', className)}
      {...props}
    />
  ),
)

AgentSelectorMenu.displayName = 'RvnChatAgentSelector.Menu'
