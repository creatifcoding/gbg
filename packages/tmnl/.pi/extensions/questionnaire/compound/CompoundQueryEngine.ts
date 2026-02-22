/**
 * CompoundQueryEngine — higher-level query engine for cross-survey
 * correlation, path analysis, run diffing, and topology-aware aggregation.
 *
 * Depends on CompoundStore for data access.
 *
 * @module questionnaire/compound/CompoundQueryEngine
 */

import { Effect, Context, Layer } from 'effect'
import { CompoundStore } from './CompoundStore.ts'
import type { CompoundRun } from './schemas.ts'

// =============================================================================
// Result Types
// =============================================================================

export interface CompoundRunDiff {
  readonly runIdA: string
  readonly runIdB: string
  readonly pathDiff: { onlyA: string[]; onlyB: string[]; common: string[] }
  readonly answerDiffs: ReadonlyArray<{
    key: string
    valueA: unknown
    valueB: unknown
  }>
}

export interface NodeAggregation {
  readonly nodeId: string
  readonly totalRuns: number
  readonly answerDistribution: Record<string, Record<string, number>>
  // answerDistribution: { questionId: { "value1": 5, "value2": 3 } }
}

export interface SemanticSearchResult {
  readonly runId: string
  readonly score: number
  readonly highlights: string[]
}

// =============================================================================
// Service Shape
// =============================================================================

export interface CompoundQueryEngineShape {
  /** Cross-survey correlation: find runs where node A answered X AND node B answered Y */
  readonly crossSurveyCorrelation: (
    specId: string,
    correlations: ReadonlyArray<{ nodeId: string; questionId: string; value: string }>,
  ) => Effect.Effect<ReadonlyArray<CompoundRun>, Error>

  /** Path analysis: most common execution paths across all runs of a spec */
  readonly pathAnalysis: (
    specId: string,
  ) => Effect.Effect<ReadonlyArray<{ path: ReadonlyArray<string>; count: number }>, Error>

  /** Diff two compound runs: show differences in answers, path, and accumulator */
  readonly diffRuns: (
    specId: string,
    runIdA: string,
    runIdB: string,
  ) => Effect.Effect<CompoundRunDiff, Error>

  /** Topology-aware aggregation: aggregate answers at each node across all runs */
  readonly nodeAggregation: (
    specId: string,
    nodeId: string,
  ) => Effect.Effect<NodeAggregation, Error>

  /** Semantic search across all surveys in a compound run's accumulated answers */
  readonly semanticSearch: (
    specId: string,
    query: string,
    options?: { topK?: number; minScore?: number },
  ) => Effect.Effect<ReadonlyArray<SemanticSearchResult>, Error>
}

// =============================================================================
// Service Tag
// =============================================================================

export class CompoundQueryEngine extends Context.Tag('compound/CompoundQueryEngine')<
  CompoundQueryEngine,
  CompoundQueryEngineShape
>() {}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract a flat answer map from a run's accumulator.
 * Keys are `{nodeId}/{questionId}`, values extracted from RichAnswerEntry-compatible objects.
 */
const extractAnswerMap = (run: CompoundRun): Record<string, string> => {
  const raw = run.finalAccumulator?.raw ?? {}
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'object' && val !== null && 'value' in val) {
      result[key] = String((val as { value: unknown }).value)
    } else {
      result[key] = String(val)
    }
  }
  return result
}

// =============================================================================
// Live Implementation
// =============================================================================

