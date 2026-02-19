/**
 * ChatToolBlock — Displays tool invocation with state
 *
 * Phase A: Minimal functional renderer showing tool name, state badge,
 * and collapsible input/output.
 * Phase B (task #1536): Full compound with Header, Input, Output, Approval
 * sub-components, animated state transitions, and copy buttons.
 *
 * @module chat/msg/tool-block
 */

import { forwardRef, useState, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import {
  WrenchIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
} from 'lucide-react'
import type { ToolInvocationState } from '@/lib/morphchat/schemas/message-types'

export interface ChatToolBlockProps extends ComponentPropsWithoutRef<'div'> {
  /** Unique tool call ID */
  toolCallId: string
  /** Tool name */
  toolName: string
  /** Current lifecycle state */
  state: ToolInvocationState
  /** Input parameters (JSON) */
  input?: unknown
  /** Output result (JSON) */
  output?: unknown
  /** Error message */
  errorText?: string
}

const STATE_CONFIG: Record<ToolInvocationState, {
  icon: typeof WrenchIcon
  label: string
  color: string
}> = {
  pending: { icon: CircleIcon, label: 'Pending', color: 'text-neutral-400' },
  running: { icon: ClockIcon, label: 'Running', color: 'text-cyan-400' },
  'approval-required': { icon: ClockIcon, label: 'Awaiting Approval', color: 'text-amber-400' },
  approved: { icon: CheckCircleIcon, label: 'Approved', color: 'text-blue-400' },
  completed: { icon: CheckCircleIcon, label: 'Completed', color: 'text-emerald-400' },
  error: { icon: XCircleIcon, label: 'Error', color: 'text-red-400' },
  denied: { icon: XCircleIcon, label: 'Denied', color: 'text-orange-400' },
}

export const ChatToolBlock = forwardRef<HTMLDivElement, ChatToolBlockProps>(
  ({ toolCallId, toolName, state, input, output, errorText, className, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const config = STATE_CONFIG[state]
    const StateIcon = config.icon
    const hasDetails = input != null || output != null || errorText != null

    return (
      <div
        ref={ref}
        data-slot="tmnl-chat-tool-block"
        data-state={state}
        className={cn(
          'rounded border my-1',
          'border-neutral-800 bg-neutral-950/50',
          className,
        )}
        {...props}
      >
        {/* Header — clickable to toggle details */}
        <button
          type="button"
          onClick={() => hasDetails && setExpanded((v) => !v)}
          className={cn(
            'flex w-full items-center justify-between gap-2 px-3 py-2',
            'text-left',
            hasDetails && 'cursor-pointer hover:bg-neutral-900/50',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <WrenchIcon className="size-3.5 text-neutral-500 shrink-0" />
            <span
              className="font-mono text-neutral-300 truncate"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {toolName}
            </span>
            {/* State badge */}
            <span
              className={cn(
                'flex items-center gap-1 font-mono shrink-0',
                config.color,
              )}
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <StateIcon className={cn('size-3', state === 'running' && 'animate-pulse')} />
              {config.label}
            </span>
          </div>
          {hasDetails && (
            <ChevronDownIcon
              className={cn(
                'size-3.5 text-neutral-600 transition-transform shrink-0',
                expanded && 'rotate-180',
              )}
            />
          )}
        </button>

        {/* Details — expandable */}
        {expanded && hasDetails && (
          <div className="border-t border-neutral-800 px-3 py-2 space-y-2">
            {input != null && (
              <div>
                <span
                  className="text-neutral-600 font-mono uppercase tracking-wide block mb-1"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Parameters
                </span>
                <pre
                  className="bg-neutral-900/50 rounded p-2 text-neutral-400 overflow-x-auto"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {JSON.stringify(input, null, 2)}
                </pre>
              </div>
            )}
            {output != null && (
              <div>
                <span
                  className="text-neutral-600 font-mono uppercase tracking-wide block mb-1"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Result
                </span>
                <pre
                  className="bg-neutral-900/50 rounded p-2 text-neutral-400 overflow-x-auto"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
            )}
            {errorText != null && (
              <div>
                <span
                  className="text-red-500 font-mono uppercase tracking-wide block mb-1"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Error
                </span>
                <pre
                  className="bg-red-500/5 border border-red-500/20 rounded p-2 text-red-400 overflow-x-auto"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {errorText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
)

ChatToolBlock.displayName = 'ChatMessage.ToolBlock'
