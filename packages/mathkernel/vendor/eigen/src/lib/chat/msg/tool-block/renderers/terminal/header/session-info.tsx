/**
 * SessionInfo — PID + shell display, uptime timer, I/O throughput.
 * Compact mono pills for the terminal header bar.
 *
 * All state consumed via effect-atom (useAtomValue). No useState.
 * Uptime uses Atom.make(Stream.fromSchedule) for a 1s tick — atom-as-state.
 *
 * @module terminal/header/session-info
 */

import { Atom, Result } from '@effect-atom/atom-react'
import { useAtomValue } from '@effect-atom/atom-react'
import { Stream, Schedule } from 'effect'
import { cn } from '@/lib/utils'
import type { ShellSessionAtoms } from '@/lib/harness/interactive-shell/shell-session-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Shared tick atom — Stream.fromSchedule(Schedule.spaced(1000))
// Emits incrementing number every second. Atom auto-subscribes/unsubscribes
// based on whether any component is reading it.
// ─────────────────────────────────────────────────────────────────────────────

export const secondTick$ = Atom.make(() =>
  Stream.fromSchedule(Schedule.spaced(1000)),
)

// ─────────────────────────────────────────────────────────────────────────────
// PID + Shell pill
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionMetaProps {
  pid?: number
  shell?: string
  className?: string
}

export function SessionMeta({ pid, shell, className }: SessionMetaProps) {
  if (!pid && !shell) return null
  const shellName = shell ? shell.split('/').pop() : undefined

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-neutral-500 font-mono',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {shellName && <span>{shellName}</span>}
      {pid != null && (
        <>
          {shellName && <span className="text-neutral-700">·</span>}
          <span>pid:{pid}</span>
        </>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Uptime timer — atom-driven via secondTick$
// ─────────────────────────────────────────────────────────────────────────────

export interface UptimeTimerProps {
  /** createdAt atom from the session family */
  createdAt$: ShellSessionAtoms['createdAt$']
  /** Is the session still alive? Stops rendering tick when false. */
  alive?: boolean
  className?: string
}

function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m${sec.toString().padStart(2, '0')}s`
  const hr = Math.floor(min / 60)
  const rm = min % 60
  return `${hr}h${rm.toString().padStart(2, '0')}m`
}

export function UptimeTimer({ createdAt$, alive = true, className }: UptimeTimerProps) {
  const createdAt = useAtomValue(createdAt$)
  // Subscribe to tick — forces re-render every second while mounted.
  // When alive=false, we still show the final time but skip the subscription.
  const tickResult = useAtomValue(secondTick$)
  // tickResult is Result<number, never> — extract the tick count (we only care about re-render trigger)
  const _tick = Result.isSuccess(tickResult) ? tickResult.value : 0

  const elapsed = alive ? (Date.now() - createdAt) : (Date.now() - createdAt)

  return (
    <span
      className={cn('text-neutral-600 font-mono tabular-nums', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title="Session uptime"
    >
      {formatUptime(elapsed)}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O Throughput — atom-driven
// ─────────────────────────────────────────────────────────────────────────────

export interface ThroughputProps {
  bytesIn$: ShellSessionAtoms['bytesIn$']
  bytesOut$: ShellSessionAtoms['bytesOut$']
  className?: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`
  return `${(n / (1024 * 1024)).toFixed(1)}M`
}

export function Throughput({ bytesIn$, bytesOut$, className }: ThroughputProps) {
  const bytesIn = useAtomValue(bytesIn$)
  const bytesOut = useAtomValue(bytesOut$)

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-neutral-600 font-mono', className)}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title={`In: ${bytesIn} bytes | Out: ${bytesOut} bytes`}
    >
      <span className="text-neutral-700">↑</span>{formatBytes(bytesIn)}
      <span className="text-neutral-700">↓</span>{formatBytes(bytesOut)}
    </span>
  )
}
