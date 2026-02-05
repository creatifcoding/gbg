/**
 * AgentTabBar — Tab strip for switching between active agents
 *
 * Dynamic Island aesthetic: spring indicator, role-colored accents.
 */

import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { agentListAtom } from '../atoms'
import { AgentStatusDot } from './AgentStatusDot'
import type { AgentInstance, AgentRole } from '../schemas'

const ROLE_ACCENT: Record<AgentRole, string> = {
  scout: 'border-b-amber-500',
  analyzer: 'border-b-blue-500',
  planner: 'border-b-violet-500',
  implementer: 'border-b-emerald-500',
  reviewer: 'border-b-rose-500',
  conductor: 'border-b-cyan-500',
}

export interface AgentTabBarProps {
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
  className?: string
}

export function AgentTabBar({ activeAgentId, onSelectAgent, className }: AgentTabBarProps) {
  const agents = useAtomValue(agentListAtom)

  if (agents.length === 0) {
    return (
      <div className={cn('flex items-center px-3 py-2 border-b border-neutral-800', className)}>
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }} className="font-mono text-neutral-600">
          No agents spawned
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-0.5 px-1 py-1 border-b border-neutral-800 overflow-x-auto', className)}>
      {agents.map((agent) => {
        const isActive = agent.spec.id === activeAgentId
        const accent = ROLE_ACCENT[agent.spec.role]

        return (
          <button
            key={agent.spec.id}
            onClick={() => onSelectAgent(agent.spec.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-t transition-all',
              'font-mono border-b-2',
              isActive
                ? cn('bg-neutral-800/80 text-neutral-200', accent)
                : 'bg-transparent text-neutral-500 border-b-transparent hover:text-neutral-400 hover:bg-neutral-800/40',
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <AgentStatusDot status={agent.status} />
            <span>{agent.spec.name}</span>
          </button>
        )
      })}
    </div>
  )
}
