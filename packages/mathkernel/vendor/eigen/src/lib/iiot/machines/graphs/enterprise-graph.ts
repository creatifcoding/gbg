/**
 * Enterprise State Graph
 *
 * Effect Graph.directed definition for validating enterprise state transitions.
 * Implements ISA-95 asset hierarchy enterprise-level lifecycle states.
 *
 * State Machine:
 * ```
 *     ┌──────────┐  Restructure   ┌───────────────┐
 *     │  active   │───────────────>│ restructuring  │
 *     │          │<───────────────│               │
 *     └──┬───┬──┘ CompleteRestr.  └───────┬───────┘
 *        │   │                            │
 *        │   │ Merge                      │ Dissolve
 *        │   ▼                            │
 *        │  ┌──────────┐                  │
 *        │  │  merged   │ (terminal)      │
 *        │  └──────────┘                  │
 *        │                                │
 *        │ Dissolve                       │
 *        ▼                                ▼
 *     ┌──────────┐
 *     │ dissolved │ (terminal)
 *     └──────────┘
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Enterprise state nodes (ISA-95 asset hierarchy) */
export type EnterpriseStateNode =
  | 'active'
  | 'restructuring'
  | 'merged'
  | 'dissolved'

/** Enterprise transition actions */
export type EnterpriseTransitionAction =
  | 'Restructure'
  | 'CompleteRestructuring'
  | 'Merge'
  | 'Dissolve'

/** Node index map for quick lookup */
export interface EnterpriseStateNodeMap {
  readonly active: Graph.NodeIndex
  readonly restructuring: Graph.NodeIndex
  readonly merged: Graph.NodeIndex
  readonly dissolved: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<EnterpriseStateNode, Graph.NodeIndex> = {} as Record<EnterpriseStateNode, Graph.NodeIndex>

/**
 * Enterprise State Graph
 *
 * Directed graph representing valid enterprise state transitions.
 * Nodes are enterprise states, edges are transition actions.
 */
export const enterpriseStateGraph = Graph.directed<EnterpriseStateNode, EnterpriseTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.active = Graph.addNode(mutable, 'active')
  nodeIndices.restructuring = Graph.addNode(mutable, 'restructuring')
  nodeIndices.merged = Graph.addNode(mutable, 'merged')
  nodeIndices.dissolved = Graph.addNode(mutable, 'dissolved')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from ACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.restructuring, 'Restructure')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.merged, 'Merge')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.dissolved, 'Dissolve')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RESTRUCTURING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.restructuring, nodeIndices.active, 'CompleteRestructuring')
  Graph.addEdge(mutable, nodeIndices.restructuring, nodeIndices.dissolved, 'Dissolve')

  // MERGED and DISSOLVED are terminal states (no outgoing edges)
})

/**
 * Get NodeIndex for a given enterprise state.
 *
 * @param state - The enterprise state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: EnterpriseStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get enterprise state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The enterprise state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<EnterpriseStateNode> => {
  return Graph.getNode(enterpriseStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current enterprise state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: EnterpriseStateNode, to: EnterpriseStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(enterpriseStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current enterprise state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: EnterpriseStateNode, to: EnterpriseStateNode): Option.Option<EnterpriseTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    enterpriseStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(enterpriseStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current enterprise state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: EnterpriseStateNode): readonly EnterpriseStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(enterpriseStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(enterpriseStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target enterprise state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: EnterpriseStateNode): readonly EnterpriseStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(enterpriseStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(enterpriseStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/**
 * Check if an enterprise can begin restructuring from its current state.
 */
export const canRestructure = (state: EnterpriseStateNode): boolean => {
  return state === 'active'
}

/**
 * Check if an enterprise can complete restructuring from its current state.
 */
export const canCompleteRestructuring = (state: EnterpriseStateNode): boolean => {
  return state === 'restructuring'
}

/**
 * Check if an enterprise can merge from its current state.
 */
export const canMerge = (state: EnterpriseStateNode): boolean => {
  return state === 'active'
}

/**
 * Check if an enterprise can dissolve from its current state.
 */
export const canDissolve = (state: EnterpriseStateNode): boolean => {
  return state === 'active' || state === 'restructuring'
}

/**
 * Check if a state is terminal (no outgoing transitions).
 */
export const isTerminalState = (state: EnterpriseStateNode): boolean => {
  return state === 'merged' || state === 'dissolved'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 4

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 5

/** All possible enterprise states */
export const ALL_STATES: readonly EnterpriseStateNode[] = [
  'active',
  'restructuring',
  'merged',
  'dissolved',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly EnterpriseStateNode[] = ['merged', 'dissolved']
