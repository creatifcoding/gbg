/**
 * InteractiveTerminalHeader — Composed header bar for interactive terminal.
 *
 * Slots (left → right):
 *   [Status badge] [Controller badge] [Session name] [PID·shell] [Uptime]
 *   ──── flex spacer ────
 *   [Throughput] [Control buttons] [Fullscreen] [Detach] [Kill]
 *
 * All reactive state via useAtomValue on session atom bundle.
 *
 * @module terminal/header/interactive-terminal-header
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import type { ControlMode, ShellSessionStatus } from '@/lib/harness/interactive-shell/schemas'
import type { ShellSessionAtoms } from '@/lib/harness/interactive-shell/shell-session-atoms'
import { ControllerBadge } from './controller-badge'
import { SessionMeta, UptimeTimer, Throughput } from './session-info'
import { ControlButtons, TerminalUtilButtons } from './control-actions'

// ─────────────────────────────────────────────────────────────────────────────
// Status badge (migrated from interactive-terminal.tsx)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ShellSessionStatus, string> = {
  starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  exited: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  killed: 'bg-red-500/20 text-red-400 border-red-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_DOTS: Record<ShellSessionStatus, string> = {
  starting: 'bg-yellow-400 animate-pulse',
  running: 'bg-emerald-400',
  exited: 'bg-neutral-500',
  killed: 'bg-red-400',
  error: 'bg-red-400',
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface InteractiveTerminalHeaderProps {
  sessionId: string
  /** Session atom bundle from shellSessionFamily */
  atoms: ShellSessionAtoms
  /** Callback: send raw input to server */
  onTakeControl?: (sessionId: string) => void
  onYieldControl?: (sessionId: string) => void
  onSwitchMode?: (sessionId: string, mode: ControlMode) => void
  onKill?: (sessionId: string) => void
  onBackground?: (sessionId: string) => void
  onFullscreen?: (sessionId: string) => void
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function InteractiveTerminalHeader({
  sessionId,
  atoms,
  onTakeControl,
  onYieldControl,
  onSwitchMode,
  onKill,
  onBackground,
  onFullscreen,
  className,
}: InteractiveTerminalHeaderProps) {
  const status = useAtomValue(atoms.status$)
  const info = useAtomValue(atoms.info$)
  const exitCode = useAtomValue(atoms.exitCode$)
  const controlMode = useAtomValue(atoms.controlMode$)
  const controller = useAtomValue(atoms.controller$)

  const isAlive = status === 'starting' || status === 'running'
  const statusLabel = status === 'exited' && exitCode != null
    ? `exited (${exitCode})`
    : status

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/50 shrink-0 overflow-x-auto',
        className,
      )}
    >
      {/* ── Left cluster ─────────────────────────────────────────── */}

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-0.5 rounded-full border shrink-0',
        STATUS_COLORS[status],
      )}>
        <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOTS[status])} />
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{statusLabel}</span>
      </div>

      {/* Controller badge */}
      <ControllerBadge mode={controlMode} controller={controller} />

      {/* Session name */}
      <span
        className="text-neutral-500 font-mono truncate max-w-[120px] shrink-0"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title={sessionId}
      >
        {info?.name || sessionId}
      </span>

      {/* PID + shell */}
      <SessionMeta pid={info?.pid ?? undefined} shell={info?.shell} />

      {/* Uptime */}
      <UptimeTimer createdAt$={atoms.createdAt$} alive={isAlive} />

      {/* ── Spacer ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-[8px]" />

      {/* ── Right cluster ────────────────────────────────────────── */}

      {/* Throughput */}
      <Throughput bytesIn$={atoms.bytesIn$} bytesOut$={atoms.bytesOut$} />

      {/* Control buttons */}
      {isAlive && (
        <ControlButtons
          sessionId={sessionId}
          controlMode$={atoms.controlMode$}
          controller$={atoms.controller$}
          onTakeControl={onTakeControl}
          onYieldControl={onYieldControl}
          onSwitchMode={onSwitchMode}
        />
      )}

      {/* Utility: fullscreen, detach, kill */}
      <TerminalUtilButtons
        sessionId={sessionId}
        alive={isAlive}
        onKill={onKill}
        onBackground={onBackground}
        onFullscreen={onFullscreen}
      />
    </div>
  )
}
