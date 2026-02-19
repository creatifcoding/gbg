/**
 * Conductor Adapter — Multi-agent orchestration
 *
 * Wraps an existing MorphChatAdapter (typically harness) and adds
 * multi-agent routing, task surface coupling, and transfer system
 * integration. The conductor manages which agent receives messages
 * and how inline tasks surface across agent boundaries.
 *
 * @module morphchat/adapters/conductor-adapter
 */

import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import type {
  MorphChatAdapter,
  TransferSurfaceConfig,
} from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'

// =============================================================================
// Config
// =============================================================================

export interface ConductorAdapterConfig {
  /** Underlying adapter (harness, mock, etc.) */
  readonly innerAdapter: MorphChatAdapter
  /** Agent registry — all available agents */
  readonly agents: ReadonlyArray<AgentInfo>
  /** Initial active agent ID */
  readonly activeAgentId?: string
  /** Transfer cluster label */
  readonly transferClusterLabel?: string
  /** Adapter ID override */
  readonly adapterId?: string
  /** Human label */
  readonly label?: string
}

// =============================================================================
// Factory
// =============================================================================

let conductorCounter = 0

export function createConductorAdapter(
  config: ConductorAdapterConfig,
): ConductorChatAdapter {
  const {
    innerAdapter,
    agents: initialAgents,
    activeAgentId: initialActiveId,
    transferClusterLabel = 'Conductor',
  } = config

  const adapterId = config.adapterId ?? `conductor-adapter-${++conductorCounter}`
  const label = config.label ?? 'Conductor'

  // ── Conductor-specific atoms ────────────────────────────

  const activeAgentId$ = Atom.make(initialActiveId ?? initialAgents[0]?.id ?? '')
  morphChatRegistry.mount(activeAgentId$)

  // Override agents$ with conductor's registry (may differ from inner)
  const agents$ = Atom.make<ReadonlyArray<AgentInfo>>(initialAgents)
  morphChatRegistry.mount(agents$)

  // Task surface — aggregated inline tasks across agents
  const conductorTasks$ = Atom.make<ReadonlyArray<unknown>>([])
  morphChatRegistry.mount(conductorTasks$)

  // ── Transfer config ─────────────────────────────────────

  const transferConfig: TransferSurfaceConfig = {
    surfaceId: adapterId,
    clusterLabel: transferClusterLabel,
    enableDrag: true,
    enableDrop: true,
  }

  // ── Routing send to active agent ────────────────────────

  const send = (params: SendParams): Effect.Effect<void> => {
    const activeId = morphChatRegistry.get(activeAgentId$)
    return innerAdapter.send({
      ...params,
      agentId: params.agentId ?? activeId,
    })
  }

  // ── Conductor operations ────────────────────────────────

  const setActiveAgent = (agentId: string) => {
    morphChatRegistry.set(activeAgentId$, agentId)
  }

  const addAgent = (agent: AgentInfo) => {
    morphChatRegistry.set(agents$, (prev) => {
      if (prev.some((a) => a.id === agent.id)) return prev
      return [...prev, agent]
    })
  }

  const removeAgent = (agentId: string) => {
    morphChatRegistry.set(agents$, (prev) => prev.filter((a) => a.id !== agentId))
    // If removed agent was active, switch to first remaining
    if (morphChatRegistry.get(activeAgentId$) === agentId) {
      const remaining = morphChatRegistry.get(agents$)
      if (remaining.length > 0) {
        morphChatRegistry.set(activeAgentId$, remaining[0].id)
      }
    }
  }

  // ── Return ──────────────────────────────────────────────

  return {
    adapterId,
    label,
    // Delegate data atoms to inner adapter
    messages$: innerAdapter.messages$,
    connection$: innerAdapter.connection$,
    streaming$: innerAdapter.streaming$,
    // Use conductor's agent registry
    agents$,
    inlineTasks$: conductorTasks$,
    transferConfig,
    // Operations
    send,
    cancel: () => innerAdapter.cancel(),
    reconnect: () => innerAdapter.reconnect(),
    clear: () => innerAdapter.clear(),
    dispose: () =>
      Effect.gen(function* () {
        yield* innerAdapter.dispose()
      }),
    // Conductor extensions
    activeAgentId$,
    setActiveAgent,
    addAgent,
    removeAgent,
  }
}

// =============================================================================
// Conductor Adapter Type
// =============================================================================

export interface ConductorChatAdapter extends MorphChatAdapter {
  /** Active agent ID atom */
  readonly activeAgentId$: Atom.Atom<string>
  /** Switch active agent */
  setActiveAgent(agentId: string): void
  /** Register a new agent */
  addAgent(agent: AgentInfo): void
  /** Unregister an agent */
  removeAgent(agentId: string): void
}
