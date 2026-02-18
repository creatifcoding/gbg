import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AgentSelectorTriggerProps = ComponentPropsWithoutRef<'button'>

export const AgentSelectorTrigger = forwardRef<HTMLButtonElement, AgentSelectorTriggerProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      data-slot="tmnl-chat-agent-selector-trigger"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
        'font-mono text-neutral-400 hover:text-neutral-200',
        'border border-neutral-800 hover:border-neutral-600',
        'transition-colors duration-100',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      {children}
      <ChevronDown size={12} />
    </button>
  ),
)

AgentSelectorTrigger.displayName = 'ChatAgentSelector.Trigger'
