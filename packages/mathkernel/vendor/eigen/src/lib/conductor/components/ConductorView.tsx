/**
 * ConductorView — Fully wired conductor with live agent terminals
 *
 * This is the "just mount it" component. Wires:
 * - ConductorPanel layout
 * - AgentTerminal per agent (live xterm.js output)
 * - WorkflowProgress
 * - Agent sidebar with cards
 *
 * Usage:
 * ```tsx
 * import { ConductorView } from '@/lib/conductor'
 *
 * function App() {
 *   return <ConductorView className="h-screen" />
 * }
 * ```
 */

import { useCallback } from 'react'
import { ConductorPanel } from './ConductorPanel'
import { AgentTerminal } from './AgentTerminal'

export interface ConductorViewProps {
  className?: string
}

export function ConductorView({ className }: ConductorViewProps) {
  const renderTerminal = useCallback((agentId: string | null) => {
    if (!agentId) {
      return (
        <div className="flex items-center justify-center h-full bg-black">
          <span
            style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
            className="font-mono text-neutral-700"
          >
            Select an agent to view its terminal
          </span>
        </div>
      )
    }

    return (
      <AgentTerminal
        agentId={agentId}
        className="h-full"
      />
    )
  }, [])

  return (
    <ConductorPanel
      renderTerminal={renderTerminal}
      className={className}
    />
  )
}
