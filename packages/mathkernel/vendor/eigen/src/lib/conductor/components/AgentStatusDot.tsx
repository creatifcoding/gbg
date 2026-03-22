/**
 * AgentStatusDot — Glowing indicator for agent status
 */

import { cn } from '@/lib/utils'
import type { AgentStatus } from '../schemas'

const STATUS_STYLES: Record<AgentStatus, { dot: string; glow: string; label: string }> = {
  spawning: {
    dot: 'bg-amber-500 animate-pulse',
    glow: 'shadow-[0_0_6px_rgba(245,158,11,0.5)]',
    label: 'Spawning',
  },
  idle: {
    dot: 'bg-neutral-400',
    glow: '',
    label: 'Idle',
  },
  working: {
    dot: 'bg-cyan-500 animate-pulse',
    glow: 'shadow-[0_0_8px_rgba(6,182,212,0.6)]',
    label: 'Working',
  },
  waiting: {
    dot: 'bg-violet-500 animate-pulse',
    glow: 'shadow-[0_0_6px_rgba(139,92,246,0.5)]',
    label: 'Waiting',
  },
  complete: {
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_6px_rgba(16,185,129,0.5)]',
    label: 'Complete',
  },
  failed: {
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]',
    label: 'Failed',
  },
  terminated: {
    dot: 'bg-neutral-600',
    glow: '',
    label: 'Terminated',
  },
}

export function AgentStatusDot({
  status,
  showLabel = false,
  className,
}: {
  status: AgentStatus
  showLabel?: boolean
  className?: string
}) {
  const style = STATUS_STYLES[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          style.dot,
          style.glow,
        )}
      />
      {showLabel && (
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono text-neutral-400">
          {style.label}
        </span>
      )}
    </span>
  )
}
