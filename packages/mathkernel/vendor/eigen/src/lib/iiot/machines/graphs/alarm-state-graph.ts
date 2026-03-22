/**
 * ISA-18.2 Alarm State Graph
 *
 * Effect Graph.directed definition for validating alarm state transitions.
 * Provides graph-based transition validation with support for:
 * - Valid transition checking
 * - Reachable states queries
 * - Path finding (for planned state changes)
 *
 * State Machine per ISA-18.2:
 * ```
 *                              ┌──────────────────┐
 *                              │  out_of_service  │
 *                              └────────┬─────────┘
 *                                       │ ReturnToService
 *                                       ▼
 *     ┌─────────────┐  Acknowledge   ┌─────────────┐
 *     │ unacknowledged │───────────────▶│ acknowledged │
 *     └──────┬──────┘               └──────┬──────┘
 *            │                              │
 *            │ Shelve                       │ Clear
 *            ▼                              ▼
 *     ┌─────────────┐               ┌─────────────┐
 *     │   shelved   │               │   cleared   │
 *     └──────┬──────┘               └─────────────┘
 *            │ Unshelve                     ▲
 *            └──────────────────────────────┘
 *                           (re-trigger)
 *
 *     ┌─────────────┐
 *     │  suppressed │  (can enter from unack/ack, exit to unack/ack)
 *     └─────────────┘
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'
import type { AlarmState } from '../../schemas/alarms'

// =============================================================================
// Types
// =============================================================================

/** Alarm state nodes (ISA-18.2 states) */
export type AlarmStateNode =
  | 'unacknowledged'
  | 'acknowledged'
  | 'shelved'
  | 'suppressed'
  | 'cleared'
  | 'out_of_service'

/** Alarm transition actions */
export type AlarmTransitionAction =
  | 'Acknowledge'
  | 'Clear'
  | 'Shelve'
  | 'Unshelve'
  | 'Suppress'
  | 'Unsuppress'
  | 'TakeOutOfService'
  | 'ReturnToService'
  | 'ReTrigger'

/** Node index map for quick lookup */
export interface AlarmStateNodeMap {
  readonly unacknowledged: Graph.NodeIndex
  readonly acknowledged: Graph.NodeIndex
  readonly shelved: Graph.NodeIndex
  readonly suppressed: Graph.NodeIndex
  readonly cleared: Graph.NodeIndex
  readonly out_of_service: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<AlarmStateNode, Graph.NodeIndex> = {} as Record<AlarmStateNode, Graph.NodeIndex>

/**
 * ISA-18.2 Alarm State Graph
 *
 * Directed graph representing valid state transitions.
 * Nodes are alarm states, edges are transition actions.
 */
export const alarmStateGraph = Graph.directed<AlarmStateNode, AlarmTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.unacknowledged = Graph.addNode(mutable, 'unacknowledged')
  nodeIndices.acknowledged = Graph.addNode(mutable, 'acknowledged')
  nodeIndices.shelved = Graph.addNode(mutable, 'shelved')
  nodeIndices.suppressed = Graph.addNode(mutable, 'suppressed')
  nodeIndices.cleared = Graph.addNode(mutable, 'cleared')
  nodeIndices.out_of_service = Graph.addNode(mutable, 'out_of_service')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from UNACKNOWLEDGED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.unacknowledged, nodeIndices.acknowledged, 'Acknowledge')
  Graph.addEdge(mutable, nodeIndices.unacknowledged, nodeIndices.shelved, 'Shelve')
  Graph.addEdge(mutable, nodeIndices.unacknowledged, nodeIndices.suppressed, 'Suppress')
  Graph.addEdge(mutable, nodeIndices.unacknowledged, nodeIndices.out_of_service, 'TakeOutOfService')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from ACKNOWLEDGED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.acknowledged, nodeIndices.cleared, 'Clear')
  Graph.addEdge(mutable, nodeIndices.acknowledged, nodeIndices.shelved, 'Shelve')
  Graph.addEdge(mutable, nodeIndices.acknowledged, nodeIndices.suppressed, 'Suppress')
  Graph.addEdge(mutable, nodeIndices.acknowledged, nodeIndices.out_of_service, 'TakeOutOfService')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SHELVED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.shelved, nodeIndices.unacknowledged, 'Unshelve')
  Graph.addEdge(mutable, nodeIndices.shelved, nodeIndices.acknowledged, 'Unshelve')
  Graph.addEdge(mutable, nodeIndices.shelved, nodeIndices.out_of_service, 'TakeOutOfService')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SUPPRESSED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.suppressed, nodeIndices.unacknowledged, 'Unsuppress')
  Graph.addEdge(mutable, nodeIndices.suppressed, nodeIndices.acknowledged, 'Unsuppress')
  Graph.addEdge(mutable, nodeIndices.suppressed, nodeIndices.out_of_service, 'TakeOutOfService')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from CLEARED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.cleared, nodeIndices.unacknowledged, 'ReTrigger')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OUT_OF_SERVICE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.out_of_service, nodeIndices.unacknowledged, 'ReturnToService')
  Graph.addEdge(mutable, nodeIndices.out_of_service, nodeIndices.cleared, 'ReturnToService')
})

/**
 * Get NodeIndex for a given alarm state.
 *
 * @param state - The alarm state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: AlarmStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get alarm state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The alarm state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<AlarmStateNode> => {
  return Graph.getNode(alarmStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current alarm state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: AlarmStateNode, to: AlarmStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(alarmStateGraph, fromIndex, toIndex)
}

/**
 * Check if a state transition is valid (using branded AlarmState type).
 *
 * @param from - Current alarm state (branded)
 * @param to - Desired next state (branded)
 * @returns true if the transition is valid
 */
export const isValidAlarmTransition = (from: AlarmState, to: AlarmState): boolean => {
  return isValidStateTransition(from as AlarmStateNode, to as AlarmStateNode)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current alarm state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: AlarmStateNode, to: AlarmStateNode): Option.Option<AlarmTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    alarmStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(alarmStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current alarm state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: AlarmStateNode): readonly AlarmStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(alarmStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(alarmStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target alarm state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: AlarmStateNode): readonly AlarmStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(alarmStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(alarmStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/**
 * Check if an alarm can be acknowledged from its current state.
 */
export const canAcknowledgeAlarm = (state: AlarmStateNode): boolean => {
  return state === 'unacknowledged'
}

/**
 * Check if an alarm can be cleared from its current state.
 */
export const canClearAlarm = (state: AlarmStateNode): boolean => {
  return state === 'acknowledged'
}

/**
 * Check if an alarm can be shelved from its current state.
 */
export const canShelveAlarm = (state: AlarmStateNode): boolean => {
  return state === 'unacknowledged' || state === 'acknowledged'
}

/**
 * Check if an alarm can be suppressed from its current state.
 */
export const canSuppressAlarm = (state: AlarmStateNode): boolean => {
  return state === 'unacknowledged' || state === 'acknowledged'
}

/**
 * Check if an alarm can be taken out of service from its current state.
 */
export const canTakeAlarmOutOfService = (state: AlarmStateNode): boolean => {
  return state !== 'out_of_service' && state !== 'cleared'
}

/**
 * Check if an alarm can be returned to service from its current state.
 */
export const canReturnAlarmToService = (state: AlarmStateNode): boolean => {
  return state === 'out_of_service'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = Graph.nodeCount(alarmStateGraph)

/** All possible alarm states */
export const ALL_STATES: readonly AlarmStateNode[] = [
  'unacknowledged',
  'acknowledged',
  'shelved',
  'suppressed',
  'cleared',
  'out_of_service',
]
