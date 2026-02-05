/**
 * Equipment State Graph
 *
 * Effect Graph.directed definition for validating equipment state transitions.
 * Implements ISA-95 / OEE standard equipment states.
 *
 * State Categories for OEE:
 * - Availability: running vs downtime (planned/unplanned)
 * - Performance: running at full speed vs idle/blocked
 * - Quality: tracked separately via production schemas
 *
 * Generally permissive - most transitions are valid because:
 * - A breakdown can happen from any state
 * - Operator can start/stop for various reasons
 * - External factors (starving/blocking) can occur anytime
 *
 * @module
 */

import { Graph, Option } from 'effect'
import type { StateType } from '../../schemas/equipment-state/schema'

// =============================================================================
// Types
// =============================================================================

/** Equipment state nodes (ISA-95 / OEE standard) */
export type EquipmentStateNode =
  | 'running'
  | 'idle'
  | 'planned_downtime'
  | 'unplanned_downtime'
  | 'setup'
  | 'blocked'

/** Equipment state transition actions */
export type EquipmentTransitionAction =
  | 'StartProduction'
  | 'StopProduction'
  | 'StartPlannedDowntime'
  | 'EndPlannedDowntime'
  | 'ReportBreakdown'
  | 'RecoverFromBreakdown'
  | 'StartSetup'
  | 'CompleteSetup'
  | 'Starve'
  | 'Block'
  | 'Unblock'
  | 'Unstarve'

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<EquipmentStateNode, Graph.NodeIndex> = {} as Record<EquipmentStateNode, Graph.NodeIndex>

/**
 * Equipment State Graph
 *
 * Directed graph representing valid state transitions.
 * Generally permissive - equipment can transition between most states
 * due to real-world operational needs.
 */
export const equipmentStateGraph = Graph.directed<EquipmentStateNode, EquipmentTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.running = Graph.addNode(mutable, 'running')
  nodeIndices.idle = Graph.addNode(mutable, 'idle')
  nodeIndices.planned_downtime = Graph.addNode(mutable, 'planned_downtime')
  nodeIndices.unplanned_downtime = Graph.addNode(mutable, 'unplanned_downtime')
  nodeIndices.setup = Graph.addNode(mutable, 'setup')
  nodeIndices.blocked = Graph.addNode(mutable, 'blocked')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RUNNING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.idle, 'StopProduction')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.planned_downtime, 'StartPlannedDowntime')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.unplanned_downtime, 'ReportBreakdown')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.setup, 'StartSetup')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.blocked, 'Block')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from IDLE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.running, 'StartProduction')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.planned_downtime, 'StartPlannedDowntime')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.unplanned_downtime, 'ReportBreakdown')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.setup, 'StartSetup')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.blocked, 'Starve')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from PLANNED_DOWNTIME
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.planned_downtime, nodeIndices.idle, 'EndPlannedDowntime')
  Graph.addEdge(mutable, nodeIndices.planned_downtime, nodeIndices.running, 'StartProduction')
  Graph.addEdge(mutable, nodeIndices.planned_downtime, nodeIndices.unplanned_downtime, 'ReportBreakdown')
  Graph.addEdge(mutable, nodeIndices.planned_downtime, nodeIndices.setup, 'StartSetup')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from UNPLANNED_DOWNTIME
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.unplanned_downtime, nodeIndices.idle, 'RecoverFromBreakdown')
  Graph.addEdge(mutable, nodeIndices.unplanned_downtime, nodeIndices.running, 'StartProduction')
  Graph.addEdge(mutable, nodeIndices.unplanned_downtime, nodeIndices.planned_downtime, 'StartPlannedDowntime')
  Graph.addEdge(mutable, nodeIndices.unplanned_downtime, nodeIndices.setup, 'StartSetup')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SETUP
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.setup, nodeIndices.running, 'CompleteSetup')
  Graph.addEdge(mutable, nodeIndices.setup, nodeIndices.idle, 'StopProduction')
  Graph.addEdge(mutable, nodeIndices.setup, nodeIndices.unplanned_downtime, 'ReportBreakdown')
  Graph.addEdge(mutable, nodeIndices.setup, nodeIndices.blocked, 'Starve')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from BLOCKED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.running, 'Unblock')
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.idle, 'Unstarve')
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.unplanned_downtime, 'ReportBreakdown')
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.setup, 'StartSetup')
})

