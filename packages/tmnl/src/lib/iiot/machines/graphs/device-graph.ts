/**
 * Device State Graph
 *
 * Effect Graph.directed definition for validating device lifecycle
 * state transitions. Implements ISA-95 asset hierarchy for IoT/IIoT
 * devices including controllers, actuators, and communication modules.
 *
 * State Machine per ISA-95 Device Lifecycle:
 * ```
 *                    ┌──────────────┐
 *                    │ provisioned  │
 *                    └──────┬───────┘
 *                           │ GoOnline
 *                           v
 *                  ┌─── online ───┐
 *                  │    ↑    ↓    │
 *              GoOnline  GoOffline│
 *                  │    ↑    ↓    │
 *                  └── offline ───┘
 *                       │    │
 *             MarkFaulted│    │MarkFaulted
 *                       ↓    ↓
 *                     faulted
 *                       │
 *                  ClearFault
 *                       │
 *                       v
 *                     offline
 *
 *     online/offline ──StartFirmwareUpdate──→ firmware_update
 *     firmware_update ──CompleteFirmwareUpdate──→ online
 *     firmware_update ──FailFirmwareUpdate──→ offline
 *
 *     offline/faulted ──Decommission──→ decommissioned
 * ```
 *
 * @module
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

/** Device state nodes (ISA-95 device lifecycle) */
export type DeviceStateNode =
  | 'provisioned'
  | 'online'
  | 'offline'
  | 'faulted'
  | 'firmware_update'
  | 'decommissioned'

/** Device transition actions */
export type DeviceTransitionAction =
  | 'GoOnline'
  | 'GoOffline'
  | 'MarkFaulted'
  | 'ClearFault'
  | 'StartFirmwareUpdate'
  | 'CompleteFirmwareUpdate'
  | 'FailFirmwareUpdate'
  | 'Decommission'

/** Node index map for quick lookup */
export interface DeviceNodeMap {
  readonly provisioned: Graph.NodeIndex
  readonly online: Graph.NodeIndex
  readonly offline: Graph.NodeIndex
  readonly faulted: Graph.NodeIndex
  readonly firmware_update: Graph.NodeIndex
  readonly decommissioned: Graph.NodeIndex
}

// =============================================================================
// Graph Construction
// =============================================================================

/** State to NodeIndex mapping (populated during graph construction) */
const nodeIndices: Record<DeviceStateNode, Graph.NodeIndex> = {} as Record<DeviceStateNode, Graph.NodeIndex>

/**
 * Device State Graph
 *
 * Directed graph representing valid state transitions.
 * Nodes are device states, edges are transition actions.
 */
export const deviceStateGraph = Graph.directed<DeviceStateNode, DeviceTransitionAction>((mutable) => {
  // Add nodes for each state
  nodeIndices.provisioned = Graph.addNode(mutable, 'provisioned')
  nodeIndices.online = Graph.addNode(mutable, 'online')
  nodeIndices.offline = Graph.addNode(mutable, 'offline')
  nodeIndices.faulted = Graph.addNode(mutable, 'faulted')
  nodeIndices.firmware_update = Graph.addNode(mutable, 'firmware_update')
  nodeIndices.decommissioned = Graph.addNode(mutable, 'decommissioned')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from PROVISIONED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.provisioned, nodeIndices.online, 'GoOnline')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from ONLINE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.online, nodeIndices.offline, 'GoOffline')
  Graph.addEdge(mutable, nodeIndices.online, nodeIndices.faulted, 'MarkFaulted')
  Graph.addEdge(mutable, nodeIndices.online, nodeIndices.firmware_update, 'StartFirmwareUpdate')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from OFFLINE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.online, 'GoOnline')
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.faulted, 'MarkFaulted')
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.firmware_update, 'StartFirmwareUpdate')
  Graph.addEdge(mutable, nodeIndices.offline, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from FAULTED
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.offline, 'ClearFault')
  Graph.addEdge(mutable, nodeIndices.faulted, nodeIndices.decommissioned, 'Decommission')

  // ─────────────────────────────────────────────────────────────────────────
  // Transitions from FIRMWARE_UPDATE
  // ─────────────────────────────────────────────────────────────────────────
  Graph.addEdge(mutable, nodeIndices.firmware_update, nodeIndices.online, 'CompleteFirmwareUpdate')
  Graph.addEdge(mutable, nodeIndices.firmware_update, nodeIndices.offline, 'FailFirmwareUpdate')

  // DECOMMISSIONED is a terminal state (no outgoing edges)
})

