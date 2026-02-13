/**
 * ExpandBand — styled show/collapse toggle with task count.
 *
 * Replaces the old ExpandControl button. Provides a richer affordance with
 * chevron rotation, uppercase monospace label, and task count badge.
 * CSS: `.rvn-chat__inline-task-shell-expand-band`.
 */
import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_UTILITY_ICON_SIZE,
} from '../../iconography'
import { useInlineTaskShellContext } from '../inline-task-shell-context'
import { cn } from '@/lib/utils'

export interface ExpandBandProps extends ComponentPropsWithoutRef<'button'> {
  /** Override label. Default: "Tasks" when collapsed, "Tasks" when expanded. */
  label?: string
}

export const ExpandBand = forwardRef<HTMLButtonElement, ExpandBandProps>(
  ({ label, className, onClick, ...props }, ref) => {
    const { expanded, setExpanded, metrics, transfer } = useInlineTaskShellContext()

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        setExpanded(!expanded)
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn('rvn-chat__inline-task-shell-expand-band', className)}
        data-expanded={expanded || undefined}
        aria-expanded={expanded}
        onClick={handleClick}
        draggable={transfer?.clusterDragProps.draggable}
        onDragStart={transfer?.clusterDragProps.onDragStart}
        onDragEnd={transfer?.clusterDragProps.onDragEnd}
        {...props}
      >
        <span>
          {label ?? 'Tasks'}
          <span className="rvn-chat__inline-task-shell-expand-band-count">
            {' '}({metrics.total})
          </span>
        </span>
        <span className="rvn-chat__inline-task-shell-expand-band-chevron" aria-hidden="true">
          <ChevronDown
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
          />
        </span>
      </button>
    )
  },
)

ExpandBand.displayName = 'InlineTaskShell.ExpandBand'
