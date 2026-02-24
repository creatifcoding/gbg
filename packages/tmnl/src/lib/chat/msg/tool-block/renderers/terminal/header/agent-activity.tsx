/**
 * Agent Activity Visualization — typing indicator, input attribution,
 * collapsible activity log, and transient toast notifications.
 *
 * All state via useAtomValue on ShellSessionAtoms. No useState for domain state.
 *
 * @module terminal/header/agent-activity
 */

import { useState, useRef, useEffect } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import type { ActivityEntry } from '@/lib/harness/interactive-shell/schemas'
import type { ShellSessionAtoms } from '@/lib/harness/interactive-shell/shell-session-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Agent Typing Indicator (#2538)
// Pulses when agentWriting$ is true. Disappears when false.
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentTypingProps {
  agentWriting$: ShellSessionAtoms['agentWriting$']
  className?: string
}

export function AgentTypingIndicator({ agentWriting$, className }: AgentTypingProps) {
  const writing = useAtomValue(agentWriting$)
  if (!writing) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
        'animate-pulse',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <span className="w-1 h-1 rounded-full bg-cyan-400" />
      <span className="font-mono">agent typing…</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Attribution Marker (#2539)
// Shows who sent the last input: agent (cyan) or human (amber).
// ─────────────────────────────────────────────────────────────────────────────

export interface InputAttributionProps {
  activityLog$: ShellSessionAtoms['activityLog$']
  className?: string
}

export function InputAttribution({ activityLog$, className }: InputAttributionProps) {
  const log = useAtomValue(activityLog$)
  // Find last write event
  const lastWrite = [...log].reverse().find(
    (e) => e.type === 'agent-write' || e.type === 'human-keystroke',
  )
  if (!lastWrite) return null

  const isAgent = lastWrite.source === 'agent'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono',
        isAgent ? 'text-cyan-500/60' : 'text-amber-500/60',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title={`Last input by ${lastWrite.source} at ${new Date(lastWrite.timestamp).toLocaleTimeString()}`}
    >
      {isAgent ? '🤖' : '🧑'}
      <span className="text-neutral-600">last input</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Activity Log Panel (#2540)
// Shows chronological list of control events + I/O events.
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityLogPanelProps {
  activityLog$: ShellSessionAtoms['activityLog$']
  /** Max visible entries (default: 50) */
  maxVisible?: number
  className?: string
}

const ENTRY_ICONS: Record<string, string> = {
  'agent-write': '🤖→',
  'human-keystroke': '🧑→',
  'mode-switch': '⚙',
  'take-control': '🔀',
  'yield-control': '↩',
}

const ENTRY_COLORS: Record<string, string> = {
  'agent-write': 'text-cyan-500/70',
  'human-keystroke': 'text-amber-500/70',
  'mode-switch': 'text-violet-500/70',
  'take-control': 'text-amber-400/70',
  'yield-control': 'text-cyan-400/70',
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function entryDescription(entry: ActivityEntry): string {
  switch (entry.type) {
    case 'agent-write': return entry.detail ?? 'wrote to stdin'
    case 'human-keystroke': return entry.detail ?? 'typed'
    case 'mode-switch': return `→ ${entry.detail ?? 'mode changed'}`
    case 'take-control': return `${entry.source} took control`
    case 'yield-control': return `${entry.source} yielded control`
    default: return entry.detail ?? entry.type
  }
}

export function ActivityLogPanel({ activityLog$, maxVisible = 50, className }: ActivityLogPanelProps) {
  // UI-only toggle — acceptable useState (pure UI state, not domain)
  const [expanded, setExpanded] = useState(false)
  const log = useAtomValue(activityLog$)
  const scrollRef = useRef<HTMLDivElement>(null)

  const visible = log.slice(-maxVisible)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [expanded, visible.length])

  return (
    <div className={cn('border-t border-neutral-800', className)}>
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-1 text-neutral-500 hover:text-neutral-300 transition-colors"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        <span className="font-mono">{expanded ? '▾' : '▸'} Activity</span>
        <span className="text-neutral-700">({log.length})</span>
      </button>

      {/* Log entries */}
      {expanded && (
        <div
          ref={scrollRef}
          className="max-h-[200px] overflow-y-auto px-3 pb-2 space-y-0.5"
        >
          {visible.length === 0 && (
            <div className="text-neutral-700 font-mono py-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              No activity yet
            </div>
          )}
          {visible.map((entry, i) => (
            <div
              key={`${entry.timestamp}-${i}`}
              className="flex items-center gap-2 font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              <span className="text-neutral-700 tabular-nums shrink-0">
                {formatTime(entry.timestamp)}
              </span>
              <span className="shrink-0">{ENTRY_ICONS[entry.type] ?? '·'}</span>
              <span className={cn('truncate', ENTRY_COLORS[entry.type] ?? 'text-neutral-500')}>
                {entryDescription(entry)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Transient Toast Notifications (#2541)
// Shows a brief notification when control changes occur.
// Uses activityLog$ — renders last entry if recent enough (< 3s).
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlToastProps {
  activityLog$: ShellSessionAtoms['activityLog$']
  /** How long to show toast (ms, default: 3000) */
  duration?: number
  className?: string
}

export function ControlToast({ activityLog$, duration = 3000, className }: ControlToastProps) {
  const log = useAtomValue(activityLog$)

  // Find most recent control event
  const last = [...log].reverse().find(
    (e) => e.type === 'take-control' || e.type === 'yield-control' || e.type === 'mode-switch',
  )

  if (!last) return null

  const age = Date.now() - last.timestamp
  if (age > duration) return null

  const isHumanTakeover = last.type === 'take-control' && last.source === 'human'
  const isYield = last.type === 'yield-control'

  return (
    <div
      className={cn(
        'absolute top-10 left-1/2 -translate-x-1/2 z-50',
        'px-3 py-1.5 rounded-lg border font-mono shadow-lg',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        isHumanTakeover
          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
          : isYield
          ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
          : 'bg-violet-500/15 text-violet-400 border-violet-500/30',
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
    >
      {entryDescription(last)}
    </div>
  )
}
