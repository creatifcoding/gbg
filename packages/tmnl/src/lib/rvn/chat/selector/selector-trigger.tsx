import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type AgentSelectorTriggerProps = ComponentPropsWithoutRef<'button'>

export const AgentSelectorTrigger = forwardRef<HTMLButtonElement, AgentSelectorTriggerProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="rvn-chat-agent-selector-trigger"
      className={cn('rvn-chat__agent-selector-trigger', className)}
      {...props}
    />
  ),
)

AgentSelectorTrigger.displayName = 'RvnChatAgentSelector.Trigger'
