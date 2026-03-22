/**
 * Line State Graph
 *
 * Effect Graph.directed definition for validating production line state transitions.
 * Implements ISA-95 asset hierarchy — line-level operational states with OEE classification.
 *
 * State Categories for OEE:
 * - Productive: running (contributes to OEE availability numerator)
 * - Performance Loss: changeover, starved, blocked, idle
 * - Availability Loss: maintenance
 *
 * State Machine:
 * ```
 *                    ┌───Stop────┐
 *                    ▼           │
 *              ┌──────────┐  ┌──────────┐
 *              │   idle   │  │ running  │
 *              └────┬─────┘  └──┬──┬──┬─┘
 *                   │  ▲ Start  │  │  │
 *      EnterMaint.  │  └────────┘  │  │
 *                   ▼              │  │
 *           ┌─────────────┐        │  │
 *           │ maintenance │◄───────┘  │ BeginChangeover
 *           └──────┬──────┘ EnterMaint│
 *    CompleteMaint │  (emergency)     ▼
 *                  ▼           ┌─────────────┐
 *               idle           │  changeover │
 *                              └──────┬──────┘
 *                     CompleteChangeover│
 *                                      ▼
 *                                   running
 *
 *   running ──MarkStarved──> starved ──ClearStarved──> running
 *   running ──MarkBlocked──> blocked ──ClearBlocked──> running
 *
 *   idle ──Decommission──> decommissioned
 *   maintenance ──Decommission──> decommissioned
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Line state nodes (ISA-95 production line states) */
export type LineStateNode =
  | 'idle'
  | 'running'
  | 'changeover'
  | 'starved'
  | 'blocked'
  | 'maintenance'
  | 'decommissioned'

/** Line transition actions */
export type LineTransitionAction =
  | 'Start'
  | 'Stop'
  | 'BeginChangeover'
  | 'CompleteChangeover'
  | 'MarkStarved'
  | 'ClearStarved'
  | 'MarkBlocked'
  | 'ClearBlocked'
  | 'EnterMaintenance'
  | 'CompleteMaintenance'
  | 'Decommission'

/** Node index map for quick lookup */
export interface LineStateNodeMap {
  readonly idle: Graph.NodeIndex
  readonly running: Graph.NodeIndex
  readonly changeover: Graph.NodeIndex
  readonly starved: Graph.NodeIndex
  readonly blocked: Graph.NodeIndex
  readonly maintenance: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<LineStateNode, Graph.NodeIndex> = {} as Record<LineStateNode, Graph.NodeIndex>

/**
 * Line State Graph
 *
 * Directed graph representing valid production line state transitions.
 * Nodes are line states, edges are transition actions.
 */
export const lineStateGraph = Graph.directed<LineStateNode, LineTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.idle = Graph.addNode(mutable, 'idle')
  nodeIndices.running = Graph.addNode(mutable, 'running')
  nodeIndices.changeover = Graph.addNode(mutable, 'changeover')
  nodeIndices.starved = Graph.addNode(mutable, 'starved')
  nodeIndices.blocked = Graph.addNode(mutable, 'blocked')
  nodeIndices.maintenance = Graph.addNode(mutable, 'maintenance')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from IDLE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.running, 'Start')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.maintenance, 'EnterMaintenance')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RUNNING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.idle, 'Stop')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.changeover, 'BeginChangeover')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.starved, 'MarkStarved')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.blocked, 'MarkBlocked')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.maintenance, 'EnterMaintenance')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from CHANGEOVER
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.changeover, nodeIndices.running, 'CompleteChangeover')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from STARVED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.starved, nodeIndices.running, 'ClearStarved')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from BLOCKED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.running, 'ClearBlocked')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.idle, 'CompleteMaintenance')
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given line state.
 */
export const getNodeIndex = (state: LineStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get line state from a NodeIndex.
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<LineStateNode> => {
  return Graph.getNode(lineStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 */
export const isValidStateTransition = (from: LineStateNode, to: LineStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(lineStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (from: LineStateNode, to: LineStateNode): Option.Option<LineTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  const edgeIndex = Graph.findEdge(
    lineStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  const edge = Graph.getEdge(lineStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (from: LineStateNode): readonly LineStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(lineStateGraph, fromIndex, 'outgoing')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(lineStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 */
export const getValidPreviousStates = (to: LineStateNode): readonly LineStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(lineStateGraph, toIndex, 'incoming')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(lineStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if the line can start from its current state. */
export const canStart = (state: LineStateNode): boolean => {
  return state === 'idle'
}

/** Check if the line can stop from its current state. */
export const canStop = (state: LineStateNode): boolean => {
  return state === 'running'
}

/** Check if a changeover can begin from the current state. */
export const canBeginChangeover = (state: LineStateNode): boolean => {
  return state === 'running'
}

/** Check if a changeover can be completed from the current state. */
export const canCompleteChangeover = (state: LineStateNode): boolean => {
  return state === 'changeover'
}

/** Check if the line can be marked as starved from the current state. */
export const canMarkStarved = (state: LineStateNode): boolean => {
  return state === 'running'
}

/** Check if the starved condition can be cleared from the current state. */
export const canClearStarved = (state: LineStateNode): boolean => {
  return state === 'starved'
}

/** Check if the line can be marked as blocked from the current state. */
export const canMarkBlocked = (state: LineStateNode): boolean => {
  return state === 'running'
}

/** Check if the blocked condition can be cleared from the current state. */
export const canClearBlocked = (state: LineStateNode): boolean => {
  return state === 'blocked'
}

/** Check if the line can enter maintenance from its current state. */
export const canEnterMaintenance = (state: LineStateNode): boolean => {
  return state === 'idle' || state === 'running'
}

/** Check if maintenance can be completed from the current state. */
export const canCompleteMaintenance = (state: LineStateNode): boolean => {
  return state === 'maintenance'
}

/** Check if the line can be decommissioned from its current state. */
export const canDecommission = (state: LineStateNode): boolean => {
  return state === 'idle' || state === 'maintenance'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: LineStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// OEE Classification Helpers
// =============================================================================

/** Check if state is productive (contributes to OEE availability numerator). */
export const isProductive = (state: LineStateNode): boolean => {
  return state === 'running'
}

/** Check if state contributes to OEE performance loss. */
export const isPerformanceLoss = (state: LineStateNode): boolean => {
  return state === 'changeover' || state === 'starved' || state === 'blocked' || state === 'idle'
}

/** Check if state contributes to OEE availability loss. */
export const isAvailabilityLoss = (state: LineStateNode): boolean => {
  return state === 'maintenance'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 7

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 13

/** All possible line states */
export const ALL_STATES: readonly LineStateNode[] = [
  'idle',
  'running',
  'changeover',
  'starved',
  'blocked',
  'maintenance',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly LineStateNode[] = ['decommissioned']

/** States that indicate performance loss */
export const PERFORMANCE_LOSS_STATES: readonly LineStateNode[] = ['changeover', 'starved', 'blocked', 'idle']

/** States that indicate availability loss */
export const AVAILABILITY_LOSS_STATES: readonly LineStateNode[] = ['maintenance']
