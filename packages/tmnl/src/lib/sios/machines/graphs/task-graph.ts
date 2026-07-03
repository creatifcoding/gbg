/**
 * Task State Graph
 *
 * Graph.directed for the 7-state task lifecycle.
 *
 * ```
 *  ┌─────────┐  Start  ┌────────┐  Suspend  ┌───────────┐
 *  │ pending │───────>│ active │──────────>│ suspended │
 *  └────┬────┘        └───┬────┘           └─────┬─────┘
 *       │                 │ │ │                   │
 *       │ Cancel          │ │ │ Block    Resume   │
 *       ▼                 │ │ ▼          ┌────────┘
 *  (cancelled)            │ │ ┌─────────┐│
 *                         │ │ │ blocked │─┘ → Unblock → active
 *                         │ │ └─────────┘
 *                         │ │
 *                         │ │ RequestEvidence (if requiresEvidence)
 *                         │ ▼
 *                         │ ┌─────────────────┐  SubmitEvidence
 *                         │ │ needs_evidence  │──────────────> done
 *                         │ └────────┬────────┘
 *                         │          │ RejectEvidence → active
 *                         │
 *                         │ Complete (if !requiresEvidence)
 *                         ▼
 *                      ┌──────┐
 *                      │ done │ (terminal)
 *                      └──────┘
 * ```
 *
 * @module sios/machines/graphs/task-graph
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

export type TaskStateNode =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'needs_evidence'
  | 'done'
  | 'blocked'
  | 'cancelled'

export type TaskTransitionAction =
  | 'Start'
  | 'Suspend'
  | 'Resume'
  | 'RequestEvidence'
  | 'SubmitEvidence'
  | 'RejectEvidence'
  | 'Complete'
  | 'Block'
  | 'Unblock'
  | 'Cancel'

// =============================================================================
// Graph Construction
// =============================================================================

const nodeIndices: Record<TaskStateNode, Graph.NodeIndex> = {} as Record<TaskStateNode, Graph.NodeIndex>

export const taskStateGraph = Graph.directed<TaskStateNode, TaskTransitionAction>((mutable) => {
  nodeIndices.pending = Graph.addNode(mutable, 'pending')
  nodeIndices.active = Graph.addNode(mutable, 'active')
  nodeIndices.suspended = Graph.addNode(mutable, 'suspended')
  nodeIndices.needs_evidence = Graph.addNode(mutable, 'needs_evidence')
  nodeIndices.done = Graph.addNode(mutable, 'done')
  nodeIndices.blocked = Graph.addNode(mutable, 'blocked')
  nodeIndices.cancelled = Graph.addNode(mutable, 'cancelled')

  // From PENDING
  Graph.addEdge(mutable, nodeIndices.pending, nodeIndices.active, 'Start')
  Graph.addEdge(mutable, nodeIndices.pending, nodeIndices.cancelled, 'Cancel')

  // From ACTIVE
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.suspended, 'Suspend')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.needs_evidence, 'RequestEvidence')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.done, 'Complete')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.blocked, 'Block')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.cancelled, 'Cancel')

  // From SUSPENDED
  Graph.addEdge(mutable, nodeIndices.suspended, nodeIndices.active, 'Resume')
  Graph.addEdge(mutable, nodeIndices.suspended, nodeIndices.cancelled, 'Cancel')

  // From NEEDS_EVIDENCE
  Graph.addEdge(mutable, nodeIndices.needs_evidence, nodeIndices.done, 'SubmitEvidence')
  Graph.addEdge(mutable, nodeIndices.needs_evidence, nodeIndices.active, 'RejectEvidence')

  // From BLOCKED
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.active, 'Unblock')
  Graph.addEdge(mutable, nodeIndices.blocked, nodeIndices.cancelled, 'Cancel')

  // DONE and CANCELLED are terminal (no outgoing edges)
})

// =============================================================================
// Lookup Helpers
// =============================================================================

export const getNodeIndex = (state: TaskStateNode): Graph.NodeIndex =>
  nodeIndices[state]

export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<TaskStateNode> =>
  Graph.getNode(taskStateGraph, index)

// =============================================================================
// Transition Validation
// =============================================================================

export const isValidTransition = (from: TaskStateNode, to: TaskStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return false
  return Graph.hasEdge(taskStateGraph, fromIndex, toIndex)
}

export const getTransitionAction = (
  from: TaskStateNode,
  to: TaskStateNode
): Option.Option<TaskTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return Option.none()

  const edgeIndex = Graph.findEdge(
    taskStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )
  if (Option.isNone(edgeIndex)) return Option.none()

  const edge = Graph.getEdge(taskStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

export const getValidNextStates = (from: TaskStateNode): readonly TaskStateNode[] => {
  const fromIndex = nodeIndices[from]
  if (fromIndex === undefined) return []

  const neighborIndices = Graph.neighborsDirected(taskStateGraph, fromIndex, 'outgoing')
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(taskStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

export const getValidPreviousStates = (to: TaskStateNode): readonly TaskStateNode[] => {
  const toIndex = nodeIndices[to]
  if (toIndex === undefined) return []

  const neighborIndices = Graph.neighborsDirected(taskStateGraph, toIndex, 'incoming')
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(taskStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

export const canStart = (state: TaskStateNode): boolean => state === 'pending'
export const canSuspend = (state: TaskStateNode): boolean => state === 'active'
export const canResume = (state: TaskStateNode): boolean => state === 'suspended'
export const canRequestEvidence = (state: TaskStateNode): boolean => state === 'active'
export const canSubmitEvidence = (state: TaskStateNode): boolean => state === 'needs_evidence'
export const canRejectEvidence = (state: TaskStateNode): boolean => state === 'needs_evidence'
export const canComplete = (state: TaskStateNode): boolean => state === 'active'
export const canBlock = (state: TaskStateNode): boolean => state === 'active'
export const canUnblock = (state: TaskStateNode): boolean => state === 'blocked'
export const canCancel = (state: TaskStateNode): boolean =>
  state === 'pending' || state === 'active' || state === 'suspended' || state === 'blocked'

export const isTerminalState = (state: TaskStateNode): boolean =>
  state === 'done' || state === 'cancelled'

// =============================================================================
// Graph Metadata
// =============================================================================

export const STATE_COUNT = 7
export const TRANSITION_COUNT = 14
export const ALL_STATES: readonly TaskStateNode[] = [
  'pending', 'active', 'suspended', 'needs_evidence', 'done', 'blocked', 'cancelled'
]
export const TERMINAL_STATES: readonly TaskStateNode[] = ['done', 'cancelled']
