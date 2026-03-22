/**
 * ConductorPanel — Main orchestration view
 *
 * Composes: AgentTabBar + AgentCard + WorkflowProgress + terminal embed slot.
 * This is the top-level component for the conductor UI.
 *
 * Layout:
 * ┌─────────────────────────────────────────┐
 * │ WorkflowProgress                        │
 * ├──────────┬──────────────────────────────┤
 * │ Agent    │ Terminal / Output             │
 * │ Sidebar  │ (embed slot for xterm or     │
 * │          │  questionnaire)               │
 * │ AgentCard│                               │
 * │ AgentCard│                               │
 * │ AgentCard│                               │
 * ├──────────┴──────────────────────────────┤
 * │ AgentTabBar                              │
 * └─────────────────────────────────────────┘
 */

import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAtomValue } from '@effect-atom/atom-react'
import { agentListAtom, workflowStatusAtom } from '../atoms'
import { ConductorRegistryProvider } from '../atoms/registry'
import { AgentTabBar } from './AgentTabBar'
import { AgentCard } from './AgentCard'
import { WorkflowProgress } from './WorkflowProgress'

// =============================================================================
// Props
// =============================================================================

export interface ConductorPanelProps {
  /** Render prop for the terminal area — receives active agent ID */
  renderTerminal?: (agentId: string | null) => ReactNode
  /** Render prop for questionnaire — receives step spec */
  renderQuestionnaire?: (spec: unknown) => ReactNode
  /** Additional className */
  className?: string
}

// =============================================================================
// Component (inner, expects registry context)
// =============================================================================

function ConductorPanelInner({ renderTerminal, renderQuestionnaire, className }: ConductorPanelProps) {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const agents = useAtomValue(agentListAtom)
  const workflowStatus = useAtomValue(workflowStatusAtom)

  // Auto-select first agent if none selected
  if (!activeAgentId && agents.length > 0) {
    setActiveAgentId(agents[0].spec.id)
  }

  return (
    <div className={cn('flex flex-col h-full bg-neutral-950 text-neutral-200', className)}>
      {/* Workflow Progress */}
      <WorkflowProgress className="m-2 mb-0" />

      {/* Main area: sidebar + terminal */}
      <div className="flex flex-1 min-h-0 mt-2">
        {/* Agent sidebar */}
        <div className="w-64 border-r border-neutral-800 overflow-y-auto p-2 space-y-1.5">
          <div className="flex items-center justify-between mb-2 px-1">
            <span
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              className="font-mono text-neutral-500 uppercase tracking-wider"
            >
              Agents
            </span>
            <span
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              className="font-mono text-neutral-600"
            >
              {agents.length}
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {agents.map((agent) => (
              <motion.div
                key={agent.spec.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
              >
                <AgentCard
                  agentId={agent.spec.id}
                  selected={agent.spec.id === activeAgentId}
                  onSelect={setActiveAgentId}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {agents.length === 0 && (
            <div className="p-4 text-center">
              <span
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                className="font-mono text-neutral-600"
              >
                Waiting for agents…
              </span>
            </div>
          )}
        </div>

        {/* Terminal / output area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <AgentTabBar
            activeAgentId={activeAgentId}
            onSelectAgent={setActiveAgentId}
          />

          {/* Terminal embed slot */}
          <div className="flex-1 min-h-0 relative">
            {renderTerminal
              ? renderTerminal(activeAgentId)
              : (
                <div className="flex items-center justify-center h-full">
                  <span
                    style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                    className="font-mono text-neutral-600"
                  >
                    {activeAgentId
                      ? `Terminal: ${activeAgentId}`
                      : 'Select an agent'
                    }
                  </span>
                </div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Public: wrapped with registry provider
// =============================================================================

export function ConductorPanel(props: ConductorPanelProps) {
  return (
    <ConductorRegistryProvider>
      <ConductorPanelInner {...props} />
    </ConductorRegistryProvider>
  )
}
