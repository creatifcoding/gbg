/**
 * ChatShell.Header.ConnectionBadge
 *
 * Wraps a ConnectionBadge (from status/) with header-band context awareness
 * and lazy detail resolution. The actual badge rendering defers to the
 * status/connection-badge component once it's ported.
 *
 * For now: renders a minimal inline badge. Will upgrade when status/ is ported.
 */

import { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'
import { useChatHeaderBandContext } from './header-band-context'

export type ChatConnectionState = 'online' | 'offline' | 'checking'

export interface ChatHeaderConnectionBadgeDetails {
  readonly latencyMs?: number | null
  readonly onProbe?: () => void | Promise<void>
  readonly probeLabel?: string
}

export interface ChatHeaderConnectionBadgeProps extends ComponentPropsWithoutRef<'span'> {
  state: ChatConnectionState
  latencyMs?: number | null
  onProbe?: () => void | Promise<void>
  probeLabel?: string
  resolveExpandedDetails?:
    | (() => ChatHeaderConnectionBadgeDetails | null)
    | (() => Promise<ChatHeaderConnectionBadgeDetails | null>)
  onExpandedChange?: (expanded: boolean) => void
}

export function ChatHeaderConnectionBadge({
  state,
  latencyMs = null,
  onProbe,
  probeLabel,
  resolveExpandedDetails,
  onExpandedChange,
  className,
  ...props
}: ChatHeaderConnectionBadgeProps) {
  useChatHeaderBandContext('ChatShell.Header.ConnectionBadge')

  const [expanded, setExpanded] = useState(false)
  const [resolvedDetails, setResolvedDetails] =
    useState<ChatHeaderConnectionBadgeDetails | null>(null)

  useEffect(() => {
    if (!expanded || !resolveExpandedDetails) {
      setResolvedDetails(null)
      return
    }

    let active = true
    const run = async () => {
      const details = await resolveExpandedDetails()
      if (!active) return
      setResolvedDetails(details)
    }
    void run()
    return () => { active = false }
  }, [expanded, resolveExpandedDetails])

  const computedLatencyMs = useMemo(
    () => (expanded ? resolvedDetails?.latencyMs ?? latencyMs : latencyMs),
    [expanded, latencyMs, resolvedDetails],
  )

  const stateColor =
    state === 'online'
      ? 'text-emerald-400'
      : state === 'offline'
        ? 'text-red-400'
        : 'text-amber-400'

  const dotColor =
    state === 'online'
      ? 'bg-emerald-400'
      : state === 'offline'
        ? 'bg-red-400'
        : 'bg-amber-400'

  return (
    <span
      data-slot="tmnl-chat-shell-header-connection-badge"
      data-semantic-compound="connection-badge"
      role="status"
      onClick={() => {
        const next = !expanded
        setExpanded(next)
        onExpandedChange?.(next)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer',
        'font-mono transition-colors duration-150',
        'border border-neutral-800 hover:border-neutral-600',
        stateColor,
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      {...props}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
      <span className="uppercase tracking-wider">{state}</span>
      {computedLatencyMs != null && (
        <span className="text-neutral-500">{computedLatencyMs}ms</span>
      )}
    </span>
  )
}

ChatHeaderConnectionBadge.displayName = 'ChatShell.Header.ConnectionBadge'
