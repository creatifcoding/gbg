/**
 * Area State Graph
 *
 * Effect Graph.directed definition for validating area state transitions.
 * Implements ISA-95 asset hierarchy area-level lifecycle states.
 *
 * State Machine:
 * ```
 *                 Restrict          ClearRestriction
 *     ┌──────────────────────>┌────────────┐
 *     │                       │ restricted  │
 *     │<──────────────────────└────────────┘
 *     │
 *  ┌──┴──────┐  EnterMaintenance  ┌─────────────┐  Decommission  ┌────────────────┐
 *  │ active  │───────────────────>│ maintenance  │───────────────>│ decommissioned │
 *  │         │<───────────────────│             │                 │   (terminal)   │
 *  └──┬──────┘  ExitMaintenance   └─────────────┘                └────────────────┘
 *     │                                                                  ▲
 *     │ Deactivate        Activate                                       │
 *     ▼                                                                  │
 *  ┌──────────┐                                                          │
 *  │ inactive │──────────────────────────────────────────────────────────┘
 *  │          │  Decommission
 *  └──────────┘
 *     │    ▲
 *     └────┘  Activate (back to active)
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Area state nodes (ISA-95 asset hierarchy) */
export type AreaStateNode =
  | 'active'
  | 'restricted'
  | 'maintenance'
  | 'inactive'
  | 'decommissioned'

/** Area transition actions */
export type AreaTransitionAction =
  | 'Restrict'
  | 'ClearRestriction'
  | 'EnterMaintenance'
  | 'ExitMaintenance'
  | 'Deactivate'
  | 'Activate'
  | 'Decommission'

/** Node index map for quick lookup */
export interface AreaStateNodeMap {
  readonly active: Graph.NodeIndex
  readonly restricted: Graph.NodeIndex
  readonly maintenance: Graph.NodeIndex
  readonly inactive: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<AreaStateNode, Graph.NodeIndex> = {} as Record<AreaStateNode, Graph.NodeIndex>

/**
 * Area State Graph
 *
 * Directed graph representing valid area state transitions.
 * Nodes are area states, edges are transition actions.
 */
export const areaStateGraph = Graph.directed<AreaStateNode, AreaTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.active = Graph.addNode(mutable, 'active')
  nodeIndices.restricted = Graph.addNode(mutable, 'restricted')
  nodeIndices.maintenance = Graph.addNode(mutable, 'maintenance')
  nodeIndices.inactive = Graph.addNode(mutable, 'inactive')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from ACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.restricted, 'Restrict')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.maintenance, 'EnterMaintenance')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.inactive, 'Deactivate')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RESTRICTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.restricted, nodeIndices.active, 'ClearRestriction')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.active, 'ExitMaintenance')
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from INACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.inactive, nodeIndices.active, 'Activate')
  Graph.addEdge(mutable, nodeIndices.inactive, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given area state.
 *
 * @param state - The area state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: AreaStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get area state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The area state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<AreaStateNode> => {
  return Graph.getNode(areaStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current area state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: AreaStateNode, to: AreaStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(areaStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current area state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: AreaStateNode, to: AreaStateNode): Option.Option<AreaTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    areaStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(areaStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current area state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: AreaStateNode): readonly AreaStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(areaStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(areaStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target area state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: AreaStateNode): readonly AreaStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(areaStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(areaStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/**
 * Check if an area can be restricted from its current state.
 */
export const canRestrict = (state: AreaStateNode): boolean => {
  return state === 'active'
}

/**
 * Check if an area restriction can be cleared from its current state.
 */
export const canClearRestriction = (state: AreaStateNode): boolean => {
  return state === 'restricted'
}

/**
 * Check if an area can enter maintenance from its current state.
 */
export const canEnterMaintenance = (state: AreaStateNode): boolean => {
  return state === 'active'
}

/**
 * Check if an area can exit maintenance from its current state.
 */
export const canExitMaintenance = (state: AreaStateNode): boolean => {
  return state === 'maintenance'
}

/**
 * Check if an area can be deactivated from its current state.
 */
export const canDeactivate = (state: AreaStateNode): boolean => {
  return state === 'active'
}

/**
 * Check if an area can be activated from its current state.
 */
export const canActivate = (state: AreaStateNode): boolean => {
  return state === 'inactive'
}

/**
 * Check if an area can be decommissioned from its current state.
 */
export const canDecommission = (state: AreaStateNode): boolean => {
  return state === 'inactive' || state === 'maintenance'
}

/**
 * Check if a state is terminal (no outgoing transitions).
 */
export const isTerminalState = (state: AreaStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 5

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 8

/** All possible area states */
export const ALL_STATES: readonly AreaStateNode[] = [
  'active',
  'restricted',
  'maintenance',
  'inactive',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly AreaStateNode[] = ['decommissioned']
