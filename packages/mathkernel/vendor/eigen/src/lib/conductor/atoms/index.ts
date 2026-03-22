/**
 * Conductor Atoms
 *
 * Re-exports from ConductorService + derived convenience atoms.
 * React components subscribe to these directly.
 */

import { Atom } from '@effect-atom/atom'
import {
  conductorStateAtom,
  agentsAtom,
  agentListAtom,
  workflowStatusAtom,
  currentStepAtom,
  stepResultsAtom,
} from '../services/ConductorService'
import type { AgentInstance } from '../schemas'

export * from './inline-task-thread'

// Re-export primary atoms
export {
  conductorStateAtom,
  agentsAtom,
  agentListAtom,
  workflowStatusAtom,
  currentStepAtom,
  stepResultsAtom,
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atoms
// ─────────────────────────────────────────────────────────────────────────────

/** Number of active (non-terminated) agents */
export const activeAgentCountAtom = Atom.make((get) => {
  const agents = get(agentListAtom)
  return agents.filter(a => a.status !== 'terminated' && a.status !== 'failed').length
})

/** Agents grouped by role */
export const agentsByRoleAtom = Atom.make((get) => {
  const agents = get(agentListAtom)
  const grouped = new Map<string, AgentInstance[]>()
  for (const agent of agents) {
    const role = agent.spec.role
    if (!grouped.has(role)) grouped.set(role, [])
    grouped.get(role)!.push(agent)
  }
  return grouped
})

/** Is any agent currently working? */
export const isAnyAgentWorkingAtom = Atom.make((get) => {
  const agents = get(agentListAtom)
  return agents.some(a => a.status === 'working')
})

/** Workflow progress: completed steps / total steps */
export const workflowProgressAtom = Atom.make((get) => {
  const state = get(conductorStateAtom)
  if (!state.workflow) return { completed: 0, total: 0, pct: 0 }

  const total = state.workflow.steps.length
  const completed = Array.from(state.stepResults.values())
    .filter(r => r.status === 'complete').length

  return {
    completed,
    total,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
})

/** Agent by ID (family pattern) */
export const agentAtom = Atom.family((id: string) =>
  Atom.make((get) => {
    const agents = get(agentsAtom)
    return agents.get(id) ?? null
  })
)

/** Step result by ID (family pattern) */
export const stepResultAtom = Atom.family((id: string) =>
  Atom.make((get) => {
    const results = get(stepResultsAtom)
    return results.get(id) ?? null
  })
)
