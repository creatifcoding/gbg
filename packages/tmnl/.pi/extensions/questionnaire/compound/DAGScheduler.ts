/**
 * DAGScheduler — execution orchestrator for compound questionnaires.
 *
 * Walks the DAG in topological wavefronts, executing ready nodes in parallel,
 * accumulating results, and resolving routing after each node completes.
 *
 * Decoupled from the questionnaire engine itself — uses an `executeSurvey`
 * callback for actual survey execution. This keeps the scheduler testable
 * and engine-agnostic.
 *
 * Context.Tag pattern — matches QuestionnaireStore convention.
 *
 * @module questionnaire/compound/DAGScheduler
 */

import { Effect, Context, Layer, Ref, Option } from 'effect'
import { Graph } from 'effect'
import { nanoid } from 'nanoid'
import type { CompoundGraph } from './graph.ts'
import {
  CompoundSpec,
  CompoundRun,
  CompoundRunError,
  NodeExecution,
  AccumulatorSnapshot,
} from './schemas.ts'
import type { CompoundRunId, CompoundSpecId, NodeId } from './schemas.ts'
import {
  hydrateGraph,
  validateGraph,
  buildNodeIndexMap,
  toMermaid,
} from './graph.ts'
import { AccumulatorService } from './AccumulatorService.ts'
import { RoutingEngine } from './RoutingEngine.ts'

// =============================================================================
// Service Shape
// =============================================================================

export interface DAGSchedulerShape {
  /**
   * Execute a compound spec from start to finish.
   * Returns the completed CompoundRun record.
   *
   * The `executeSurvey` callback is how the scheduler invokes individual surveys.
   * It receives the node definition + accumulator context and returns the survey result.
   */
  readonly execute: (
    spec: CompoundSpec,
    executeSurvey: (
      nodeId: string,
      specId: string,
      accumulator: AccumulatorSnapshot,
    ) => Effect.Effect<{ resultId: string; answers: Record<string, unknown> }, CompoundRunError>,
  ) => Effect.Effect<CompoundRun, CompoundRunError, AccumulatorService | RoutingEngine>
}

// =============================================================================
// Service Tag
// =============================================================================

export class DAGScheduler extends Context.Tag('compound/DAGScheduler')<
  DAGScheduler,
  DAGSchedulerShape
>() {}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Find all nodes that are ready to execute:
 * - Not yet completed
 * - Not active (being routed to) unless all incoming predecessors are completed
 * - All incoming predecessors in the completedSet
 */
const findReadyNodes = (
  graph: CompoundGraph,
  completedSet: ReadonlySet<number>,
  activeSet: ReadonlySet<number>,
): ReadonlyArray<number> => {
  const ready: number[] = []

  for (const idx of activeSet) {
    if (completedSet.has(idx)) continue
    const incoming = Graph.neighborsDirected(graph, idx, 'incoming')
    const allPredsDone = incoming.every((predIdx) => completedSet.has(predIdx))
    if (allPredsDone) {
      ready.push(idx)
    }
  }

  return ready
}

/**
 * Resolve a node's data from the graph by index.
 */
const getNodeData = (graph: CompoundGraph, idx: number) => {
  const opt = Graph.getNode(graph, idx)
  return Option.isSome(opt) ? opt.value : undefined
}

// =============================================================================
// Live Implementation
// =============================================================================

