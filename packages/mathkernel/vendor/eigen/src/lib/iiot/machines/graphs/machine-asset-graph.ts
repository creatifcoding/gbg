/**
 * Machine Asset State Graph
 *
 * Effect Graph.directed definition for validating machine asset lifecycle
 * state transitions. Implements ISA-95 asset hierarchy for physical machines
 * and production equipment.
 *
 * State Machine per ISA-95 Asset Lifecycle:
 * ```
 *                    ┌───────────────┐
 *                    │ commissioned  │
 *                    └──────┬────────┘
 *                           │ Activate
 *                           v
 *              ┌─────── operational ───────┐
 *              │       ↑     ↓      ↑      │
 *              │  Resume│  GoIdle   │      │
 *              │       ↑     ↓      │      │
 *              │       idle ────────┘      │
 *              │        │                  │
 *              │MarkFaulted  MarkFaulted   │
 *              │        ↓     ↓            │
 *    Schedule  │      faulted              │ ScheduleMaintenance
 *   Maintenance│     ↙       ↘             │
 *              v    v         v            v
 *     scheduled_maintenance  unscheduled_maintenance
 *          │        ↑               │
 *          │  CompleteMaintenance   │ CompleteMaintenance
 *          │        ↓               ↓
 *          │     operational ◄──────┘
 *          │
 *   Retire │     operational ──Retire──→ retired
 *          │     idle ─────────Retire──→ retired
 *          │                              │
 *          │ Decommission                 │ Decommission
 *          └──────────→ decommissioned ◄──┘
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Machine asset state nodes (ISA-95 asset lifecycle) */
export type MachineAssetStateNode =
  | 'commissioned'
  | 'operational'
  | 'idle'
  | 'faulted'
  | 'scheduled_maintenance'
  | 'unscheduled_maintenance'
  | 'retired'
  | 'decommissioned'

/** Machine asset transition actions */
export type MachineAssetTransitionAction =
  | 'Activate'
  | 'GoIdle'
  | 'Resume'
  | 'MarkFaulted'
  | 'ScheduleRepair'
  | 'EmergencyRepair'
  | 'ScheduleMaintenance'
  | 'CompleteMaintenance'
  | 'Retire'
  | 'Decommission'

/** Node index map for quick lookup */
export interface MachineAssetNodeMap {
  readonly commissioned: Graph.NodeIndex
  readonly operational: Graph.NodeIndex
  readonly idle: Graph.NodeIndex
  readonly faulted: Graph.NodeIndex
  readonly scheduled_maintenance: Graph.NodeIndex
  readonly unscheduled_maintenance: Graph.NodeIndex
  readonly retired: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<MachineAssetStateNode, Graph.NodeIndex> = {} as Record<MachineAssetStateNode, Graph.NodeIndex>

/**
 * Machine Asset State Graph
 *
 * Directed graph representing valid state transitions.
 * Nodes are machine asset states, edges are transition actions.
 */
export const machineAssetStateGraph = Graph.directed<MachineAssetStateNode, MachineAssetTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.commissioned = Graph.addNode(mutable, 'commissioned')
  nodeIndices.operational = Graph.addNode(mutable, 'operational')
  nodeIndices.idle = Graph.addNode(mutable, 'idle')
  nodeIndices.faulted = Graph.addNode(mutable, 'faulted')
  nodeIndices.scheduled_maintenance = Graph.addNode(mutable, 'scheduled_maintenance')
  nodeIndices.unscheduled_maintenance = Graph.addNode(mutable, 'unscheduled_maintenance')
  nodeIndices.retired = Graph.addNode(mutable, 'retired')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from COMMISSIONED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.commissioned, nodeIndices.operational, 'Activate')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OPERATIONAL
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.idle, 'GoIdle')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.faulted, 'MarkFaulted')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.scheduled_maintenance, 'ScheduleMaintenance')
  Graph.addEdge(mutable, nodeIndices.operational, nodeIndices.retired, 'Retire')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from IDLE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.operational, 'Resume')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.faulted, 'MarkFaulted')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.scheduled_maintenance, 'ScheduleMaintenance')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.retired, 'Retire')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from FAULTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.scheduled_maintenance, 'ScheduleRepair')
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.unscheduled_maintenance, 'EmergencyRepair')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SCHEDULED_MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.scheduled_maintenance, nodeIndices.operational, 'CompleteMaintenance')
  Graph.addEdge(mutable, nodeIndices.scheduled_maintenance, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from UNSCHEDULED_MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.unscheduled_maintenance, nodeIndices.operational, 'CompleteMaintenance')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RETIRED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.retired, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given machine asset state.
 *
 * @param state - The machine asset state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: MachineAssetStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get machine asset state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The machine asset state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<MachineAssetStateNode> => {
  return Graph.getNode(machineAssetStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current machine asset state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: MachineAssetStateNode, to: MachineAssetStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(machineAssetStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current machine asset state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: MachineAssetStateNode, to: MachineAssetStateNode): Option.Option<MachineAssetTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    machineAssetStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(machineAssetStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current machine asset state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: MachineAssetStateNode): readonly MachineAssetStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(machineAssetStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(machineAssetStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target machine asset state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: MachineAssetStateNode): readonly MachineAssetStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(machineAssetStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(machineAssetStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if a machine asset can be activated from its current state. */
export const canActivate = (state: MachineAssetStateNode): boolean => {
  return state === 'commissioned'
}

/** Check if a machine asset can go idle from its current state. */
export const canGoIdle = (state: MachineAssetStateNode): boolean => {
  return state === 'operational'
}

/** Check if a machine asset can resume from its current state. */
export const canResume = (state: MachineAssetStateNode): boolean => {
  return state === 'idle'
}

/** Check if a machine asset can be marked as faulted from its current state. */
export const canMarkFaulted = (state: MachineAssetStateNode): boolean => {
  return state === 'operational' || state === 'idle'
}

/** Check if a faulted machine asset can be scheduled for repair. */
export const canScheduleRepair = (state: MachineAssetStateNode): boolean => {
  return state === 'faulted'
}

/** Check if a faulted machine asset can undergo emergency repair. */
export const canEmergencyRepair = (state: MachineAssetStateNode): boolean => {
  return state === 'faulted'
}

/** Check if a machine asset can be scheduled for maintenance from its current state. */
export const canScheduleMaintenance = (state: MachineAssetStateNode): boolean => {
  return state === 'operational' || state === 'idle'
}

/** Check if maintenance can be completed from its current state. */
export const canCompleteMaintenance = (state: MachineAssetStateNode): boolean => {
  return state === 'scheduled_maintenance' || state === 'unscheduled_maintenance'
}

/** Check if a machine asset can be retired from its current state. */
export const canRetire = (state: MachineAssetStateNode): boolean => {
  return state === 'operational' || state === 'idle'
}

/** Check if a machine asset can be decommissioned from its current state. */
export const canDecommission = (state: MachineAssetStateNode): boolean => {
  return state === 'retired' || state === 'scheduled_maintenance'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: MachineAssetStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 8

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 15

/** All possible machine asset states */
export const ALL_STATES: readonly MachineAssetStateNode[] = [
  'commissioned',
  'operational',
  'idle',
  'faulted',
  'scheduled_maintenance',
  'unscheduled_maintenance',
  'retired',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly MachineAssetStateNode[] = ['decommissioned']
