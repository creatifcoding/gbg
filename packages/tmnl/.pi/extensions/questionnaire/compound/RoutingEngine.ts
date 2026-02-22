/**
 * RoutingEngine — resolves which outgoing edges to follow after a node completes.
 *
 * Evaluates routing strategies (StaticBranch, PredicateGuard, DynamicHookRoute)
 * against the current answers and accumulator state.
 *
 * Context.Tag pattern — matches QuestionnaireStore convention.
 *
 * @module questionnaire/compound/RoutingEngine
 */

import { Effect, Context, Layer, Option } from 'effect'
import { Graph } from 'effect'
import type { CompoundGraph } from './graph.ts'
import type { CompoundEdgeDef, AccumulatorSnapshot, RoutingStrategy } from './schemas.ts'

// =============================================================================
// Service Shape
// =============================================================================

export interface RoutingEngineShape {
  /**
   * Given a completed node, resolve which outgoing edges should be followed.
   * Returns node indices of active next targets.
   */
  readonly resolveNextNodes: (
    graph: CompoundGraph,
    completedNodeIndex: number,
    answers: Record<string, string>,
    accumulator: AccumulatorSnapshot,
  ) => Effect.Effect<ReadonlyArray<number>>
}

// =============================================================================
// Service Tag
// =============================================================================

export class RoutingEngine extends Context.Tag('compound/RoutingEngine')<
  RoutingEngine,
  RoutingEngineShape
>() {}

// =============================================================================
// Edge Resolution — pure logic
// =============================================================================

/**
 * Resolve whether a single edge should be followed based on its routing strategy.
 *
 * - No routing (undefined): unconditional — always follow
 * - StaticBranch: check branchMap keys against answer values
 * - PredicateGuard: MVP — always follow (full expression evaluator is future work)
 * - DynamicHookRoute: MVP — always follow (requires pi-agent runtime)
 */
const resolveEdge = (
  routing: RoutingStrategy | undefined,
  answers: Record<string, string>,
  _accumulator: AccumulatorSnapshot,
): boolean => {
  if (routing === undefined) return true // unconditional edge

  switch (routing._tag) {
    case 'StaticBranch': {
      const { branchMap } = routing
      // Check if any answer value matches a branch key
      for (const [_questionId, answerValue] of Object.entries(answers)) {
        if (answerValue && branchMap[answerValue]) return true
      }
      // Fallback to wildcard
      return branchMap['*'] !== undefined
    }
    case 'PredicateGuard': {
      // MVP: simple key=value matching in expression
      // Full expression evaluator is a future enhancement
      // For now, default to following the edge
      return true
    }
    case 'DynamicHookRoute': {
      // MVP: dynamic hooks require the pi-agent runtime which is separate
      // Default to following the edge
      return true
    }
  }
}

// =============================================================================
// Live Implementation
// =============================================================================

export const RoutingEngineLive = Layer.succeed(
  RoutingEngine,
  RoutingEngine.of({
    resolveNextNodes: (graph, completedNodeIndex, answers, accumulator) =>
      Effect.gen(function* () {
        // Get all outgoing neighbor indices
        const outgoing = Graph.neighborsDirected(graph, completedNodeIndex, 'outgoing')

        if (outgoing.length === 0) return [] as ReadonlyArray<number>

        // For each outgoing neighbor, find the edge(s) connecting them
        // and check if routing allows traversal
        const activeTargets: number[] = []

        for (const targetIdx of outgoing) {
          // Find edge(s) from completedNodeIndex to targetIdx
          const edgeIndices = Graph.findEdges(
            graph,
            (_data, source, target) =>
              source === completedNodeIndex && target === targetIdx,
          )

          // If ANY edge between these nodes passes routing, include the target
          let shouldFollow = false
          for (const edgeIdx of edgeIndices) {
            const edgeOpt = Graph.getEdge(graph, edgeIdx)
            if (Option.isSome(edgeOpt)) {
              const edgeDef = edgeOpt.value.data as CompoundEdgeDef
              if (resolveEdge(edgeDef.routing, answers, accumulator)) {
                shouldFollow = true
                break
              }
            }
          }

          if (shouldFollow) {
            activeTargets.push(targetIdx)
          }
        }

        return activeTargets
      }),
  }),
)
