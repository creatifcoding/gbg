/**
 * AgentCard — Individual agent display with status + terminal embed
 *
 * Shows agent identity, role badge, status dot, and output preview.
 * Can expand to show a full terminal view.
 */

import { useMemo, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAtomValue } from '@effect-atom/atom-react'
import { cn } from '@/lib/utils'
import { agentAtom } from '../atoms'
import { AgentStatusDot } from './AgentStatusDot'
import type { AgentRole } from '../schemas'

// =============================================================================
// Role styling
// =============================================================================

const ROLE_COLORS: Record<AgentRole, { bg: string; text: string; border: string }> = {
  scout: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  analyzer: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  planner: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  implementer: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  reviewer: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  conductor: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
}

// =============================================================================
// Component
// =============================================================================

export interface AgentCardProps {
  agentId: string
  className?: string
  onSelect?: (agentId: string) => void
  selected?: boolean
}

export function AgentCard({ agentId, className, onSelect, selected }: AgentCardProps) {
  const atom = useMemo(() => agentAtom(agentId), [agentId])
  const agent = useAtomValue(atom)
  const [expanded, setExpanded] = useState(false)

  if (!agent) {
    return (
      <div className={cn('p-3 rounded-lg bg-neutral-900/50 border border-neutral-800', className)}>
        <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="text-neutral-500 font-mono">
          Agent not found: {agentId}
        </span>
      </div>
    )
  }

  const role = agent.spec.role
  const colors = ROLE_COLORS[role]

  return (
    <motion.div
      layout
      className={cn(
        'rounded-lg border transition-colors cursor-pointer',
        'bg-neutral-900/80 backdrop-blur-sm',
        selected
          ? 'border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          : 'border-neutral-800 hover:border-neutral-700',
        className,
      )}
      onClick={() => onSelect?.(agentId)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <AgentStatusDot status={agent.status} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }} className="font-mono font-medium text-neutral-200">
            {agent.spec.name}
          </span>
          {/* Role badge */}
          <span
            className={cn(
              'px-1.5 py-0.5 rounded border font-mono',
              colors.bg, colors.text, colors.border,
            )}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {role}
          </span>
        </div>

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {expanded ? '▼' : '▸'}
        </button>
      </div>

      {/* Expanded: output preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-neutral-800">
              <div
                className="mt-2 p-2 rounded bg-black/50 font-mono text-neutral-400 max-h-32 overflow-y-auto"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {(agent.output ?? []).length > 0
                  ? agent.output!.slice(-10).map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap">{line}</div>
                    ))
                  : <span className="text-neutral-600">No output yet</span>
                }
              </div>
              {/* Meta */}
              <div className="mt-1.5 flex gap-3 text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <span>session: {agent.sessionId.slice(0, 8)}…</span>
                <span>spawned: {new Date(agent.spawnedAt).toLocaleTimeString()}</span>
                {agent.spec.awareness && <span>awareness: {agent.spec.awareness}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
