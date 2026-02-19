/**
 * ChatToolBlock.Header — Clickable trigger showing tool name and state badge.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, memo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  WrenchIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
  ShieldAlertIcon,
  ChevronDownIcon,
} from 'lucide-react'
import type { ToolInvocationState } from '@/lib/morphchat/schemas/message-types'
import { useChatToolBlock } from './tool-block-context'

// =============================================================================
// State config
// =============================================================================

const STATE_CONFIG: Record<ToolInvocationState, {
  icon: typeof WrenchIcon
  label: string
  color: string
  iconColor: string
}> = {
  pending:              { icon: CircleIcon,       label: 'Pending',    color: 'text-neutral-500', iconColor: 'text-neutral-500' },
  running:              { icon: ClockIcon,        label: 'Running',    color: 'text-cyan-400',    iconColor: 'text-cyan-400' },
  'approval-required':  { icon: ShieldAlertIcon,  label: 'Approval',   color: 'text-amber-400',   iconColor: 'text-amber-400' },
  approved:             { icon: CheckCircleIcon,  label: 'Approved',   color: 'text-blue-400',    iconColor: 'text-blue-400' },
  completed:            { icon: CheckCircleIcon,  label: 'Completed',  color: 'text-emerald-400', iconColor: 'text-emerald-400' },
  error:                { icon: XCircleIcon,      label: 'Error',      color: 'text-red-400',     iconColor: 'text-red-400' },
  denied:               { icon: XCircleIcon,      label: 'Denied',     color: 'text-orange-400',  iconColor: 'text-orange-400' },
}

// =============================================================================
// Props
// =============================================================================

export interface ChatToolBlockHeaderProps extends ComponentPropsWithoutRef<'button'> {
  /** Override tool name display */
  title?: string
  /** Custom status badge renderer */
  renderBadge?: (state: ToolInvocationState) => ReactNode
}

// =============================================================================
// Component
// =============================================================================

export const ChatToolBlockHeader = memo(forwardRef<HTMLButtonElement, ChatToolBlockHeaderProps>(
  ({ title, renderBadge, className, children, ...props }, ref) => {
    const { toolName, state, isOpen, setIsOpen, hasDetails } = useChatToolBlock()
    const config = STATE_CONFIG[state]
    const StateIcon = config.icon

    return (
      <button
        ref={ref}
        type="button"
        data-slot="tmnl-chat-tool-header"
        onClick={() => hasDetails && setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-3 py-1.5',
          'text-left font-mono transition-colors duration-150',
          hasDetails && 'cursor-pointer hover:bg-neutral-900/50',
          !hasDetails && 'cursor-default',
          className,
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        aria-expanded={hasDetails ? isOpen : undefined}
        disabled={!hasDetails}
        {...props}
      >
        {children ?? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <WrenchIcon className="size-3.5 text-neutral-600 shrink-0" />
              <span className="text-neutral-400 truncate">
                {title ?? toolName}
              </span>
              {/* State badge */}
              {renderBadge ? renderBadge(state) : (
                <span
                  className={cn(
                    'flex items-center gap-1 shrink-0',
                    config.color,
                  )}
                >
                  <StateIcon className={cn(
                    'size-3',
                    state === 'running' && 'animate-pulse',
                  )} />
                  <span className={config.color}>{config.label}</span>
                </span>
              )}
            </div>
            {hasDetails && (
              <ChevronDownIcon
                className={cn(
                  'size-3 text-neutral-600 shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            )}
          </>
        )}
      </button>
    )
  },
))

ChatToolBlockHeader.displayName = 'ChatToolBlock.Header'
