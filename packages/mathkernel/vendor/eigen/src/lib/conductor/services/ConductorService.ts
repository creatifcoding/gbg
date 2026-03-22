/**
 * ConductorService — Agent orchestration as an Effect service.
 *
 * Composes TerminalSessionManager for process spawning.
 * Manages agent lifecycle, prompt injection, output polling.
 *
 * Atom-as-State: agents map and workflow state live in atoms.
 * Service methods mutate atoms directly.
 */

import { Context, Effect, Layer, Ref, HashMap, Option, Stream, Match, pipe } from 'effect'
import { Atom } from '@effect-atom/atom'
import {
  type AgentSpec,
  type AgentInstance,
  type AgentStatus,
  type Workflow,
  type WorkflowStep,
  type StepResult,
  ConductorError,
} from '../schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Atoms (Atom-as-State — React subscribes directly)
// ─────────────────────────────────────────────────────────────────────────────

export interface ConductorState {
  /** Active agents keyed by spec.id */
  agents: ReadonlyMap<string, AgentInstance>
  /** Active workflow (if running) */
  workflow: Workflow | null
  /** Step results keyed by step.id */
  stepResults: ReadonlyMap<string, StepResult>
  /** Current step ID */
  currentStepId: string | null
  /** Overall status */
  status: 'idle' | 'running' | 'paused' | 'complete' | 'failed'
}

const initialState: ConductorState = {
  agents: new Map(),
  workflow: null,
  stepResults: new Map(),
  currentStepId: null,
  status: 'idle',
}

export const conductorStateAtom = Atom.make<ConductorState>({ ...initialState })

// Derived atoms
export const agentsAtom = Atom.make((get) => get(conductorStateAtom).agents)
export const workflowStatusAtom = Atom.make((get) => get(conductorStateAtom).status)
export const currentStepAtom = Atom.make((get) => {
  const s = get(conductorStateAtom)
  if (!s.workflow || !s.currentStepId) return null
  return s.workflow.stepMap.get(s.currentStepId) ?? null
})
export const stepResultsAtom = Atom.make((get) => get(conductorStateAtom).stepResults)

export const agentListAtom = Atom.make((get) => {
  const agents = get(agentsAtom)
  return Array.from(agents.values())
})

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ConductorServiceShape {
  /** Spawn an agent as a terminal session */
  readonly spawnAgent: (
    spec: AgentSpec,
  ) => Effect.Effect<AgentInstance, ConductorError>

  /** Send a prompt to an agent */
  readonly sendPrompt: (
    agentId: string,
    prompt: string,
  ) => Effect.Effect<void, ConductorError>

  /** Poll agent output until pattern matches or timeout */
  readonly pollOutput: (
    agentId: string,
    pattern: RegExp,
    timeoutMs?: number,
  ) => Effect.Effect<string, ConductorError>

  /** Get agent's accumulated output */
  readonly getOutput: (
    agentId: string,
  ) => Effect.Effect<ReadonlyArray<string>, ConductorError>

  /** Terminate an agent */
  readonly terminateAgent: (
    agentId: string,
  ) => Effect.Effect<void, ConductorError>

  /** Execute a workflow */
  readonly executeWorkflow: (
    workflow: Workflow,
    registry: import('@effect-atom/atom').Registry.AtomRegistry,
  ) => Effect.Effect<ReadonlyMap<string, StepResult>, ConductorError>

  /** Get current state snapshot */
  readonly getState: () => Effect.Effect<ConductorState>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class ConductorService extends Context.Tag('tmnl/conductor/ConductorService')<
  ConductorService,
  ConductorServiceShape
>() {}
