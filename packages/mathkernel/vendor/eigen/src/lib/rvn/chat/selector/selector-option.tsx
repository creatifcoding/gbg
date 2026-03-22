import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type AgentSelectorOptionProps = ComponentPropsWithoutRef<'button'>

export const AgentSelectorOption = forwardRef<HTMLButtonElement, AgentSelectorOptionProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="option"
      data-slot="rvn-chat-agent-selector-option"
      className={cn('rvn-chat__agent-selector-option', className)}
      {...props}
    />
  ),
)

AgentSelectorOption.displayName = 'RvnChatAgentSelector.Option'
