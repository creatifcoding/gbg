/**
 * Plant State Graph
 *
 * Effect Graph.directed definition for validating plant state transitions.
 * Implements ISA-95 asset hierarchy — plant-level lifecycle states.
 *
 * State Machine:
 * ```
 *   commissioning ──CompleteCommissioning──> operational
 *                                             │     ▲
 *                     ScheduledShutdown ◄──────┘     │
 *                           │                        │
 *                           │  Restart ──────────────┘
 *                           │
 *                           │  Decommission ──> decommissioned
 *                           ▼
 *                     scheduled_shutdown
 *
 *   operational ──EmergencyShutdown──> emergency_shutdown
 *                                            │
 *                          BeginEmergencyMaintenance
 *                                            ▼
 *   operational ──MaintenanceShutdown──> maintenance_shutdown
 *                                            │
 *                    CompleteMaintenanceRestart
 *                                            ▼
 *                                       operational
 *
 *   maintenance_shutdown ──Decommission──> decommissioned
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Plant state nodes (ISA-95 plant lifecycle) */
export type PlantStateNode =
  | 'commissioning'
  | 'operational'
  | 'scheduled_shutdown'
  | 'emergency_shutdown'
  | 'maintenance_shutdown'
  | 'decommissioned'

/** Plant transition actions */
export type PlantTransitionAction =
  | 'CompleteCommissioning'
  | 'ScheduledShutdown'
  | 'Restart'
  | 'EmergencyShutdown'
  | 'BeginEmergencyMaintenance'
  | 'CompleteMaintenanceRestart'
  | 'MaintenanceShutdown'
  | 'Decommission'

/** Node index map for quick lookup */
export interface PlantStateNodeMap {
  readonly commissioning: Graph.NodeIndex
  readonly operational: Graph.NodeIndex
  readonly scheduled_shutdown: Graph.NodeIndex
  readonly emergency_shutdown: Graph.NodeIndex
  readonly maintenance_shutdown: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<PlantStateNode, Graph.NodeIndex> = {} as Record<PlantStateNode, Graph.NodeIndex>

/**
 * Plant State Graph
 *
 * Directed graph representing valid plant state transitions.
 * Nodes are plant states, edges are transition actions.
 */
export const plantStateGraph = Graph.directed<PlantStateNode, PlantTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.commissioning = Graph.addNode(mutable, 'commissioning')
  nodeIndices.operational = Graph.addNode(mutable, 'operational')
  nodeIndices.scheduled_shutdown = Graph.addNode(mutable, 'scheduled_shutdown')
  nodeIndices.emergency_shutdown = Graph.addNode(mutable, 'emergency_shutdown')
  nodeIndices.maintenance_shutdown = Graph.addNode(mutable, 'maintenance_shutdown')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from COMMISSIONING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.commissioning, nodeIndices.operational, 'CompleteCommissioning')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OPERATIONAL
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.scheduled_shutdown, 'ScheduledShutdown')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.emergency_shutdown, 'EmergencyShutdown')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.maintenance_shutdown, 'MaintenanceShutdown')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SCHEDULED_SHUTDOWN
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.scheduled_shutdown, nodeIndices.operational, 'Restart')
  Graph.addEdge(mutable, nodeIndices.scheduled_shutdown, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from EMERGENCY_SHUTDOWN
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.emergency_shutdown, nodeIndices.maintenance_shutdown, 'BeginEmergencyMaintenance')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from MAINTENANCE_SHUTDOWN
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.maintenance_shutdown, nodeIndices.operational, 'CompleteMaintenanceRestart')
  Graph.addEdge(mutable, nodeIndices.maintenance_shutdown, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given plant state.
 */
export const getNodeIndex = (state: PlantStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get plant state from a NodeIndex.
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<PlantStateNode> => {
  return Graph.getNode(plantStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 */
export const isValidStateTransition = (from: PlantStateNode, to: PlantStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(plantStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (from: PlantStateNode, to: PlantStateNode): Option.Option<PlantTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  const edgeIndex = Graph.findEdge(
    plantStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  const edge = Graph.getEdge(plantStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (from: PlantStateNode): readonly PlantStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(plantStateGraph, fromIndex, 'outgoing')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(plantStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 */
export const getValidPreviousStates = (to: PlantStateNode): readonly PlantStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(plantStateGraph, toIndex, 'incoming')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(plantStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if commissioning can be completed from the current state. */
export const canCompleteCommissioning = (state: PlantStateNode): boolean => {
  return state === 'commissioning'
}

/** Check if a scheduled shutdown can be initiated from the current state. */
export const canScheduledShutdown = (state: PlantStateNode): boolean => {
  return state === 'operational'
}

/** Check if the plant can restart from the current state. */
export const canRestart = (state: PlantStateNode): boolean => {
  return state === 'scheduled_shutdown'
}

/** Check if an emergency shutdown can be initiated from the current state. */
export const canEmergencyShutdown = (state: PlantStateNode): boolean => {
  return state === 'operational'
}

/** Check if emergency maintenance can begin from the current state. */
export const canBeginEmergencyMaintenance = (state: PlantStateNode): boolean => {
  return state === 'emergency_shutdown'
}

/** Check if maintenance restart can be completed from the current state. */
export const canCompleteMaintenanceRestart = (state: PlantStateNode): boolean => {
  return state === 'maintenance_shutdown'
}

/** Check if a maintenance shutdown can be initiated from the current state. */
export const canMaintenanceShutdown = (state: PlantStateNode): boolean => {
  return state === 'operational'
}

/** Check if the plant can be decommissioned from the current state. */
export const canDecommission = (state: PlantStateNode): boolean => {
  return state === 'scheduled_shutdown' || state === 'maintenance_shutdown'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: PlantStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 9

/** All possible plant states */
export const ALL_STATES: readonly PlantStateNode[] = [
  'commissioning',
  'operational',
  'scheduled_shutdown',
  'emergency_shutdown',
  'maintenance_shutdown',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly PlantStateNode[] = ['decommissioned']