/**
 * Get NodeIndex for a given device state.
 *
 * @param state - The device state
 * @returns The NodeIndex for graph operations
 */
export const getNodeIndex = (state: DeviceStateNode): Graph.NodeIndex => {
  return nodeIndices[state]
}

/**
 * Get device state from a NodeIndex.
 *
 * @param index - The NodeIndex
 * @returns The device state, or None if index is invalid
 */
export const getStateFromIndex = (index: Graph.NodeIndex): Option.Option<DeviceStateNode> => {
  return Graph.getNode(deviceStateGraph, index)
}

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 *
 * Uses Graph.hasEdge for O(1) lookup after graph construction.
 *
 * @param from - Current device state
 * @param to - Desired next state
 * @returns true if the transition is valid
 */
export const isValidStateTransition = (from: DeviceStateNode, to: DeviceStateNode): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return false
  }

  return Graph.hasEdge(deviceStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 *
 * @param from - Current device state
 * @param to - Desired next state
 * @returns The action name, or None if transition is invalid
 */
export const getTransitionAction = (from: DeviceStateNode, to: DeviceStateNode): Option.Option<DeviceTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]

  if (fromIndex === undefined || toIndex === undefined) {
    return Option.none()
  }

  // Find edge between the two nodes
  const edgeIndex = Graph.findEdge(
    deviceStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex
  )

  if (Option.isNone(edgeIndex)) {
    return Option.none()
  }

  // Get the edge data (action name)
  const edge = Graph.getEdge(deviceStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 *
 * @param from - Current device state
 * @returns Array of valid next states
 */
export const getValidNextStates = (from: DeviceStateNode): readonly DeviceStateNode[] => {
  const fromIndex = nodeIndices[from]

  if (fromIndex === undefined) {
    return []
  }

  // Get outgoing neighbor indices
  const neighborIndices = Graph.neighborsDirected(deviceStateGraph, fromIndex, 'outgoing')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(deviceStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

/**
 * Get all states that can transition to a given state.
 *
 * @param to - Target device state
 * @returns Array of states that can reach this state
 */
export const getValidPreviousStates = (to: DeviceStateNode): readonly DeviceStateNode[] => {
  const toIndex = nodeIndices[to]

  if (toIndex === undefined) {
    return []
  }

  // Get incoming neighbor indices
  const neighborIndices = Graph.neighborsDirected(deviceStateGraph, toIndex, 'incoming')

  // Map indices back to states
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(deviceStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Check if a device can go online from its current state. */
export const canGoOnline = (state: DeviceStateNode): boolean => {
  return state === 'provisioned' || state === 'offline'
}

/** Check if a device can go offline from its current state. */
export const canGoOffline = (state: DeviceStateNode): boolean => {
  return state === 'online'
}

/** Check if a device can be marked as faulted from its current state. */
export const canMarkFaulted = (state: DeviceStateNode): boolean => {
  return state === 'online' || state === 'offline'
}

/** Check if a device fault can be cleared from its current state. */
export const canClearFault = (state: DeviceStateNode): boolean => {
  return state === 'faulted'
}

/** Check if a device can start a firmware update from its current state. */
export const canStartFirmwareUpdate = (state: DeviceStateNode): boolean => {
  return state === 'online' || state === 'offline'
}

/** Check if a firmware update can be completed from its current state. */
export const canCompleteFirmwareUpdate = (state: DeviceStateNode): boolean => {
  return state === 'firmware_update'
}

/** Check if a firmware update can fail from its current state. */
export const canFailFirmwareUpdate = (state: DeviceStateNode): boolean => {
  return state === 'firmware_update'
}

/** Check if a device can be decommissioned from its current state. */
export const canDecommission = (state: DeviceStateNode): boolean => {
  return state === 'offline' || state === 'faulted'
}

/** Check if a state is terminal (no outgoing transitions). */
export const isTerminalState = (state: DeviceStateNode): boolean => {
  return state === 'decommissioned'
}

// =============================================================================
// Graph Metadata
// =============================================================================

/** Total number of states in the graph */
export const STATE_COUNT = 6

/** Total number of valid transitions in the graph */
export const TRANSITION_COUNT = 12

/** All possible device states */
export const ALL_STATES: readonly DeviceStateNode[] = [
  'provisioned',
  'online',
  'offline',
  'faulted',
  'firmware_update',
  'decommissioned',
]

/** Terminal states (no outgoing transitions) */
export const TERMINAL_STATES: readonly DeviceStateNode[] = ['decommissioned']
