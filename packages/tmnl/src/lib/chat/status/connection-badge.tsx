import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export type ChatConnectionState = 'online' | 'offline' | 'checking'

export interface ChatConnectionBadgeProps extends ComponentPropsWithoutRef<'span'> {
  state: ChatConnectionState
  latencyMs?: number | null
  onProbe?: () => void | Promise<void>
  probeLabel?: string
  onExpandedChange?: (expanded: boolean) => void
}

const STATE_COLOR: Record<ChatConnectionState, string> = {
  online: 'text-emerald-400',
  offline: 'text-red-400',
  checking: 'text-amber-400',
}

const STATE_DOT: Record<ChatConnectionState, string> = {
  online: 'bg-emerald-400',
  offline: 'bg-red-400',
  checking: 'bg-amber-400 animate-pulse',
}

export const ChatConnectionBadge = forwardRef<HTMLSpanElement, ChatConnectionBadgeProps>(
  ({ state, latencyMs, className, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="tmnl-chat-connection-badge"
      data-state={state}
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md',
        'font-mono border border-neutral-800',
        STATE_COLOR[state],
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', STATE_DOT[state])} />
      <span className="uppercase tracking-wider">{state}</span>
      {latencyMs != null && (
        <span className="text-neutral-500 tabular-nums">{latencyMs}ms</span>
      )}
    </span>
  ),
)

ChatConnectionBadge.displayName = 'ChatConnectionBadge'
