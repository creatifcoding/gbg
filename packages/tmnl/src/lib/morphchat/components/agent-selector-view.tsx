/**
 * Agent Selector Mode Renderer
 *
 * Maps spec.agentSelector axis → dropdown, tabs, or hidden.
 * Reads agent roster from adapter atoms.
 *
 * @module morphchat/components/agent-selector-view
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { useMorphChatContext } from './surface-context'
import { activeAgentFamily } from '../atoms/surface-atoms'
import { morphChatRegistry } from '../atoms/registry'

export function AgentSelectorView() {
  const { spec, adapter, surfaceId } = useMorphChatContext()
  const agents = useAtomValue(adapter.agents$)
  const activeId = useAtomValue(activeAgentFamily(surfaceId))

  const setActiveAgent = React.useCallback((id: string) => {
    morphChatRegistry.set(activeAgentFamily(surfaceId), id)
  }, [surfaceId])

  if (spec.agentSelector === 'hidden' || agents.length === 0) return null

  // ── Tabs mode ──
  if (spec.agentSelector === 'tabs') {
    return (
      <div className="flex items-center gap-0.5">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={cn(
              'px-2 py-1 rounded font-mono transition-colors',
              'hover:bg-neutral-800',
              activeId === agent.id
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-neutral-500',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {agent.name}
          </button>
        ))}
      </div>
    )
  }

  // ── Dropdown mode ──
  return (
    <div className="relative">
      <select
        value={activeId ?? agents[0]?.id ?? ''}
        onChange={(e) => setActiveAgent(e.target.value)}
        className={cn(
          'appearance-none bg-transparent border border-neutral-800 rounded',
          'px-2 py-1 pr-6 font-mono text-neutral-400',
          'hover:border-neutral-700 focus:border-cyan-800 focus:outline-none',
        )}
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600">
        ▾
      </div>
    </div>
  )
}

AgentSelectorView.displayName = 'MorphChat.AgentSelectorView'
