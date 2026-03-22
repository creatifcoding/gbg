import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInlineTaskShellContext } from '../inline-task-shell-context'

export interface ExpandBandProps extends ComponentPropsWithoutRef<'button'> {
  label?: string
}

export const ExpandBand = forwardRef<HTMLButtonElement, ExpandBandProps>(
  ({ label, className, ...props }, ref) => {
    const { expanded, setExpanded, metrics, threadId } = useInlineTaskShellContext()

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-inline-task-shell-expand-band"
        data-thread-id={threadId}
        data-expanded={expanded || undefined}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2',
          'font-mono text-neutral-400 hover:text-neutral-200',
          'transition-colors duration-100',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        {...props}
      >
        {expanded
          ? <ChevronDown size={14} strokeWidth={2} />
          : <ChevronRight size={14} strokeWidth={2} />}
        <span className="uppercase tracking-wider">
          {label ?? `Tasks (${metrics.total})`}
        </span>
        {metrics.running > 0 && (
          <span className="text-cyan-400 ml-auto">{metrics.running} running</span>
        )}
      </button>
    )
  },
)

ExpandBand.displayName = 'InlineTaskShell.ExpandBand'
