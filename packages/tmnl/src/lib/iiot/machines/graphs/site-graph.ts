/**
 * Site State Graph
 *
 * Effect Graph.directed definition for validating site state transitions.
 * Implements ISA-95 asset hierarchy site-level lifecycle states.
 *
 * State Machine:
 * ```
 *  ┌─────────┐  BeginConstruction  ┌────────────────────┐  Commission  ┌─────────────┐
 *  │ planned │──────────────────-->│ under_construction │────────────>│ operational │
 *  └─────────┘                     └────────────────────┘             └──┬──────┬──┘
 *                                                                       │      │
 *                                              SeasonalShutdown ┌───────┘      │ Close
 *                                                               ▼              ▼
 *                                              ┌────────────────────┐   ┌──────────┐
 *                                              │ seasonal_shutdown  │   │  closed   │
 *                                              └────────────────────┘   └──┬───┬──┘
 *                                                       │                  │   │
 *                                                Reopen │     Reopen ──────┘   │ Decommission
 *                                                       ▼                      ▼
 *                                              ┌─────────────┐         ┌────────────────┐
 *                                              │ operational │         │ decommissioned │ (terminal)
 *                                              └─────────────┘         └────────────────┘
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Site state nodes (ISA-95 asset hierarchy) */
export type SiteStateNode =
  | 'planned'
  | 'under_construction'
  | 'operational'
  | 'seasonal_shutdown'
  | 'closed'
  | 'decommissioned'

/** Site transition actions */
export type SiteTransitionAction =
  | 'BeginConstruction'
  | 'Commission'
  | 'SeasonalShutdown'
  | 'Reopen'
  | 'Close'
  | 'Decommission'

/** Node index map for quick lookup */
export interface SiteStateNodeMap {
  readonly planned: Graph.NodeIndex
  readonly under_construction: Graph.NodeIndex
  readonly operational: Graph.NodeIndex
  readonly seasonal_shutdown: Graph.NodeIndex
  readonly closed: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<SiteStateNode, Graph.NodeIndex> = {} as Record<SiteStateNode, Graph.NodeIndex>

/**
 * Site State Graph
 *
 * Directed graph representing valid site state transitions.
 * Nodes are site states, edges are transition actions.
 */
export const siteStateGraph = Graph.directed<SiteStateNode, SiteTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.planned = Graph.addNode(mutable, 'planned')
  nodeIndices.under_construction = Graph.addNode(mutable, 'under_construction')
  nodeIndices.operational = Graph.addNode(mutable, 'operational')
  nodeIndices.seasonal_shutdown = Graph.addNode(mutable, 'seasonal_shutdown')
  nodeIndices.closed = Graph.addNode(mutable, 'closed')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from PLANNED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.planned, nodeIndices.under_construction, 'BeginConstruction')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from UNDER_CONSTRUCTION
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.under_construction, nodeIndices.operational, 'Commission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OPERATIONAL
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.seasonal_shutdown, 'SeasonalShutdown')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.closed, 'Close')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SEASONAL_SHUTDOWN
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.seasonal_shutdown, nodeIndices.operational, 'Reopen')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from CLOSED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.closed, nodeIndices.decommissioned, 'Decommission')
  Graph.addEdge(mutable, nodeIndices.closed, nodeIndices.operational, 'Reopen')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given site state.
 *
 * @param state - The site state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: SiteStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get site state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The site state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<SiteStateNode> => {
  return Graph.getNode(siteStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current site state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: SiteStateNode, to: SiteStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(siteStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current site state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: SiteStateNode, to: SiteStateNode): Option.Option<SiteTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    siteStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(siteStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current site state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: SiteStateNode): readonly SiteStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(siteStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(siteStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target site state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: SiteStateNode): readonly SiteStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(siteStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(siteStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/**
 * Check if a site can begin construction from its current state.
 */
export const canBeginConstruction = (state: SiteStateNode): boolean => {
  return state === 'planned'
}

/**
 * Check if a site can be commissioned from its current state.
 */
export const canCommission = (state: SiteStateNode): boolean => {
  return state === 'under_construction'
}

/**
 * Check if a site can enter seasonal shutdown from its current state.
 */
export const canSeasonalShutdown = (state: SiteStateNode): boolean => {
  return state === 'operational'
}

/**
 * Check if a site can reopen from its current state.
 */
export const canReopen = (state: SiteStateNode): boolean => {
  return state === 'seasonal_shutdown' || state === 'closed'
}

/**
 * Check if a site can close from its current state.
 */
export const canClose = (state: SiteStateNode): boolean => {
  return state === 'operational'
}

/**
 * Check if a site can be decommissioned from its current state.
 */
export const canDecommission = (state: SiteStateNode): boolean => {
  return state === 'closed'
}

/**
 * Check if a state is terminal (no outgoing transitions).
 */
export const isTerminalState = (state: SiteStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 7

/** All possible site states */
export const ALL_STATES: readonly SiteStateNode[] = [
  'planned',
  'under_construction',
  'operational',
  'seasonal_shutdown',
  'closed',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly SiteStateNode[] = ['decommissioned']
