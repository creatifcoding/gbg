/**
 * Worker State Graph
 *
 * active ↔ on_leave
 * active → badge_pending → active
 * active → badge_expired (auto-detected)
 * active → cert_expired (auto-detected)
 * any → offboarded (terminal)
 *
 * @module sios/machines/graphs/worker-graph
 */

import { Graph, Option } from 'effect'

export type WorkerStateNode =
  | 'active'
  | 'on_leave'
  | 'badge_pending'
  | 'badge_expired'
  | 'cert_expired'
  | 'offboarded'

export type WorkerTransitionAction =
  | 'go_on_leave'
  | 'return_from_leave'
  | 'request_badge'
  | 'issue_badge'
  | 'expire_badge'
  | 'expire_cert'
  | 'renew_badge'
  | 'renew_cert'
  | 'offboard'

const nodeIndices: Record<string, number> = {}

export const workerGraph = Graph.directed<WorkerStateNode, WorkerTransitionAction>(
  (mutable) => {
    nodeIndices.active = Graph.addNode(mutable, 'active')
    nodeIndices.on_leave = Graph.addNode(mutable, 'on_leave')
    nodeIndices.badge_pending = Graph.addNode(mutable, 'badge_pending')
    nodeIndices.badge_expired = Graph.addNode(mutable, 'badge_expired')
    nodeIndices.cert_expired = Graph.addNode(mutable, 'cert_expired')
    nodeIndices.offboarded = Graph.addNode(mutable, 'offboarded')

    // Leave
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.on_leave, 'go_on_leave')
    Graph.addEdge(mutable, nodeIndices.on_leave, nodeIndices.active, 'return_from_leave')

    // Badge lifecycle
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.badge_pending, 'request_badge')
    Graph.addEdge(mutable, nodeIndices.badge_pending, nodeIndices.active, 'issue_badge')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.badge_expired, 'expire_badge')
    Graph.addEdge(mutable, nodeIndices.badge_expired, nodeIndices.active, 'renew_badge')

    // Cert lifecycle
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.cert_expired, 'expire_cert')
    Graph.addEdge(mutable, nodeIndices.cert_expired, nodeIndices.active, 'renew_cert')

    // Offboard (from any non-terminal)
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.offboarded, 'offboard')
    Graph.addEdge(mutable, nodeIndices.on_leave, nodeIndices.offboarded, 'offboard')
    Graph.addEdge(mutable, nodeIndices.badge_pending, nodeIndices.offboarded, 'offboard')
    Graph.addEdge(mutable, nodeIndices.badge_expired, nodeIndices.offboarded, 'offboard')
    Graph.addEdge(mutable, nodeIndices.cert_expired, nodeIndices.offboarded, 'offboard')
  }
)

const validTransitions: Record<string, readonly WorkerStateNode[]> = {
  active: ['on_leave', 'badge_pending', 'badge_expired', 'cert_expired', 'offboarded'],
  on_leave: ['active', 'offboarded'],
  badge_pending: ['active', 'offboarded'],
  badge_expired: ['active', 'offboarded'],
  cert_expired: ['active', 'offboarded'],
  offboarded: [],
}

export const isValidTransition = (from: WorkerStateNode, to: WorkerStateNode): boolean =>
  validTransitions[from]?.includes(to) ?? false

export const getValidNextStates = (from: WorkerStateNode): readonly WorkerStateNode[] =>
  validTransitions[from] ?? []

export const isTerminalState = (s: WorkerStateNode): boolean => s === 'offboarded'

export const canGoOnLeave = (s: WorkerStateNode) => s === 'active'
export const canReturnFromLeave = (s: WorkerStateNode) => s === 'on_leave'
export const canRequestBadge = (s: WorkerStateNode) => s === 'active'
export const canIssueBadge = (s: WorkerStateNode) => s === 'badge_pending'
export const canExpireBadge = (s: WorkerStateNode) => s === 'active'
export const canRenewBadge = (s: WorkerStateNode) => s === 'badge_expired'
export const canExpireCert = (s: WorkerStateNode) => s === 'active'
export const canRenewCert = (s: WorkerStateNode) => s === 'cert_expired'
export const canOffboard = (s: WorkerStateNode) => s !== 'offboarded'
