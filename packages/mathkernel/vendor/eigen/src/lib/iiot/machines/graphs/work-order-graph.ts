/**
 * Work Order State Graph
 *
 * Effect Graph.directed definition for validating work order state transitions.
 * Implements FDA 21 CFR Part 11 compliant workflow with full audit trail.
 *
 * State Machine per ISA-95 Operations Management:
 * ```
 * created --> submitted --> approved --> started --> completed --> closed
 *     |            |            |            |            |
 *     v            v            v            v            v
 * cancelled    rejected    cancelled    suspended    failed
 *                                           |            |
 *                                           v            v
 *                                        resumed      closed
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'
import type { WorkOrderStatus } from '../../schemas/work-orders'

// =============================================================================
// Types
// =============================================================================

/** Work order state nodes */
export type WorkOrderStateNode =
  | 'created'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'started'
  | 'suspended'
  | 'resumed'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'closed'

/** Work order transition actions */
export type WorkOrderTransitionAction =
  | 'Submit'
  | 'Approve'
  | 'Reject'
  | 'Start'
  | 'Suspend'
  | 'Resume'
  | 'Complete'
  | 'Fail'
  | 'Cancel'
  | 'Close'

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<WorkOrderStateNode, Graph.NodeIndex> = {} as Record<WorkOrderStateNode, Graph.NodeIndex>

/**
 * Work Order State Graph
 *
 * Directed graph representing valid state transitions.
 * Nodes are work order states, edges are transition actions.
 */
export const workOrderStateGraph = Graph.directed<WorkOrderStateNode, WorkOrderTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.created = Graph.addNode(mutable, 'created')
  nodeIndices.submitted = Graph.addNode(mutable, 'submitted')
  nodeIndices.approved = Graph.addNode(mutable, 'approved')
  nodeIndices.rejected = Graph.addNode(mutable, 'rejected')
  nodeIndices.started = Graph.addNode(mutable, 'started')
  nodeIndices.suspended = Graph.addNode(mutable, 'suspended')
  nodeIndices.resumed = Graph.addNode(mutable, 'resumed')
  nodeIndices.completed = Graph.addNode(mutable, 'completed')
  nodeIndices.failed = Graph.addNode(mutable, 'failed')
  nodeIndices.cancelled = Graph.addNode(mutable, 'cancelled')
  nodeIndices.closed = Graph.addNode(mutable, 'closed')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from CREATED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.created, nodeIndices.submitted, 'Submit')
  Graph.addEdge(mutable, nodeIndices.created, nodeIndices.cancelled, 'Cancel')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SUBMITTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.submitted, nodeIndices.approved, 'Approve')
  Graph.addEdge(mutable, nodeIndices.submitted, nodeIndices.rejected, 'Reject')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from APPROVED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.approved, nodeIndices.started, 'Start')
  Graph.addEdge(mutable, nodeIndices.approved, nodeIndices.cancelled, 'Cancel')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from STARTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.started, nodeIndices.suspended, 'Suspend')
  Graph.addEdge(mutable, nodeIndices.started, nodeIndices.completed, 'Complete')
  Graph.addEdge(mutable, nodeIndices.started, nodeIndices.failed, 'Fail')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from SUSPENDED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.suspended, nodeIndices.resumed, 'Resume')
  Graph.addEdge(mutable, nodeIndices.suspended, nodeIndices.cancelled, 'Cancel')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from RESUMED (same as STARTED)
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.resumed, nodeIndices.suspended, 'Suspend')
  Graph.addEdge(mutable, nodeIndices.resumed, nodeIndices.completed, 'Complete')
  Graph.addEdge(mutable, nodeIndices.resumed, nodeIndices.failed, 'Fail')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions to CLOSED (terminal state)
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.completed, nodeIndices.closed, 'Close')
  Graph.addEdge(mutable, nodeIndices.failed, nodeIndices.closed, 'Close')
  Graph.addEdge(mutable, nodeIndices.cancelled, nodeIndices.closed, 'Close')

  // REJECTED and CLOSED are terminal states (no outgoing edges)
})

/**
 * Get NodeIndex for a given work order state.
 */
export const getNodeIndex = (state: WorkOrderStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get work order state from a NodeIndex.
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<WorkOrderStateNode> => {
  return Graph.getNode(workOrderStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 */
export const isValidStateTransition = (from: WorkOrderStateNode, to: WorkOrderStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(workOrderStateGraph, fromIndex, toIndex)
}

/**
 * Check if a state transition is valid (using branded WorkOrderStatus type).
 */
export const isValidWorkOrderTransition = (from: WorkOrderStatus, to: WorkOrderStatus): boolean => {
  return isValidStateTransition(from as WorkOrderStateNode, to as WorkOrderStateNode)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (from: WorkOrderStateNode, to: WorkOrderStateNode): Option.Option<WorkOrderTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  const edgeIndex = Graph.findEdge(
    workOrderStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  const edge = Graph.getEdge(workOrderStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (from: WorkOrderStateNode): readonly WorkOrderStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  const neighborIndices = Graph.neighborsDirected(workOrderStateGraph, fromIndex, 'outgoing')

  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(workOrderStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if a work order can be submitted from its current state. */
export const canSubmitWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'created'
}

/** Check if a work order can be approved from its current state. */
export const canApproveWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'submitted'
}

/** Check if a work order can be rejected from its current state. */
export const canRejectWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'submitted'
}

/** Check if a work order can be started from its current state. */
export const canStartWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'approved'
}

/** Check if a work order can be suspended from its current state. */
export const canSuspendWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'started' || state === 'resumed'
}

/** Check if a work order can be resumed from its current state. */
export const canResumeWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'suspended'
}

/** Check if a work order can be completed from its current state. */
export const canCompleteWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'started' || state === 'resumed'
}

/** Check if a work order can be marked as failed from its current state. */
export const canFailWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'started' || state === 'resumed'
}

/** Check if a work order can be cancelled from its current state. */
export const canCancelWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'created' || state === 'approved' || state === 'suspended'
}

/** Check if a work order can be closed from its current state. */
export const canCloseWorkOrder = (state: WorkOrderStateNode): boolean => {
  return state === 'completed' || state === 'failed' || state === 'cancelled'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: WorkOrderStateNode): boolean => {
  return state === 'rejected' || state === 'closed'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 11

/** All possible work order states */
export const ALL_STATES: readonly WorkOrderStateNode[] = [
  'created',
  'submitted',
  'approved',
  'rejected',
  'started',
  'suspended',
  'resumed',
  'completed',
  'failed',
  'cancelled',
  'closed',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly WorkOrderStateNode[] = ['rejected', 'closed']
