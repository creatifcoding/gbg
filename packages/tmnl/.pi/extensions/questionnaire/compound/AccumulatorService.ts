/**
 * AccumulatorService — manages the growing accumulator state for compound runs.
 *
 * Uses Effect.Ref for single-fiber mutable state.
 * Supports fork (copy-on-fork for parallel branches) and merge (last-write-wins).
 *
 * Context.Tag pattern — matches QuestionnaireStore convention.
 *
 * @module questionnaire/compound/AccumulatorService
 */

import { Effect, Context, Layer, Ref } from 'effect'
import { AccumulatorSnapshot } from './schemas.ts'

// =============================================================================
// Service Shape
// =============================================================================

export interface AccumulatorServiceShape {
  /** Get current accumulator snapshot */
  readonly getSnapshot: () => Effect.Effect<AccumulatorSnapshot>
  /** Append answers from a completed node — merges into current state */
  readonly appendNodeResult: (
    nodeId: string,
    answers: Record<string, unknown>,
  ) => Effect.Effect<void>
  /** Create a frozen snapshot for a parallel branch (copy-on-fork) */
  readonly forkSnapshot: () => Effect.Effect<AccumulatorSnapshot>
  /** Merge multiple parallel branch snapshots back into the trunk */
  readonly mergeSnapshots: (
    snapshots: ReadonlyArray<AccumulatorSnapshot>,
  ) => Effect.Effect<void>
  /** Reset accumulator to initial state */
  readonly reset: () => Effect.Effect<void>
}

// =============================================================================
// Service Tag
// =============================================================================

export class AccumulatorService extends Context.Tag('compound/AccumulatorService')<
  AccumulatorService,
  AccumulatorServiceShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

const makeEmptySnapshot = (): AccumulatorSnapshot =>
  new AccumulatorSnapshot({
    raw: {},
    timestamp: new Date().toISOString(),
  })

export const AccumulatorServiceLive = Layer.effect(
  AccumulatorService,
  Effect.gen(function* () {
    const ref = yield* Ref.make<AccumulatorSnapshot>(makeEmptySnapshot())

    const getSnapshot: AccumulatorServiceShape['getSnapshot'] = () =>
      Ref.get(ref)

    const appendNodeResult: AccumulatorServiceShape['appendNodeResult'] = (nodeId, answers) =>
      Ref.update(ref, (current) => {
        // Merge new answers keyed as {nodeId}/{questionId}
        const merged: Record<string, unknown> = { ...current.raw }
        for (const [questionId, value] of Object.entries(answers)) {
          merged[`${nodeId}/${questionId}`] = value
        }
        return new AccumulatorSnapshot({
          afterNodeId: nodeId as any,
          raw: merged,
          summary: current.summary,
          timestamp: new Date().toISOString(),
        })
      })

    const forkSnapshot: AccumulatorServiceShape['forkSnapshot'] = () =>
      Effect.gen(function* () {
        const current = yield* Ref.get(ref)
        // Deep-copy via reconstruction — raw is a Record<string, unknown>, shallow copy is sufficient
        // since values are primitives or serializable objects
        return new AccumulatorSnapshot({
          afterNodeId: current.afterNodeId,
          raw: { ...current.raw },
          summary: current.summary,
          timestamp: current.timestamp,
        })
      })

    const mergeSnapshots: AccumulatorServiceShape['mergeSnapshots'] = (snapshots) =>
      Ref.update(ref, (current) => {
        // Last-write-wins merge: iterate snapshots in order, later entries overwrite earlier
        const merged: Record<string, unknown> = { ...current.raw }
        const summaries: string[] = current.summary ? [current.summary] : []

        for (const snapshot of snapshots) {
          for (const [key, value] of Object.entries(snapshot.raw)) {
            merged[key] = value
          }
          if (snapshot.summary) {
            summaries.push(snapshot.summary)
          }
        }

        return new AccumulatorSnapshot({
          afterNodeId: current.afterNodeId,
          raw: merged,
          summary: summaries.length > 0 ? summaries.join('\n') : undefined,
          timestamp: new Date().toISOString(),
        })
      })

    const reset: AccumulatorServiceShape['reset'] = () =>
      Ref.set(ref, makeEmptySnapshot())

    return {
      getSnapshot,
      appendNodeResult,
      forkSnapshot,
      mergeSnapshots,
      reset,
    } satisfies AccumulatorServiceShape
  }),
)
