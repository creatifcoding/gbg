/**
 * Issue State Graph
 *
 * open → assigned → in_progress → resolved → verified → closed
 * + wont_fix (from in_progress)
 * + closed (from open — duplicate/invalid)
 *
 * @module sios/machines/graphs/issue-graph
 */

import { Graph, Option } from 'effect'

export type IssueStateNode =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'closed'
  | 'wont_fix'

export type IssueTransitionAction =
  | 'assign'
  | 'start_work'
  | 'resolve'
  | 'verify'
  | 'close'
  | 'mark_wont_fix'
  | 'close_invalid'
  | 'reopen'

const nodeIndices: Record<string, number> = {}

export const issueGraph = Graph.directed<IssueStateNode, IssueTransitionAction>(
  (mutable) => {
    nodeIndices.open = Graph.addNode(mutable, 'open')
    nodeIndices.assigned = Graph.addNode(mutable, 'assigned')
    nodeIndices.in_progress = Graph.addNode(mutable, 'in_progress')
    nodeIndices.resolved = Graph.addNode(mutable, 'resolved')
    nodeIndices.verified = Graph.addNode(mutable, 'verified')
    nodeIndices.closed = Graph.addNode(mutable, 'closed')
    nodeIndices.wont_fix = Graph.addNode(mutable, 'wont_fix')

    // Happy path
    Graph.addEdge(mutable, nodeIndices.open, nodeIndices.assigned, 'assign')
    Graph.addEdge(mutable, nodeIndices.assigned, nodeIndices.in_progress, 'start_work')
    Graph.addEdge(mutable, nodeIndices.in_progress, nodeIndices.resolved, 'resolve')
    Graph.addEdge(mutable, nodeIndices.resolved, nodeIndices.verified, 'verify')
    Graph.addEdge(mutable, nodeIndices.verified, nodeIndices.closed, 'close')

    // Shortcuts
    Graph.addEdge(mutable, nodeIndices.open, nodeIndices.closed, 'close_invalid')
    Graph.addEdge(mutable, nodeIndices.in_progress, nodeIndices.wont_fix, 'mark_wont_fix')

    // Reopen (from resolved back to in_progress)
    Graph.addEdge(mutable, nodeIndices.resolved, nodeIndices.in_progress, 'reopen')
  }
)

const validTransitions: Record<string, readonly IssueStateNode[]> = {
  open: ['assigned', 'closed'],
  assigned: ['in_progress'],
  in_progress: ['resolved', 'wont_fix'],
  resolved: ['verified', 'in_progress'],
  verified: ['closed'],
  closed: [],
  wont_fix: [],
}

export const isValidTransition = (from: IssueStateNode, to: IssueStateNode): boolean =>
  validTransitions[from]?.includes(to) ?? false

export const getValidNextStates = (from: IssueStateNode): readonly IssueStateNode[] =>
  validTransitions[from] ?? []

export const isTerminalState = (s: IssueStateNode): boolean =>
  s === 'closed' || s === 'wont_fix'

export const canAssign = (s: IssueStateNode) => s === 'open'
export const canStartWork = (s: IssueStateNode) => s === 'assigned'
export const canResolve = (s: IssueStateNode) => s === 'in_progress'
export const canVerify = (s: IssueStateNode) => s === 'resolved'
export const canClose = (s: IssueStateNode) => s === 'verified'
export const canCloseInvalid = (s: IssueStateNode) => s === 'open'
export const canMarkWontFix = (s: IssueStateNode) => s === 'in_progress'
export const canReopen = (s: IssueStateNode) => s === 'resolved'
