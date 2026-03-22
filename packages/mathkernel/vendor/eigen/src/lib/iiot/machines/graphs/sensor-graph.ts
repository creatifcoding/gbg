/**
 * Sensor State Graph
 *
 * Effect Graph.directed definition for validating sensor lifecycle
 * state transitions. Implements ISA-95 asset hierarchy for measurement
 * instruments, sensors, and transducers.
 *
 * State Machine per ISA-95 Sensor Lifecycle:
 * ```
 *                    ┌──────────┐
 *            ┌──────→│  active  │◄──────────┐
 *            │       └────┬─┬───┘           │
 *            │            │ │               │
 *    Complete│  StartCal  │ │ FlagForCal    │ BringOnline
 *   Calibration           │ │               │
 *            │            ↓ ↓               │
 *            │  ┌─────────────────────┐     │
 *            ├──│    calibrating      │     │
 *            │  └─────────┬───────────┘     │
 *            │            │                 │
 *            │       FailCalibration        │
 *            │            │                 │
 *            │            ↓                 │
 *            │       ┌─────────┐            │
 *            │       │ faulted │            │
 *            │       └────┬────┘            │
 *            │            │                 │
 *            │       TakeOffline            │
 *            │            │                 │
 *            │            ↓                 │
 *            │       ┌─────────┐            │
 *            └───────│ offline │────────────┘
 *                    └────┬────┘
 *                         │
 *                    Decommission
 *                         │
 *                         ↓
 *                  ┌──────────────┐
 *                  │decommissioned│
 *                  └──────────────┘
 *
 *     needs_calibration ──StartCalibration──→ calibrating
 *     active ──MarkFaulted──→ faulted
 *     faulted ──ClearFault──→ active
 *     active ──TakeOffline──→ offline
 *     faulted ──Decommission──→ decommissioned
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Sensor state nodes (ISA-95 sensor lifecycle) */
export type SensorStateNode =
  | 'active'
  | 'calibrating'
  | 'needs_calibration'
  | 'faulted'
  | 'offline'
  | 'decommissioned'

/** Sensor transition actions */
export type SensorTransitionAction =
  | 'StartCalibration'
  | 'CompleteCalibration'
  | 'FailCalibration'
  | 'FlagForCalibration'
  | 'MarkFaulted'
  | 'ClearFault'
  | 'TakeOffline'
  | 'BringOnline'
  | 'Decommission'

/** Node index map for quick lookup */
export interface SensorNodeMap {
  readonly active: Graph.NodeIndex
  readonly calibrating: Graph.NodeIndex
  readonly needs_calibration: Graph.NodeIndex
  readonly faulted: Graph.NodeIndex
  readonly offline: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<SensorStateNode, Graph.NodeIndex> = {} as Record<SensorStateNode, Graph.NodeIndex>

/**
 * Sensor State Graph
 *
 * Directed graph representing valid state transitions.
 * Nodes are sensor states, edges are transition actions.
 */
export const sensorStateGraph = Graph.directed<SensorStateNode, SensorTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.active = Graph.addNode(mutable, 'active')
  nodeIndices.calibrating = Graph.addNode(mutable, 'calibrating')
  nodeIndices.needs_calibration = Graph.addNode(mutable, 'needs_calibration')
  nodeIndices.faulted = Graph.addNode(mutable, 'faulted')
  nodeIndices.offline = Graph.addNode(mutable, 'offline')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from ACTIVE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.calibrating, 'StartCalibration')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.needs_calibration, 'FlagForCalibration')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.faulted, 'MarkFaulted')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.offline, 'TakeOffline')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from CALIBRATING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.calibrating, nodeIndices.active, 'CompleteCalibration')
  Graph.addEdge(mutable, nodeIndices.calibrating, nodeIndices.faulted, 'FailCalibration')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from NEEDS_CALIBRATION
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.needs_calibration, nodeIndices.calibrating, 'StartCalibration')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from FAULTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.active, 'ClearFault')
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.offline, 'TakeOffline')
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OFFLINE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.active, 'BringOnline')
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given sensor state.
 *
 * @param state - The sensor state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: SensorStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get sensor state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The sensor state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<SensorStateNode> => {
  return Graph.getNode(sensorStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current sensor state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: SensorStateNode, to: SensorStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(sensorStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current sensor state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: SensorStateNode, to: SensorStateNode): Option.Option<SensorTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    sensorStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(sensorStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current sensor state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: SensorStateNode): readonly SensorStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(sensorStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(sensorStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target sensor state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: SensorStateNode): readonly SensorStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(sensorStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(sensorStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if a sensor can start calibration from its current state. */
export const canStartCalibration = (state: SensorStateNode): boolean => {
  return state === 'active' || state === 'needs_calibration'
}

/** Check if calibration can be completed from its current state. */
export const canCompleteCalibration = (state: SensorStateNode): boolean => {
  return state === 'calibrating'
}

/** Check if calibration can fail from its current state. */
export const canFailCalibration = (state: SensorStateNode): boolean => {
  return state === 'calibrating'
}

/** Check if a sensor can be flagged for calibration from its current state. */
export const canFlagForCalibration = (state: SensorStateNode): boolean => {
  return state === 'active'
}

/** Check if a sensor can be marked as faulted from its current state. */
export const canMarkFaulted = (state: SensorStateNode): boolean => {
  return state === 'active'
}

/** Check if a sensor fault can be cleared from its current state. */
export const canClearFault = (state: SensorStateNode): boolean => {
  return state === 'faulted'
}

/** Check if a sensor can be taken offline from its current state. */
export const canTakeOffline = (state: SensorStateNode): boolean => {
  return state === 'faulted' || state === 'active'
}

/** Check if a sensor can be brought online from its current state. */
export const canBringOnline = (state: SensorStateNode): boolean => {
  return state === 'offline'
}

/** Check if a sensor can be decommissioned from its current state. */
export const canDecommission = (state: SensorStateNode): boolean => {
  return state === 'offline' || state === 'faulted'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: SensorStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 12

/** All possible sensor states */
export const ALL_STATES: readonly SensorStateNode[] = [
  'active',
  'calibrating',
  'needs_calibration',
  'faulted',
  'offline',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly SensorStateNode[] = ['decommissioned']