/**
 * Get NodeIndex for a given equipment state.
 */
export const getNodeIndex = (state: EquipmentStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get equipment state from a NodeIndex.
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<EquipmentStateNode> => {
  return Graph.getNode(equipmentStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 */
export const isValidStateTransition = (from: EquipmentStateNode, to: EquipmentStateNode): boolean => {
  // No-op transitions not allowed
  if (from === to) return false

  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(equipmentStateGraph, fromIndex, toIndex)
}

/**
 * Check if a state transition is valid (using branded StateType).
 */
export const isValidEquipmentTransition = (from: StateType, to: StateType): boolean => {
  return isValidStateTransition(from as EquipmentStateNode, to as EquipmentStateNode)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (from: EquipmentStateNode, to: EquipmentStateNode): Option.Option<EquipmentTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  const edgeIndex = Graph.findEdge(
    equipmentStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  const edge = Graph.getEdge(equipmentStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (from: EquipmentStateNode): readonly EquipmentStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(equipmentStateGraph, fromIndex, 'outgoing')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(equipmentStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if equipment can start production from its current state. */
export const canStartProduction = (state: EquipmentStateNode): boolean => {
  return state === 'idle' || state === 'planned_downtime' || state === 'unplanned_downtime'
}

/** Check if equipment can stop production from its current state. */
export const canStopProduction = (state: EquipmentStateNode): boolean => {
  return state === 'running' || state === 'setup'
}

/** Check if equipment can enter planned downtime from its current state. */
export const canEnterPlannedDowntime = (state: EquipmentStateNode): boolean => {
  return state === 'running' || state === 'idle' || state === 'unplanned_downtime'
}

/** Check if equipment can report a breakdown from its current state. */
export const canReportBreakdown = (_state: EquipmentStateNode): boolean => {
  // Breakdown can happen from any state
  return true
}

/** Check if equipment can start setup from its current state. */
export const canStartSetup = (state: EquipmentStateNode): boolean => {
  return state === 'running' || state === 'idle' || state === 'planned_downtime' ||
         state === 'unplanned_downtime' || state === 'blocked'
}

/** Check if equipment can complete setup from its current state. */
export const canCompleteSetup = (state: EquipmentStateNode): boolean => {
  return state === 'setup'
}

/** Check if equipment can become blocked from its current state. */
export const canBecomeBlocked = (state: EquipmentStateNode): boolean => {
  return state === 'running' || state === 'idle' || state === 'setup'
}

// =============================================================================
// OEE Classification Helpers
// =============================================================================

/** Check if state contributes to OEE availability loss. */
export const isAvailabilityLoss = (state: EquipmentStateNode): boolean => {
  return state === 'planned_downtime' || state === 'unplanned_downtime'
}

/** Check if state contributes to OEE performance loss. */
export const isPerformanceLoss = (state: EquipmentStateNode): boolean => {
  return state === 'idle' || state === 'setup' || state === 'blocked'
}

/** Check if state is productive (contributes to OEE availability numerator). */
export const isProductive = (state: EquipmentStateNode): boolean => {
  return state === 'running'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** All possible equipment states */
export const ALL_STATES: readonly EquipmentStateNode[] = [
  'running',
  'idle',
  'planned_downtime',
  'unplanned_downtime',
  'setup',
  'blocked',
]

/** States that indicate equipment is down (availability loss) */
export const DOWNTIME_STATES: readonly EquipmentStateNode[] = ['planned_downtime', 'unplanned_downtime']

/** States that indicate equipment is not producing but available */
export const PERFORMANCE_LOSS_STATES: readonly EquipmentStateNode[] = ['idle', 'setup', 'blocked']
