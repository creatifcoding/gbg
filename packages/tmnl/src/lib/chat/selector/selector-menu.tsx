import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type AgentSelectorMenuProps = ComponentPropsWithoutRef<'div'>

export const AgentSelectorMenu = forwardRef<HTMLDivElement, AgentSelectorMenuProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="listbox"
      data-slot="tmnl-chat-agent-selector-menu"
      className={cn(
        'flex flex-col py-1 rounded-lg',
        'border border-neutral-800 bg-neutral-900/95 backdrop-blur-lg',
        'shadow-lg',
        className,
      )}
      {...props}
    />
  ),
)

AgentSelectorMenu.displayName = 'ChatAgentSelector.Menu'
