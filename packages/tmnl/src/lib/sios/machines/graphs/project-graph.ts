/**
 * Project State Graph
 *
 * bidding → awarded → mobilising → active → commissioning → complete
 * + on_hold (bidirectional from mobilising/active/commissioning)
 * + cancelled (from bidding only)
 *
 * @module sios/machines/graphs/project-graph
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

export type ProjectStateNode =
  | 'bidding'
  | 'awarded'
  | 'mobilising'
  | 'active'
  | 'commissioning'
  | 'complete'
  | 'on_hold'
  | 'cancelled'

export type ProjectTransitionAction =
  | 'award'
  | 'mobilise'
  | 'activate'
  | 'commission'
  | 'complete'
  | 'hold'
  | 'resume'
  | 'cancel'

// =============================================================================
// Graph
// =============================================================================

const nodeIndices: Record<string, number> = {}

export const projectGraph = Graph.directed<ProjectStateNode, ProjectTransitionAction>(
  (mutable) => {
    // Nodes
    nodeIndices.bidding = Graph.addNode(mutable, 'bidding')
    nodeIndices.awarded = Graph.addNode(mutable, 'awarded')
    nodeIndices.mobilising = Graph.addNode(mutable, 'mobilising')
    nodeIndices.active = Graph.addNode(mutable, 'active')
    nodeIndices.commissioning = Graph.addNode(mutable, 'commissioning')
    nodeIndices.complete = Graph.addNode(mutable, 'complete')
    nodeIndices.on_hold = Graph.addNode(mutable, 'on_hold')
    nodeIndices.cancelled = Graph.addNode(mutable, 'cancelled')

    // Happy path
    Graph.addEdge(mutable, nodeIndices.bidding, nodeIndices.awarded, 'award')
    Graph.addEdge(mutable, nodeIndices.awarded, nodeIndices.mobilising, 'mobilise')
    Graph.addEdge(mutable, nodeIndices.mobilising, nodeIndices.active, 'activate')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.commissioning, 'commission')
    Graph.addEdge(mutable, nodeIndices.commissioning, nodeIndices.complete, 'complete')

    // Hold (bidirectional from mobilising/active/commissioning)
    Graph.addEdge(mutable, nodeIndices.mobilising, nodeIndices.on_hold, 'hold')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.on_hold, 'hold')
    Graph.addEdge(mutable, nodeIndices.commissioning, nodeIndices.on_hold, 'hold')
    Graph.addEdge(mutable, nodeIndices.on_hold, nodeIndices.mobilising, 'resume')
    Graph.addEdge(mutable, nodeIndices.on_hold, nodeIndices.active, 'resume')
    Graph.addEdge(mutable, nodeIndices.on_hold, nodeIndices.commissioning, 'resume')

    // Cancel (only from bidding)
    Graph.addEdge(mutable, nodeIndices.bidding, nodeIndices.cancelled, 'cancel')
  }
)

// =============================================================================
// Validators
// =============================================================================

const validTransitions: Record<string, readonly ProjectStateNode[]> = {
  bidding: ['awarded', 'cancelled'],
  awarded: ['mobilising'],
  mobilising: ['active', 'on_hold'],
  active: ['commissioning', 'on_hold'],
  commissioning: ['complete', 'on_hold'],
  complete: [],
  on_hold: ['mobilising', 'active', 'commissioning'],
  cancelled: [],
}

export const isValidTransition = (
  from: ProjectStateNode,
  to: ProjectStateNode
): boolean => validTransitions[from]?.includes(to) ?? false

export const getValidNextStates = (
  from: ProjectStateNode
): readonly ProjectStateNode[] => validTransitions[from] ?? []

export const isTerminalState = (s: ProjectStateNode): boolean =>
  s === 'complete' || s === 'cancelled'

// Per-action validators
export const canAward = (s: ProjectStateNode) => s === 'bidding'
export const canMobilise = (s: ProjectStateNode) => s === 'awarded'
export const canActivate = (s: ProjectStateNode) => s === 'mobilising'
export const canCommission = (s: ProjectStateNode) => s === 'active'
export const canComplete = (s: ProjectStateNode) => s === 'commissioning'
export const canHold = (s: ProjectStateNode) =>
  s === 'mobilising' || s === 'active' || s === 'commissioning'
export const canResume = (s: ProjectStateNode) => s === 'on_hold'
export const canCancel = (s: ProjectStateNode) => s === 'bidding'
