/**
 * Day Lifecycle State Graph
 *
 * Effect Graph.directed definition for validating day state transitions.
 * Mirrors the IIoT alarm-state-graph.ts pattern exactly.
 *
 * State Machine:
 * ```
 *     ┌─────────┐  Activate   ┌─────────┐
 *     │  empty  │────────────▶│ active  │
 *     └─────────┘             └────┬────┘
 *          ▲ Clear                 │ Enrich
 *          │                       ▼
 *          │                  ┌─────────┐
 *          │                  │  rich   │
 *          │                  └────┬────┘
 *          │    Simplify ──────────┘
 *          │         │
 *          │         │    Archive ──────┐
 *          │         │                  ▼
 *          │         │         ┌──────────┐
 *          │         └────────▶│ archived │
 *          │                   └────┬─────┘
 *          │    Unarchive ──────────┘
 *          │         │
 *          │         ▼
 *          │    (returns to active or rich based on content)
 *          │
 *          └──── (Archive from active also valid)
 * ```
 *
 * @module @chronicle/machines/graphs/day-state-graph
 * @see src/lib/iiot/machines/graphs/alarm-state-graph.ts — canonical pattern
 */

import { Graph, Option } from 'effect'

// =============================================================================
// Types
// =============================================================================

export type DayStateNode = 'empty' | 'active' | 'rich' | 'archived'

export type DayTransitionAction =
  | 'Activate'    // empty → active (first content added)
  | 'Enrich'      // active → rich (2+ content types)
  | 'Simplify'    // rich → active (content removed, single type remains)
  | 'Clear'       // active → empty (all content removed)
  | 'Archive'     // active|rich → archived
  | 'Unarchive'   // archived → active|rich

// =============================================================================
// Graph Construction
// =============================================================================

const nodeIndices: Record<DayStateNode, Graph.NodeIndex> = {} as Record<
  DayStateNode,
  Graph.NodeIndex
>

/**
 * Day Lifecycle State Graph
 *
 * Directed graph representing valid day state transitions.
 * Nodes are day states, edges are transition actions.
 */
export const dayStateGraph = Graph.directed<DayStateNode, DayTransitionAction>(
  (mutable) => {
    // Add nodes
    nodeIndices.empty = Graph.addNode(mutable, 'empty')
    nodeIndices.active = Graph.addNode(mutable, 'active')
    nodeIndices.rich = Graph.addNode(mutable, 'rich')
    nodeIndices.archived = Graph.addNode(mutable, 'archived')

    // ── Transitions from EMPTY ──────────────────────────────────────────
    Graph.addEdge(mutable, nodeIndices.empty, nodeIndices.active, 'Activate')

    // ── Transitions from ACTIVE ─────────────────────────────────────────
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.rich, 'Enrich')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.empty, 'Clear')
    Graph.addEdge(mutable, nodeIndices.active, nodeIndices.archived, 'Archive')

    // ── Transitions from RICH ───────────────────────────────────────────
    Graph.addEdge(mutable, nodeIndices.rich, nodeIndices.active, 'Simplify')
    Graph.addEdge(mutable, nodeIndices.rich, nodeIndices.archived, 'Archive')

    // ── Transitions from ARCHIVED ───────────────────────────────────────
    Graph.addEdge(mutable, nodeIndices.archived, nodeIndices.active, 'Unarchive')
    Graph.addEdge(mutable, nodeIndices.archived, nodeIndices.rich, 'Unarchive')
  },
)

// =============================================================================
// Node Index Helpers
// =============================================================================

export const getNodeIndex = (state: DayStateNode): Graph.NodeIndex =>
  nodeIndices[state]

export const getStateFromIndex = (
  index: Graph.NodeIndex,
): Option.Option<DayStateNode> =>
  Graph.getNode(dayStateGraph, index)

// =============================================================================
// Transition Validation
// =============================================================================

/**
 * Check if a state transition is valid.
 * Uses Graph.hasEdge for O(1) lookup.
 */
export const isValidDayTransition = (
  from: DayStateNode,
  to: DayStateNode,
): boolean => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return false
  return Graph.hasEdge(dayStateGraph, fromIndex, toIndex)
}

/**
 * Get the action name for a valid transition.
 */
export const getTransitionAction = (
  from: DayStateNode,
  to: DayStateNode,
): Option.Option<DayTransitionAction> => {
  const fromIndex = nodeIndices[from]
  const toIndex = nodeIndices[to]
  if (fromIndex === undefined || toIndex === undefined) return Option.none()

  const edgeIndex = Graph.findEdge(
    dayStateGraph,
    (_data, source, target) => source === fromIndex && target === toIndex,
  )
  if (Option.isNone(edgeIndex)) return Option.none()

  const edge = Graph.getEdge(dayStateGraph, edgeIndex.value)
  return Option.map(edge, (e) => e.data)
}

/**
 * Get all valid next states from a given state.
 */
export const getValidNextStates = (
  from: DayStateNode,
): readonly DayStateNode[] => {
  const fromIndex = nodeIndices[from]
  if (fromIndex === undefined) return []

  const neighborIndices = Graph.neighborsDirected(
    dayStateGraph,
    fromIndex,
    'outgoing',
  )
  return neighborIndices.flatMap((index) => {
    const state = Graph.getNode(dayStateGraph, index)
    return Option.isSome(state) ? [state.value] : []
  })
}

// =============================================================================
// Action-Specific Validators
// =============================================================================

/** Can content be added (activating from empty)? */
export const canActivate = (state: DayStateNode): boolean => state === 'empty'

/** Can a second content type be added (enriching from active)? */
export const canEnrich = (state: DayStateNode): boolean => state === 'active'

/** Can content types be reduced (simplifying from rich)? */
export const canSimplify = (state: DayStateNode): boolean => state === 'rich'

/** Can all content be removed (clearing from active)? */
export const canClear = (state: DayStateNode): boolean => state === 'active'

/** Can the day be archived? */
export const canArchive = (state: DayStateNode): boolean =>
  state === 'active' || state === 'rich'

/** Can the day be unarchived? */
export const canUnarchive = (state: DayStateNode): boolean =>
  state === 'archived'

/** Can the day accept new content (not archived)? */
export const canAddContent = (state: DayStateNode): boolean =>
  state !== 'archived'

// =============================================================================
// Graph Metadata
// =============================================================================

export const STATE_COUNT = 4
export const ALL_STATES: readonly DayStateNode[] = [
  'empty',
  'active',
  'rich',
  'archived',
]
