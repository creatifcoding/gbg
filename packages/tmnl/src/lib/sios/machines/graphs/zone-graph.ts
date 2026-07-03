/**
 * Zone State Graph
 *
 * defined → active → commissioning → handed_over
 * + on_hold (bidirectional from defined/active)
 *
 * @module sios/machines/graphs/zone-graph
 */

import { Graph, Option } from 'effect'

export type ZoneStateNode =
  | 'defined'
  | 'active'
  | 'commissioning'
  | 'handed_over'
  | 'on_hold'

export type ZoneTransitionAction =
  | 'activate'
  | 'commission'
  | 'handover'
  | 'hold'
  | 'resume'

const nodeIndices: Record<string, number> = {}

export const zoneGraph = Graph.directed<ZoneStateNode, ZoneTransitionAction>(
  (mutable) => {
    nodeIndices.defined = Graph.addNode(mutable, 'defined')
    nodeIndices.active = Graph.addNode(mutable, 'active')
    nodeIndices.commissioning = Graph.addNode(mutable, 'commissioning')
    nodeIndices.handed_over = Graph.addNode(mutable, 'handed_over')
    nodeIndices.on_hold = Graph.addNode(mutable, 'on_hold')

    // Happy path
    Graph.addEdge(mutable, nodeIndices.defined, nodeIndices.active, 'activate')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.commissioning, 'commission')
    Graph.addEdge(mutable, nodeIndices.commissioning, nodeIndices.handed_over, 'handover')

    // Hold
    Graph.addEdge(mutable, nodeIndices.defined, nodeIndices.on_hold, 'hold')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.on_hold, 'hold')
    Graph.addEdge(mutable, nodeIndices.on_hold, nodeIndices.defined, 'resume')
    Graph.addEdge(mutable, nodeIndices.on_hold, nodeIndices.active, 'resume')
  }
)

const validTransitions: Record<string, readonly ZoneStateNode[]> = {
  defined: ['active', 'on_hold'],
  active: ['commissioning', 'on_hold'],
  commissioning: ['handed_over'],
  handed_over: [],
  on_hold: ['defined', 'active'],
}

export const isValidTransition = (from: ZoneStateNode, to: ZoneStateNode): boolean =>
  validTransitions[from]?.includes(to) ?? false

export const getValidNextStates = (from: ZoneStateNode): readonly ZoneStateNode[] =>
  validTransitions[from] ?? []

export const isTerminalState = (s: ZoneStateNode): boolean =>
  s === 'handed_over'

export const canActivate = (s: ZoneStateNode) => s === 'defined'
export const canCommission = (s: ZoneStateNode) => s === 'active'
export const canHandover = (s: ZoneStateNode) => s === 'commissioning'
export const canHold = (s: ZoneStateNode) => s === 'defined' || s === 'active'
export const canResume = (s: ZoneStateNode) => s === 'on_hold'
