import { describe, expect, it } from 'vitest'
import { Chunk, Effect, FastCheck as fc, Fiber, Stream } from 'effect'

import {
  OverlayReducerPipeline,
  makeOverlayReducerPipelineLayer,
  RenderOverlayOutput,
  RenderPatch,
  RenderReducerInput,
  type RenderOverlayRegistration,
  type RenderReducerEmission,
} from '../../index'

const toArray = <A>(chunk: Chunk.Chunk<A>): ReadonlyArray<A> => Array.from(chunk)

const mkInput = (seq: number) =>
  new RenderReducerInput({
    sessionId: 'session-prop' as any,
    messageId: 'msg-prop' as any,
    seq,
    at: Date.now(),
    lane: 'text',
    class: 'delta',
    tag: 'provider:marker/text_delta',
    payload: { seq },
  })

const mkOverlay = (id: string, priority: number): RenderOverlayRegistration => ({
  id,
  priority,
  matches: [{ lane: 'text', class: 'delta' }],
  run: (batch) =>
    Effect.succeed(
      new RenderOverlayOutput({
        overlayId: id,
        lane: 'text',
        patches: batch.map(
          (entry) =>
            new RenderPatch({
              path: '/text',
              op: 'append',
              value: entry.seq,
              lane: 'text',
              overlayId: id,
            }),
        ),
        nodes: [],
        diagnostics: [],
      }),
    ),
})

const runSeqCase = (seqs: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const pipeline = yield* OverlayReducerPipeline
    yield* pipeline.register(mkOverlay('overlay-seq', 100))

    const sink = yield* Effect.fork(Stream.take(pipeline.outputs, seqs.length).pipe(Stream.runCollect))

    for (const seq of seqs) {
      yield* pipeline.ingest(mkInput(seq))
    }

    const emitted = toArray(yield* Fiber.join(sink))
    return emitted
  }).pipe(
    Effect.provide(
      makeOverlayReducerPipelineLayer({
        maxBatchSize: 1,
        maxWaitMs: 1,
      }),
    ),
    Effect.runPromise,
  )

const runPriorityCase = (priorities: readonly [number, number, number]) =>
  Effect.gen(function* () {
    const pipeline = yield* OverlayReducerPipeline

    yield* pipeline.register(mkOverlay('overlay-a', priorities[0]))
    yield* pipeline.register(mkOverlay('overlay-b', priorities[1]))
    yield* pipeline.register(mkOverlay('overlay-c', priorities[2]))

    const head = yield* Effect.fork(Stream.runHead(pipeline.outputs))
    yield* pipeline.ingest(mkInput(1))
    const maybe = yield* Fiber.join(head)

    if (maybe._tag !== 'Some') {
      throw new Error('expected emission')
    }

    return maybe.value
  }).pipe(
    Effect.provide(
      makeOverlayReducerPipelineLayer({
        maxBatchSize: 1,
        maxWaitMs: 1,
      }),
    ),
    Effect.runPromise,
  )

const runBatchByThresholdCase = (maxBatchSize: number, batchCount: number) =>
  Effect.gen(function* () {
    const pipeline = yield* OverlayReducerPipeline
    yield* pipeline.register(mkOverlay('overlay-seq', 100))

    const total = maxBatchSize * batchCount
    const sink = yield* Effect.fork(Stream.take(pipeline.outputs, batchCount).pipe(Stream.runCollect))

    for (let seq = 1; seq <= total; seq += 1) {
      yield* pipeline.ingest(mkInput(seq))
    }

    return toArray(yield* Fiber.join(sink))
  }).pipe(
    Effect.provide(
      makeOverlayReducerPipelineLayer({
        maxBatchSize,
        maxWaitMs: 5_000,
      }),
    ),
    Effect.runPromise,
  )

describe('OverlayReducerPipeline properties', () => {
  it(
    'preserves ingest order in seqHighWatermark per bucket',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 1, max: 10_000 }), { minLength: 1, maxLength: 12 }),
          async (seqs) => {
            const emitted = await runSeqCase(seqs)

            expect(emitted.length).toBe(seqs.length)
            expect(emitted.map((entry) => entry.seqHighWatermark)).toEqual(seqs)
            return true
          },
        ),
        { numRuns: 20 },
      )
    },
    20_000,
  )

  it(
    'collector overlays are ordered by priority regardless of registration order',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(fc.integer({ min: 1, max: 1_000 }), {
            minLength: 3,
            maxLength: 3,
            selector: (n) => n,
          }),
          async (values) => {
            const priorities = [values[0], values[1], values[2]] as const
            const emitted: RenderReducerEmission = await runPriorityCase(priorities)

            const expected = [
              { id: 'overlay-a', p: priorities[0] },
              { id: 'overlay-b', p: priorities[1] },
              { id: 'overlay-c', p: priorities[2] },
            ]
              .sort((a, b) => b.p - a.p)
              .map((x) => x.id)

            expect(emitted.overlays).toEqual(expected)
            return true
          },
        ),
        { numRuns: 20 },
      )
    },
    20_000,
  )

  it(
    'batch-size threshold coalesces exactly maxBatchSize events per emission',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 8 }),
          fc.integer({ min: 1, max: 6 }),
          async (maxBatchSize, batchCount) => {
            const emitted = await runBatchByThresholdCase(maxBatchSize, batchCount)

            expect(emitted.length).toBe(batchCount)
            expect(emitted.every((row) => row.patches.length === maxBatchSize)).toBe(true)
            expect(emitted[emitted.length - 1]?.seqHighWatermark).toBe(maxBatchSize * batchCount)
            return true
          },
        ),
        { numRuns: 20 },
      )
    },
    20_000,
  )
})