export const DAGSchedulerLive = Layer.succeed(
  DAGScheduler,
  DAGScheduler.of({
    execute: (spec, executeSurvey) =>
      Effect.gen(function* () {
        const accumulator = yield* AccumulatorService
        const routing = yield* RoutingEngine

        const runId = nanoid() as unknown as CompoundRunId
        const startedAt = new Date().toISOString()

        // ── Step 1: Hydrate + validate ──────────────────────────────────
        const graph = hydrateGraph(spec)
        const issues = validateGraph(spec, graph)
        if (issues.length > 0) {
          return yield* Effect.fail(
            new CompoundRunError({
              message: `Compound spec validation failed: ${issues.join('; ')}`,
              specId: spec.id as string,
            }),
          )
        }

        // ── Step 2: Build lookup structures ─────────────────────────────
        const nodeIndexMap = buildNodeIndexMap(spec, graph)
        const mermaidDiagram = toMermaid(graph)

        // Reverse map: index → nodeId
        const indexToNodeId = new Map<number, string>()
        for (const [nid, idx] of nodeIndexMap) {
          indexToNodeId.set(idx, nid)
        }

        // Start node indices
        const startIndices = spec.startNodeIds
          .map((nid) => nodeIndexMap.get(nid as string))
          .filter((idx): idx is number => idx !== undefined)

        // ── Step 3: Initialize execution state ──────────────────────────
        const completedRef = yield* Ref.make<ReadonlySet<number>>(new Set())
        const activeRef = yield* Ref.make<ReadonlySet<number>>(new Set(startIndices))
        const nodeExecsRef = yield* Ref.make<ReadonlyArray<NodeExecution>>(
          spec.nodes.map(
            (n) =>
              new NodeExecution({
                nodeId: n.nodeId,
                status: 'pending',
              }),
          ),
        )
        const pathRef = yield* Ref.make<ReadonlyArray<string>>([])

        // Helper: update a single NodeExecution in the array
        const updateNodeExec = (
          nodeId: string,
          updater: (ne: NodeExecution) => NodeExecution,
        ) =>
          Ref.update(nodeExecsRef, (execs) =>
            execs.map((ne) =>
              (ne.nodeId as string) === nodeId ? updater(ne) : ne,
            ),
          )

        // ── Step 4: Execution loop — wavefront parallelism ──────────────
        const maxIterations = spec.nodes.length + 1 // safety bound
        let iterations = 0

        while (iterations < maxIterations) {
          iterations++

          const completed = yield* Ref.get(completedRef)
          const active = yield* Ref.get(activeRef)

          // Check termination: all active nodes completed
          const allActiveDone = [...active].every((idx) => completed.has(idx))
          if (allActiveDone && active.size > 0) break
          if (active.size === 0) break

          // Find ready nodes in this wavefront
          const readyNodes = findReadyNodes(graph, completed, active)

          if (readyNodes.length === 0) {
            // Check if we're done or deadlocked
            if (allActiveDone) break
            return yield* Effect.fail(
              new CompoundRunError({
                message: 'DAG execution deadlock: no ready nodes but run is not complete',
                runId: runId as string,
                specId: spec.id as string,
              }),
            )
          }

          // Fork accumulator snapshot for this wavefront
          const accSnapshot = yield* accumulator.forkSnapshot()

          // Execute all ready nodes in parallel
          const results = yield* Effect.all(
            readyNodes.map((nodeIdx) =>
              Effect.gen(function* () {
                const nodeId = indexToNodeId.get(nodeIdx)
                if (!nodeId) {
                  return yield* Effect.fail(
                    new CompoundRunError({
                      message: `Node index ${nodeIdx} has no nodeId mapping`,
                      runId: runId as string,
                      specId: spec.id as string,
                    }),
                  )
                }

                const nodeDef = getNodeData(graph, nodeIdx)
                if (!nodeDef) {
                  return yield* Effect.fail(
                    new CompoundRunError({
                      message: `Node ${nodeId} not found in graph`,
                      runId: runId as string,
                      specId: spec.id as string,
                    }),
                  )
                }

                // Mark as running
                yield* updateNodeExec(nodeId, (ne) =>
                  new NodeExecution({
                    ...ne,
                    status: 'running',
                    startedAt: new Date().toISOString(),
                    accumulatorBefore: accSnapshot,
                  }),
                )

                // Execute the survey via callback
                const surveyResult = yield* executeSurvey(
                  nodeId,
                  nodeDef.specId,
                  accSnapshot,
                ).pipe(
                  Effect.catchAll((err) =>
                    Effect.gen(function* () {
                      // Mark as failed
                      yield* updateNodeExec(nodeId, (ne) =>
                        new NodeExecution({
                          ...ne,
                          status: 'failed',
                          completedAt: new Date().toISOString(),
                          error: err.message,
                        }),
                      )
                      return yield* Effect.fail(err)
                    }),
                  ),
                )

                // Append to accumulator
                yield* accumulator.appendNodeResult(nodeId, surveyResult.answers)
                const accAfter = yield* accumulator.getSnapshot()

                // Mark as completed
                yield* updateNodeExec(nodeId, (ne) =>
                  new NodeExecution({
                    ...ne,
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    resultId: surveyResult.resultId,
                    accumulatorAfter: accAfter,
                  }),
                )

                // Resolve routing to discover next nodes
                const answersStr: Record<string, string> = {}
                for (const [k, v] of Object.entries(surveyResult.answers)) {
                  answersStr[k] = String(v)
                }
                const nextIndices = yield* routing.resolveNextNodes(
                  graph,
                  nodeIdx,
                  answersStr,
                  accAfter,
                )

                return { nodeIdx, nodeId, nextIndices }
              }),
            ),
            { concurrency: 'unbounded' },
          )

          // Update completed set and active set with newly discovered nodes
          yield* Ref.update(completedRef, (s) => {
            const next = new Set(s)
            for (const r of results) {
              next.add(r.nodeIdx)
            }
            return next
          })

          yield* Ref.update(activeRef, (s) => {
            const next = new Set(s)
            for (const r of results) {
              for (const idx of r.nextIndices) {
                next.add(idx)
              }
            }
            return next
          })

          // Record path
          yield* Ref.update(pathRef, (p) => [
            ...p,
            ...results.map((r) => r.nodeId),
          ])
        }

        // ── Step 5: Build final CompoundRun ─────────────────────────────
        const finalAccumulator = yield* accumulator.getSnapshot()
        const nodeExecutions = yield* Ref.get(nodeExecsRef)
        const pathTaken = yield* Ref.get(pathRef)

        // Determine run status
        const hasFailures = nodeExecutions.some((ne) => ne.status === 'failed')
        const status = hasFailures ? 'failed' as const : 'completed' as const

        return new CompoundRun({
          runId,
          specId: spec.id,
          specVersion: spec.version,
          status,
          startedAt,
          completedAt: new Date().toISOString(),
          nodeExecutions: [...nodeExecutions],
          pathTaken: pathTaken as ReadonlyArray<NodeId>,
          finalAccumulator,
          tags: [...spec.tags],
          error: hasFailures
            ? `One or more nodes failed: ${nodeExecutions.filter((ne) => ne.status === 'failed').map((ne) => ne.nodeId).join(', ')}`
            : undefined,
          mermaidDiagram,
        })
      }),
  }),
)
