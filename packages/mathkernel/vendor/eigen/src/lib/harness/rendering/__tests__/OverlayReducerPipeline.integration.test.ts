import { describe, expect, it } from '@effect/vitest'
import { Duration, Effect, Fiber, Layer, Stream, TestClock } from 'effect'

import {
  OverlayReducerPipeline,
  makeOverlayReducerPipelineLayer,
  RenderOverlayOutput,
  RenderPatch,
  RenderReducerInput,
  type RenderOverlayRegistration,
} from '../index'

const mkInput = (params: {
  readonly sessionId: string
  readonly messageId?: string
  readonly seq: number
  readonly lane: 'text' | 'control'
  readonly cls: 'delta' | 'error'
  readonly tag: string
}) =>
  new RenderReducerInput({
    sessionId: params.sessionId as any,
    messageId: params.messageId as any,
    seq: params.seq,
    at: Date.now(),
    lane: params.lane,
    class: params.cls,
    tag: params.tag,
    payload: { seq: params.seq },
  })

const delayedOverlay = (id: string, priority: number, yieldSteps: number): RenderOverlayRegistration => ({
  id,
  priority,
  matches: [{ lane: 'text', class: 'delta' }],
  run: (batch) =>
    Effect.gen(function* () {
      for (let i = 0; i < yieldSteps; i += 1) {
        yield* Effect.yieldNow()
      }

      return new RenderOverlayOutput({
        overlayId: id,
        lane: 'text',
        patches: [
          new RenderPatch({
            path: `/patch/${id}`,
            op: 'append',
            value: batch.length,
            lane: 'text',
            overlayId: id,
          }),
        ],
        nodes: [],
        diagnostics: [],
      })
    }),
})

