import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type AgentSelectorOptionProps = ComponentPropsWithoutRef<'button'>

export const AgentSelectorOption = forwardRef<HTMLButtonElement, AgentSelectorOptionProps>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="option"
      data-slot="tmnl-chat-agent-selector-option"
      className={cn(
        'w-full text-left px-3 py-1.5 font-mono text-neutral-400',
        'hover:bg-neutral-800/50 hover:text-neutral-200',
        'transition-colors duration-100',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    />
  ),
)

AgentSelectorOption.displayName = 'ChatAgentSelector.Option'
