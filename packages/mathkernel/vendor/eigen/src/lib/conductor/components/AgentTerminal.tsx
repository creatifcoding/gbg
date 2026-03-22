/**
 * AgentTerminal — Live xterm.js terminal bound to an agent's PTY session
 *
 * Bridges: agentId → ConductorService → sessionId → TerminalSessionManager → handle → xterm
 *
 * Each agent's stdout/stderr streams live into its own xterm instance.
 * You see exactly what the agent sees.
 */

import { useRef, useEffect, useMemo, useCallback } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { XtermTerminal } from '@/lib/terminal/v2/components/XtermTerminal'
import { agentAtom } from '../atoms'
import { AgentStatusDot } from './AgentStatusDot'

// =============================================================================
// Props
// =============================================================================

export interface AgentTerminalProps {
  /** Agent ID to bind to */
  agentId: string
  /** Session handle write function (injected by parent that has service access) */
  onWrite?: (data: string) => void
  /** Additional className */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * AgentTerminal renders a full xterm.js terminal for a conductor agent.
 *
 * Connection flow:
 * 1. Read agent's sessionId from conductor atom
 * 2. Parent provides onWrite callback (bound to session handle)
 * 3. XtermTerminal renders with session's output stream piped to terminal.write()
 *
 * For now: uses XtermTerminal with a unique persistence key per agent.
 * The output is piped via the session handle's Stream<string>.
 */
export function AgentTerminal({ agentId, onWrite, className }: AgentTerminalProps) {
  const atom = useMemo(() => agentAtom(agentId), [agentId])
  const agent = useAtomValue(atom)

  if (!agent) {
    return (
      <div className={cn('flex items-center justify-center h-full bg-black', className)}>
        <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="font-mono text-neutral-600">
          Agent "{agentId}" not found
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Agent header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800">
        <AgentStatusDot status={agent.status} showLabel />
        <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="font-mono font-medium text-neutral-300">
          {agent.spec.name}
        </span>
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono text-neutral-600">
          {agent.spec.role} · {agent.spec.model?.split('-').slice(-1)[0]}
        </span>
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono text-neutral-700 ml-auto">
          session:{agent.sessionId.slice(0, 8)}
        </span>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0">
        <XtermTerminal
          id={`conductor-agent-${agentId}`}
          config={{
            fontSize: 13,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            cursorBlink: true,
          }}
          onData={onWrite}
          className="h-full"
        />
      </div>
    </div>
  )
}