export const CompoundQueryEngineLive = Layer.effect(
  CompoundQueryEngine,
  Effect.gen(function* () {
    const store = yield* CompoundStore

    // ─── Cross-Survey Correlation ──────────────────────────────────────

    const crossSurveyCorrelation: CompoundQueryEngineShape['crossSurveyCorrelation'] = (
      specId,
      correlations,
    ) =>
      Effect.gen(function* () {
        const runs = yield* store.listCompoundRuns(specId)

        return runs.filter((run) => {
          const answers = extractAnswerMap(run)

          return correlations.every(({ nodeId, questionId, value }) => {
            const accKey = `${nodeId}/${questionId}`
            const actual = answers[accKey]
            if (actual === undefined) return false
            return actual.toLowerCase().includes(value.toLowerCase())
          })
        })
      }).pipe(
        Effect.mapError((err) => new Error(
          `Cross-survey correlation failed: ${err instanceof Error ? err.message : String(err)}`,
        )),
        Effect.withSpan('CompoundQueryEngine.crossSurveyCorrelation', { attributes: { specId } }),
      )

    // ─── Path Analysis ─────────────────────────────────────────────────

    const pathAnalysis: CompoundQueryEngineShape['pathAnalysis'] = (specId) =>
      Effect.gen(function* () {
        const runs = yield* store.listCompoundRuns(specId)

        // Group runs by their pathTaken (serialized as joined string)
        const pathCounts = new Map<string, { path: ReadonlyArray<string>; count: number }>()

        for (const run of runs) {
          const pathArr = run.pathTaken.map((n) => n as string)
          const pathKey = pathArr.join(' → ')

          const existing = pathCounts.get(pathKey)
          if (existing) {
            pathCounts.set(pathKey, { path: existing.path, count: existing.count + 1 })
          } else {
            pathCounts.set(pathKey, { path: pathArr, count: 1 })
          }
        }

        // Sort by count descending
        return Array.from(pathCounts.values()).sort((a, b) => b.count - a.count)
      }).pipe(
        Effect.mapError((err) => new Error(
          `Path analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        )),
        Effect.withSpan('CompoundQueryEngine.pathAnalysis', { attributes: { specId } }),
      )

    // ─── Diff Runs ─────────────────────────────────────────────────────

    const diffRuns: CompoundQueryEngineShape['diffRuns'] = (specId, runIdA, runIdB) =>
      Effect.gen(function* () {
        const runA = yield* store.getCompoundRun(specId, runIdA)
        const runB = yield* store.getCompoundRun(specId, runIdB)

        if (!runA) return yield* Effect.fail(new Error(`Run '${runIdA}' not found for spec '${specId}'`))
        if (!runB) return yield* Effect.fail(new Error(`Run '${runIdB}' not found for spec '${specId}'`))

        // Path diff
        const pathA = runA.pathTaken.map((n) => n as string)
        const pathB = runB.pathTaken.map((n) => n as string)
        const pathSetA = new Set(pathA)
        const pathSetB = new Set(pathB)

        const onlyA = pathA.filter((n) => !pathSetB.has(n))
        const onlyB = pathB.filter((n) => !pathSetA.has(n))
        const common = pathA.filter((n) => pathSetB.has(n))

        // Answer diffs — compare finalAccumulator.raw
        const rawA = runA.finalAccumulator?.raw ?? {}
        const rawB = runB.finalAccumulator?.raw ?? {}
        const allKeys = new Set([...Object.keys(rawA), ...Object.keys(rawB)])

        const answerDiffs: Array<{ key: string; valueA: unknown; valueB: unknown }> = []
        for (const key of allKeys) {
          const valA = rawA[key]
          const valB = rawB[key]
          // Compare serialized values
          if (JSON.stringify(valA) !== JSON.stringify(valB)) {
            answerDiffs.push({ key, valueA: valA, valueB: valB })
          }
        }

        const diff: CompoundRunDiff = {
          runIdA,
          runIdB,
          pathDiff: { onlyA, onlyB, common },
          answerDiffs,
        }
        return diff
      }).pipe(
        Effect.mapError((err) => new Error(
          `Diff runs failed: ${err instanceof Error ? err.message : String(err)}`,
        )),
        Effect.withSpan('CompoundQueryEngine.diffRuns', { attributes: { specId, runIdA, runIdB } }),
      )

    // ─── Node Aggregation ──────────────────────────────────────────────

    const nodeAggregation: CompoundQueryEngineShape['nodeAggregation'] = (specId, nodeId) =>
      Effect.gen(function* () {
        const runs = yield* store.listCompoundRuns(specId)

        // For each run, find the NodeExecution for nodeId and extract answers
        const distribution: Record<string, Record<string, number>> = {}
        let totalRuns = 0

        for (const run of runs) {
          const execution = run.nodeExecutions.find((ne) => (ne.nodeId as string) === nodeId)
          if (!execution) continue

          totalRuns++

          // Extract answers from accumulatorAfter.raw matching this node's prefix
          const accRaw = execution.accumulatorAfter?.raw ?? {}
          const prefix = `${nodeId}/`

          for (const [key, val] of Object.entries(accRaw)) {
            if (!key.startsWith(prefix)) continue

            const questionId = key.slice(prefix.length)
            const valueStr = typeof val === 'object' && val !== null && 'value' in val
              ? String((val as { value: unknown }).value)
              : String(val)

            if (!distribution[questionId]) distribution[questionId] = {}
            distribution[questionId][valueStr] = (distribution[questionId][valueStr] ?? 0) + 1
          }
        }

        const result: NodeAggregation = {
          nodeId,
          totalRuns,
          answerDistribution: distribution,
        }
        return result
      }).pipe(
        Effect.mapError((err) => new Error(
          `Node aggregation failed: ${err instanceof Error ? err.message : String(err)}`,
        )),
        Effect.withSpan('CompoundQueryEngine.nodeAggregation', { attributes: { specId, nodeId } }),
      )

    // ─── Semantic Search (MVP: keyword-based) ──────────────────────────

    const semanticSearch: CompoundQueryEngineShape['semanticSearch'] = (specId, query, options) =>
      Effect.gen(function* () {
        const runs = yield* store.listCompoundRuns(specId)
        const queryLower = query.toLowerCase()
        const topK = options?.topK ?? 10
        const minScore = options?.minScore ?? 0

        const scored = runs
          .map((run) => {
            // Concatenate all accumulated answers into a single text blob
            const allText = Object.values(run.finalAccumulator?.raw ?? {})
              .map((v) => {
                if (typeof v === 'object' && v !== null && 'value' in v) {
                  return String((v as { value: unknown }).value)
                }
                return String(v)
              })
              .join(' ')
              .toLowerCase()

            const words = queryLower.split(/\s+/).filter((w) => w.length > 0)
            if (words.length === 0) return { runId: run.runId as string, score: 0, highlights: [] as string[] }

            const matchCount = words.filter((w) => allText.includes(w)).length
            const score = matchCount / words.length
            const highlights = words.filter((w) => allText.includes(w))

            return { runId: run.runId as string, score, highlights }
          })
          .filter((r) => r.score > minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)

        return scored
      }).pipe(
        Effect.mapError((err) => new Error(
          `Semantic search failed: ${err instanceof Error ? err.message : String(err)}`,
        )),
        Effect.withSpan('CompoundQueryEngine.semanticSearch', { attributes: { specId } }),
      )

    return {
      crossSurveyCorrelation,
      pathAnalysis,
      diffRuns,
      nodeAggregation,
      semanticSearch,
    } satisfies CompoundQueryEngineShape
  }),
)