describe('OverlayReducerPipeline integration', () => {
  it.effect('fork/join is concurrent but collector output order remains deterministic by priority', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const layer = makeOverlayReducerPipelineLayer({
          maxBatchSize: 1,
          maxWaitMs: 1,
        })

        const emission = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          yield* pipeline.register(delayedOverlay('overlay-high', 200, 20))
          yield* pipeline.register(delayedOverlay('overlay-low', 100, 0))

          const head = yield* Effect.fork(Stream.runHead(pipeline.outputs))
          yield* pipeline.ingest(
            mkInput({
              sessionId: 'session-int',
              messageId: 'msg-int',
              seq: 1,
              lane: 'text',
              cls: 'delta',
              tag: 'provider:marker/text_delta',
            }),
          )

          const maybe = yield* Fiber.join(head)
          if (maybe._tag !== 'Some') {
            return yield* Effect.fail(new Error('expected reducer emission'))
          }

          return maybe.value
        }).pipe(Effect.provide(layer))

        expect(emission.overlays).toEqual(['overlay-high', 'overlay-low'])
        expect(emission.patches.map((p) => p.overlayId)).toEqual(['overlay-high', 'overlay-low'])
      }),
    ),
  )

  it.effect('bucketing isolates session streams and immediate error class flushes independently', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const layer = makeOverlayReducerPipelineLayer({
          bucketKeyOf: (input) => `${input.sessionId}:${input.lane}`,
          maxBatchSize: 1,
          maxWaitMs: 1,
        })

        const emissions = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          const overlay: RenderOverlayRegistration = {
            id: 'overlay-bucket',
            priority: 100,
            matches: [
              { lane: 'text', class: 'delta' },
              { lane: 'control', class: 'error' },
            ],
            run: (batch) =>
              Effect.succeed(
                new RenderOverlayOutput({
                  overlayId: 'overlay-bucket',
                  lane: batch[0]?.lane ?? 'unknown',
                  patches: batch.map(
                    (entry) =>
                      new RenderPatch({
                        path: `/bucket/${entry.sessionId}`,
                        op: 'append',
                        value: `${entry.lane}:${entry.class}:${entry.seq}`,
                        lane: entry.lane,
                        overlayId: 'overlay-bucket',
                      }),
                  ),
                  nodes: [],
                  diagnostics: [],
                }),
              ),
          }

          yield* pipeline.register(overlay)

          const collect = yield* Effect.fork(Stream.take(pipeline.outputs, 3).pipe(Stream.runCollect))

          yield* pipeline.ingest(
            mkInput({
              sessionId: 'session-a',
              messageId: 'msg-a',
              seq: 1,
              lane: 'text',
              cls: 'delta',
              tag: 'provider:marker/text_delta',
            }),
          )

          yield* pipeline.ingest(
            mkInput({
              sessionId: 'session-b',
              messageId: 'msg-b',
              seq: 2,
              lane: 'text',
              cls: 'delta',
              tag: 'provider:marker/text_delta',
            }),
          )

          // Immediate bypass class
          yield* pipeline.ingest(
            mkInput({
              sessionId: 'session-a',
              messageId: 'msg-a',
              seq: 3,
              lane: 'control',
              cls: 'error',
              tag: 'chat:v2/error',
            }),
          )

          return yield* Fiber.join(collect)
        }).pipe(Effect.provide(layer))

        const rows = Array.from(emissions)
        expect(rows).toHaveLength(3)
        expect(rows.map((r) => r.bucketKey)).toEqual(['session-a:text', 'session-b:text', 'session-a:control'])
        expect(rows[2]?.patches[0]?.value).toBe('control:error:3')
      }),
    ),
  )

  it.effect('coalesces by maxBatchSize threshold for non-bypass events', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const layer = makeOverlayReducerPipelineLayer({
          maxBatchSize: 4,
          maxWaitMs: 10_000,
        })

        const emission = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          const overlay: RenderOverlayRegistration = {
            id: 'overlay-threshold',
            priority: 100,
            matches: [{ lane: 'text', class: 'delta' }],
            run: (batch) =>
              Effect.succeed(
                new RenderOverlayOutput({
                  overlayId: 'overlay-threshold',
                  lane: 'text',
                  patches: batch.map(
                    (entry) =>
                      new RenderPatch({
                        path: '/threshold',
                        op: 'append',
                        value: entry.seq,
                        lane: entry.lane,
                        overlayId: 'overlay-threshold',
                      }),
                  ),
                  nodes: [],
                  diagnostics: [],
                }),
              ),
          }

          yield* pipeline.register(overlay)

          const head = yield* Effect.fork(Stream.runHead(pipeline.outputs))

          for (let seq = 1; seq <= 4; seq += 1) {
            yield* pipeline.ingest(
              mkInput({
                sessionId: 'session-threshold',
                messageId: 'msg-threshold',
                seq,
                lane: 'text',
                cls: 'delta',
                tag: 'provider:marker/text_delta',
              }),
            )
          }

          const maybe = yield* Fiber.join(head)
          if (maybe._tag !== 'Some') {
            return yield* Effect.fail(new Error('expected threshold emission'))
          }
          return maybe.value
        }).pipe(Effect.provide(layer))

        expect(emission.patches.map((p) => p.value)).toEqual([1, 2, 3, 4])
        expect(emission.seqHighWatermark).toBe(4)
      }),
    ),
  )

  it.effect('coalesces by timeout when batch threshold is not reached', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const layer = makeOverlayReducerPipelineLayer({
          maxBatchSize: 10,
          maxWaitMs: 5,
        })

        const emission = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          const overlay: RenderOverlayRegistration = {
            id: 'overlay-timeout',
            priority: 100,
            matches: [{ lane: 'text', class: 'delta' }],
            run: (batch) =>
              Effect.succeed(
                new RenderOverlayOutput({
                  overlayId: 'overlay-timeout',
                  lane: 'text',
                  patches: batch.map(
                    (entry) =>
                      new RenderPatch({
                        path: '/timeout',
                        op: 'append',
                        value: entry.seq,
                        lane: entry.lane,
                        overlayId: 'overlay-timeout',
                      }),
                  ),
                  nodes: [],
                  diagnostics: [],
                }),
              ),
          }

          yield* pipeline.register(overlay)

          const head = yield* Effect.fork(Stream.runHead(pipeline.outputs))

          for (let seq = 1; seq <= 3; seq += 1) {
            yield* pipeline.ingest(
              mkInput({
                sessionId: 'session-timeout',
                messageId: 'msg-timeout',
                seq,
                lane: 'text',
                cls: 'delta',
                tag: 'provider:marker/text_delta',
              }),
            )
          }

          yield* TestClock.adjust(Duration.millis(10))

          const maybe = yield* Fiber.join(head).pipe(
            Effect.timeoutFail({
              duration: Duration.seconds(1),
              onTimeout: () => new Error('timeout flush did not emit in 1s'),
            }),
          )

          if (maybe._tag !== 'Some') {
            return yield* Effect.fail(new Error('expected timeout emission'))
          }
          return maybe.value
        }).pipe(Effect.provide(layer))

        expect(emission.patches.map((p) => p.value)).toEqual([1, 2, 3])
        expect(emission.seqHighWatermark).toBe(3)
      }),
    ),
  )
})
