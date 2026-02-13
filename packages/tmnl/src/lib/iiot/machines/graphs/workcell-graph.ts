/**
 * Workcell State Graph
 *
 * Effect Graph.directed definition for validating workcell state transitions.
 * Implements ISA-95 asset hierarchy — workcell-level operational states.
 *
 * A workcell (or work center) is the lowest schedulable unit in ISA-95,
 * representing a single machine, robot cell, or manual workstation.
 *
 * State Machine:
 * ```
 *           ┌──────────────────────────────────┐
 *           │                                  │
 *           ▼          BeginSetup              │ Stop
 *     ┌──────────┐ ───────────> ┌──────────┐  │
 *     │   idle   │              │  setup   │  │
 *     └──┬───┬───┘              └────┬─────┘  │
 *        │   │                       │ CompleteSetup
 *        │   │ EnterMaint.           ▼
 *        │   │               ┌──────────┐
 *        │   │               │ running  │──────┘
 *        │   │               └──┬──┬────┘
 *        │   │                  │  │
 *        │   │    MarkBlocked   │  │ MarkFaulted
 *        │   │                  ▼  ▼
 *        │   │          ┌─────────┐ ┌─────────┐
 *        │   │          │ blocked │ │ faulted │
 *        │   │          └────┬────┘ └────┬────┘
 *        │   │   ClearBlocked│  ClearFault│
 *        │   │               ▼            ▼
 *        │   │            running        idle
 *        │   │                            ▲
 *        │   ▼                            │
 *        │  ┌─────────────┐  CompleteMaint│
 *        │  │ maintenance │───────────────┘
 *        │  └──────┬──────┘
 *        │         │ Decommission
 *        │         ▼
 *        │  ┌──────────────┐
 *        └─>│decommissioned│
 *   Decom.  └──────────────┘
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Workcell state nodes (ISA-95 workcell states) */
export type WorkcellStateNode =
  | 'idle'
  | 'setup'
  | 'running'
  | 'blocked'
  | 'faulted'
  | 'maintenance'
  | 'decommissioned'

/** Workcell transition actions */
export type WorkcellTransitionAction =
  | 'BeginSetup'
  | 'CompleteSetup'
  | 'Stop'
  | 'MarkBlocked'
  | 'ClearBlocked'
  | 'MarkFaulted'
  | 'ClearFault'
  | 'EnterMaintenance'
  | 'CompleteMaintenance'
  | 'Decommission'

/** Node index map for quick lookup */
export interface WorkcellStateNodeMap {
  readonly idle: Graph.NodeIndex
  readonly setup: Graph.NodeIndex
  readonly running: Graph.NodeIndex
  readonly blocked: Graph.NodeIndex
  readonly faulted: Graph.NodeIndex
  readonly maintenance: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<WorkcellStateNode, Graph.NodeIndex> = {} as Record<WorkcellStateNode, Graph.NodeIndex>

/**
 * Workcell State Graph
 *
 * Directed graph representing valid workcell state transitions.
 * Nodes are workcell states, edges are transition actions.
 */
export const workcellStateGraph = Graph.directed<WorkcellStateNode, WorkcellTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.idle = Graph.addNode(mutable, 'idle')
  nodeIndices.setup = Graph.addNode(mutable, 'setup')
  nodeIndices.running = Graph.addNode(mutable, 'running')
  nodeIndices.blocked = Graph.addNode(mutable, 'blocked')
  nodeIndices.faulted = Graph.addNode(mutable, 'faulted')
  nodeIndices.maintenance = Graph.addNode(mutable, 'maintenance')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from IDLE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.setup, 'BeginSetup')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.maintenance, 'EnterMaintenance')
  Graph.addEdge(mutable, nodeIndices.idle, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SETUP
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.setup, nodeIndices.running, 'CompleteSetup')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RUNNING
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.idle, 'Stop')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.blocked, 'MarkBlocked')
  Graph.addEdge(mutable, nodeIndices.running, nodeIndices.faulted, 'MarkFaulted')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from BLOCKED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.running, 'ClearBlocked')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from FAULTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.idle, 'ClearFault')
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.maintenance, 'EnterMaintenance')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.idle, 'CompleteMaintenance')
  Graph.addEdge(mutable, nodeIndices.maintenance, nodeIndices.decommissioned, 'Decommission')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given workcell state.
 */
export const getNodeIndex = (state: WorkcellStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get workcell state from a NodeIndex.
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<WorkcellStateNode> => {
  return Graph.getNode(workcellStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 */
export const isValidStateTransition = (from: WorkcellStateNode, to: WorkcellStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(workcellStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (from: WorkcellStateNode, to: WorkcellStateNode): Option.Option<WorkcellTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  const edgeIndex = Graph.findEdge(
    workcellStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  const edge = Graph.getEdge(workcellStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (from: WorkcellStateNode): readonly WorkcellStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(workcellStateGraph, fromIndex, 'outgoing')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(workcellStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 */
export const getValidPreviousStates = (to: WorkcellStateNode): readonly WorkcellStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(workcellStateGraph, toIndex, 'incoming')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(workcellStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if setup can begin from the current state. */
export const canBeginSetup = (state: WorkcellStateNode): boolean => {
  return state === 'idle'
}

/** Check if setup can be completed from the current state. */
export const canCompleteSetup = (state: WorkcellStateNode): boolean => {
  return state === 'setup'
}

/** Check if the workcell can stop from its current state. */
export const canStop = (state: WorkcellStateNode): boolean => {
  return state === 'running'
}

/** Check if the workcell can be marked as blocked from the current state. */
export const canMarkBlocked = (state: WorkcellStateNode): boolean => {
  return state === 'running'
}

/** Check if the blocked condition can be cleared from the current state. */
export const canClearBlocked = (state: WorkcellStateNode): boolean => {
  return state === 'blocked'
}

/** Check if the workcell can be marked as faulted from the current state. */
export const canMarkFaulted = (state: WorkcellStateNode): boolean => {
  return state === 'running'
}

/** Check if the fault can be cleared from the current state. */
export const canClearFault = (state: WorkcellStateNode): boolean => {
  return state === 'faulted'
}

/** Check if the workcell can enter maintenance from its current state. */
export const canEnterMaintenance = (state: WorkcellStateNode): boolean => {
  return state === 'idle' || state === 'faulted'
}

/** Check if maintenance can be completed from the current state. */
export const canCompleteMaintenance = (state: WorkcellStateNode): boolean => {
  return state === 'maintenance'
}

/** Check if the workcell can be decommissioned from its current state. */
export const canDecommission = (state: WorkcellStateNode): boolean => {
  return state === 'idle' || state === 'maintenance'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: WorkcellStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 7

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 12

/** All possible workcell states */
export const ALL_STATES: readonly WorkcellStateNode[] = [
  'idle',
  'setup',
  'running',
  'blocked',
  'faulted',
  'maintenance',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly WorkcellStateNode[] = ['decommissioned']
