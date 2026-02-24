/**
 * ControlActions — Take Over / Yield Back / Mode buttons + utility buttons.
 *
 * Consumes control atoms for reactive state. No useState.
 *
 * @module terminal/header/control-actions
 */

import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import type { ControlMode } from '@/lib/harness/interactive-shell/schemas'
import type { ShellSessionAtoms } from '@/lib/harness/interactive-shell/shell-session-atoms'

// ─────────────────────────────────────────────────────────────────────────────
// Control buttons
// ─────────────────────────────────────────────────────────────────────────────

export interface ControlButtonsProps {
  sessionId: string
  controlMode$: ShellSessionAtoms['controlMode$']
  controller$: ShellSessionAtoms['controller$']
  onTakeControl?: (sessionId: string) => void
  onYieldControl?: (sessionId: string) => void
  onSwitchMode?: (sessionId: string, mode: ControlMode) => void
  className?: string
}

const BUTTON_BASE = 'px-2 py-0.5 rounded border font-mono transition-colors'

export function ControlButtons({
  sessionId,
  controlMode$,
  controller$,
  onTakeControl,
  onYieldControl,
  onSwitchMode,
  className,
}: ControlButtonsProps) {
  const mode = useAtomValue(controlMode$)
  const controller = useAtomValue(controller$)

  const isHumanController = controller === 'human'

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {/* Take / Yield toggle */}
      {isHumanController ? (
        <button
          onClick={() => onYieldControl?.(sessionId)}
          className={cn(
            BUTTON_BASE,
            'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Yield control back to the agent"
        >
          Yield
        </button>
      ) : (
        <button
          onClick={() => onTakeControl?.(sessionId)}
          className={cn(
            BUTTON_BASE,
            'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20',
          )}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Take control of the terminal"
        >
          Take Over
        </button>
      )}

      {/* Mode cycle: agent → supervised → human → agent */}
      <button
        onClick={() => {
          const next: ControlMode =
            mode === 'agent-controlled' ? 'supervised'
              : mode === 'supervised' ? 'human-controlled'
              : 'agent-controlled'
          onSwitchMode?.(sessionId, next)
        }}
        className={cn(
          BUTTON_BASE,
          'bg-neutral-500/10 text-neutral-400 border-neutral-500/30 hover:bg-neutral-500/20',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        title={`Current: ${mode}. Click to cycle.`}
      >
        {mode === 'agent-controlled' ? '🤖'
          : mode === 'supervised' ? '👁'
          : '🧑'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility buttons: fullscreen, detach/background, kill
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalUtilButtonsProps {
  sessionId: string
  alive?: boolean
  onKill?: (sessionId: string) => void
  onBackground?: (sessionId: string) => void
  onFullscreen?: (sessionId: string) => void
  className?: string
}

export function TerminalUtilButtons({
  sessionId,
  alive = true,
  onKill,
  onBackground,
  onFullscreen,
  className,
}: TerminalUtilButtonsProps) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {onFullscreen && (
        <button
          onClick={() => onFullscreen(sessionId)}
          className={cn(BUTTON_BASE, 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:bg-neutral-800')}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Fullscreen"
        >
          ⛶
        </button>
      )}
      {alive && onBackground && (
        <button
          onClick={() => onBackground(sessionId)}
          className={cn(BUTTON_BASE, 'text-neutral-500 border-neutral-700 hover:text-neutral-300 hover:bg-neutral-800')}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Detach to background"
        >
          ⬡
        </button>
      )}
      {alive && onKill && (
        <button
          onClick={() => onKill(sessionId)}
          className="text-neutral-500 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          title="Kill session"
        >
          ✕
        </button>
      )}
    </div>
  )
}
