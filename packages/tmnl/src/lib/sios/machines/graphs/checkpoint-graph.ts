/**
 * Checkpoint State Graph
 *
 * pending → ready → passed
 *                 → failed → pending (rework cycle)
 *                 → waived
 *
 * @module sios/machines/graphs/checkpoint-graph
 */

import { Graph, Option } from 'effect'

export type CheckpointStateNode =
  | 'pending'
  | 'ready'
  | 'passed'
  | 'failed'
  | 'waived'

export type CheckpointTransitionAction =
  | 'mark_ready'
  | 'pass'
  | 'fail'
  | 'waive'
  | 'rework'

const nodeIndices: Record<string, number> = {}

export const checkpointGraph = Graph.directed<CheckpointStateNode, CheckpointTransitionAction>(
  (mutable) => {
    nodeIndices.pending = Graph.addNode(mutable, 'pending')
    nodeIndices.ready = Graph.addNode(mutable, 'ready')
    nodeIndices.passed = Graph.addNode(mutable, 'passed')
    nodeIndices.failed = Graph.addNode(mutable, 'failed')
    nodeIndices.waived = Graph.addNode(mutable, 'waived')

    Graph.addEdge(mutable, nodeIndices.pending, nodeIndices.ready, 'mark_ready')
    Graph.addEdge(mutable, nodeIndices.ready, nodeIndices.passed, 'pass')
    Graph.addEdge(mutable, nodeIndices.ready, nodeIndices.failed, 'fail')
    Graph.addEdge(mutable, nodeIndices.ready, nodeIndices.waived, 'waive')
    Graph.addEdge(mutable, nodeIndices.failed, nodeIndices.pending, 'rework')
  }
)

const validTransitions: Record<string, readonly CheckpointStateNode[]> = {
  pending: ['ready'],
  ready: ['passed', 'failed', 'waived'],
  passed: [],
  failed: ['pending'],
  waived: [],
}

export const isValidTransition = (from: CheckpointStateNode, to: CheckpointStateNode): boolean =>
  validTransitions[from]?.includes(to) ?? false

export const getValidNextStates = (from: CheckpointStateNode): readonly CheckpointStateNode[] =>
  validTransitions[from] ?? []

export const isTerminalState = (s: CheckpointStateNode): boolean =>
  s === 'passed' || s === 'waived'

export const canMarkReady = (s: CheckpointStateNode) => s === 'pending'
export const canPass = (s: CheckpointStateNode) => s === 'ready'
export const canFail = (s: CheckpointStateNode) => s === 'ready'
export const canWaive = (s: CheckpointStateNode) => s === 'ready'
export const canRework = (s: CheckpointStateNode) => s === 'failed'
