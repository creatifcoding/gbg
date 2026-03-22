/**
 * SessionPicker — Dropdown for selecting between active shell sessions.
 * Shows when multiple sessions exist. Atom-driven.
 *
 * @module terminal/header/session-picker
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import {
  activeSessionIds$,
  shellSessionFamily,
} from '@/lib/harness/interactive-shell/shell-session-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionPickerProps {
  currentSessionId: string
  onSelect: (sessionId: string) => void
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SessionPicker({ currentSessionId, onSelect, className }: SessionPickerProps) {
  const sessionIds = useAtomValue(activeSessionIds$)

  // Don't render if only one session
  if (sessionIds.length <= 1) return null

  return (
    <select
      value={currentSessionId}
      onChange={(e) => onSelect(e.target.value)}
      className={cn(
        'bg-neutral-900 text-neutral-400 border border-neutral-700 rounded px-1.5 py-0.5 font-mono',
        'focus:outline-none focus:border-cyan-500/50',
        'appearance-none cursor-pointer',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title="Switch shell session"
    >
      {sessionIds.map((id) => (
        <SessionOption key={id} sessionId={id} />
      ))}
    </select>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Option — reads per-session atoms for label
// ─────────────────────────────────────────────────────────────────────────────

function SessionOption({ sessionId }: { sessionId: string }) {
  const atoms = shellSessionFamily(sessionId)
  const info = useAtomValue(atoms.info$)
  const status = useAtomValue(atoms.status$)

  const label = info?.name || sessionId.slice(0, 16)
  const statusChar = status === 'running' ? '●' : status === 'exited' ? '○' : '◌'

  return (
    <option value={sessionId}>
      {statusChar} {label}
    </option>
  )
}
