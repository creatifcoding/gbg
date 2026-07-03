/**
 * WorkPackage State Graph
 *
 * Graph.directed definition for validating WorkPackage lifecycle transitions.
 *
 * State Machine:
 * ```
 *  ┌─────────┐  Activate  ┌────────┐  Suspend  ┌───────────┐
 *  │ planned │──────────>│ active │──────────>│ suspended │
 *  └────┬────┘           └───┬────┘           └─────┬─────┘
 *       │                    │                      │
 *       │ Cancel             │ Complete    Resume   │
 *       ▼                    ▼              ┌───────┘
 *  (cancelled)          ┌──────────┐        │
 *                       │ complete │   ┌────▼───┐
 *                       └────┬─────┘   │ active │
 *                            │ Close   └────────┘
 *                            ▼
 *                       ┌────────┐
 *                       │ closed │ (terminal)
 *                       └────────┘
 * ```
 *
 * @module sios/machines/graphs/work-package-graph
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

export type WorkPackageStateNode =
  | 'planned'
  | 'active'
  | 'suspended'
  | 'complete'
  | 'closed'

export type WorkPackageTransitionAction =
  | 'Activate'
  | 'Suspend'
  | 'Resume'
  | 'Complete'
  | 'Close'
  | 'Cancel'

// =============================================================================
// Graph Construction
// =============================================================================

const nodeIndices: Record<WorkPackageStateNode, Graph.NodeIndex> = {} as Record<WorkPackageStateNode, Graph.NodeIndex>

export const workPackageStateGraph = Graph.directed<WorkPackageStateNode, WorkPackageTransitionAction>((mutable) => {
  // Add nodes
  nodeIndices.planned = Graph.addNode(mutable, 'planned')
  nodeIndices.active = Graph.addNode(mutable, 'active')
  nodeIndices.suspended = Graph.addNode(mutable, 'suspended')
  nodeIndices.complete = Graph.addNode(mutable, 'complete')
  nodeIndices.closed = Graph.addNode(mutable, 'closed')

  // Transitions from PLANNED
  Graph.addEdge(mutable, nodeIndices.planned, nodeIndices.active, 'Activate')

  // Transitions from ACTIVE
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.suspended, 'Suspend')
  Graph.addEdge(mutable, nodeIndices.active, nodeIndices.complete, 'Complete')

  // Transitions from SUSPENDED
  Graph.addEdge(mutable, nodeIndices.suspended, nodeIndices.active, 'Resume')

  // Transitions from COMPLETE
  Graph.addEdge(mutable, nodeIndices.complete, nodeIndices.closed, 'Close')

  // CLOSED is terminal (no outgoing edges)
})

// =============================================================================
// Lookup Helpers
// =============================================================================

export const getNodeIndex = (state: WorkPackageStateNode): Graph.NodeIndex =>
  nodeIndices[state]

export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<WorkPackageStateNode> =>
  Graph.getNode(workPackageStateGraph, index)

// =============================================================================
// Transition Validation
// =============================================================================

export const isValidTransition = (from: WorkPackageStateNode, to: WorkPackageStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return false
  return Graph.hasEdge(workPackageStateGraph, fromIndex, toIndex)
}

export const getTransitionAction = (
  from: WorkPackageStateNode,
  to: WorkPackageStateNode
): Option.Option<WorkPackageTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return Option.none()

  const edgeIndex = Graph.findEdge(
    workPackageStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )
  if (Option.isNone(edgeIndex)) return Option.none()

  const edge = Graph.getEdge(workPackageStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

export const getValidNextStates = (from: WorkPackageStateNode): readonly WorkPackageStateNode[] => {
  const fromIndex = nodeIndices[from]
  if (fromIndex === undefined) return []

  const neighborIndices = Graph.neighborsDirected(workPackageStateGraph, fromIndex, 'outgoing')
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(workPackageStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

export const canActivate = (state: WorkPackageStateNode): boolean => state === 'planned'
export const canSuspend = (state: WorkPackageStateNode): boolean => state === 'active'
export const canResume = (state: WorkPackageStateNode): boolean => state === 'suspended'
export const canComplete = (state: WorkPackageStateNode): boolean => state === 'active'
export const canClose = (state: WorkPackageStateNode): boolean => state === 'complete'
export const isTerminalState = (state: WorkPackageStateNode): boolean => state === 'closed'

// =============================================================================
// Graph Metadata
// =============================================================================

export const STATE_COUNT = 5
export const TRANSITION_COUNT = 5
export const ALL_STATES: readonly WorkPackageStateNode[] = ['planned', 'active', 'suspended', 'complete', 'closed']
export const TERMINAL_STATES: readonly WorkPackageStateNode[] = ['closed']
