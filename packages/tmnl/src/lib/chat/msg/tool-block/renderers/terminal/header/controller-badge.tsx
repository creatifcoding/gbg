/**
 * ControllerBadge — Shows who currently holds stdin control.
 *
 * Three visual states:
 *   - agent-controlled: cyan dot + "Agent" label
 *   - human-controlled: amber dot + "You" label
 *   - supervised: split dot + controller label
 *
 * @module terminal/header/controller-badge
 */

import { cn } from '@/lib/utils'
import type { ControlMode, ControllerRole } from '@/lib/harness/interactive-shell/schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ControllerBadgeProps {
  mode: ControlMode
  controller: ControllerRole
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual mapping
// ─────────────────────────────────────────────────────────────────────────────

const MODE_STYLES: Record<ControlMode, { badge: string; dot: string }> = {
  'agent-controlled': {
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  'human-controlled': {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  supervised: {
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    dot: 'bg-violet-400',
  },
}

function getLabel(mode: ControlMode, controller: ControllerRole): string {
  if (mode === 'agent-controlled') return 'Agent'
  if (mode === 'human-controlled') return 'You'
  // supervised: show who currently has it
  return controller === 'human' ? 'You (supervised)' : 'Agent (supervised)'
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ControllerBadge({ mode, controller, className }: ControllerBadgeProps) {
  const styles = MODE_STYLES[mode]
  const label = getLabel(mode, controller)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono',
        styles.badge,
        className,
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      title={`Control mode: ${mode} | Controller: ${controller}`}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          styles.dot,
          controller === 'human' && mode === 'supervised' && 'animate-pulse',
        )}
      />
      {label}
    </span>
  )
}
