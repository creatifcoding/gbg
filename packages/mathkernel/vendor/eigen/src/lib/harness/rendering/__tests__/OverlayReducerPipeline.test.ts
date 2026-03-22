import { describe, expect, it } from '@effect/vitest'
import { Effect, Fiber, Layer, Option, Stream } from 'effect'

import {
  OverlayReducerPipeline,
  makeOverlayReducerPipelineLayer,
  type RenderOverlayRegistration,
  RenderNode,
  RenderOverlayOutput,
  RenderPatch,
  RenderReducerInput,
} from '../index'

const mkInput = (overrides?: Partial<typeof RenderReducerInput.Type>) =>
  new RenderReducerInput({
    sessionId: ('session-test' as any),
    messageId: undefined,
    seq: 1,
    at: Date.now(),
    lane: 'text',
    class: 'delta',
    tag: 'provider:marker/text_delta',
    payload: { delta: 'hello' },
    ...overrides,
  })

const mkOverlay = (
  id: string,
  priority: number,
  out: { readonly patches?: ReadonlyArray<typeof RenderPatch.Type>; readonly nodes?: ReadonlyArray<typeof RenderNode.Type> },
): RenderOverlayRegistration => ({
  id,
  priority,
  matches: [{ lane: 'text', class: 'delta' }],
  run: () =>
    Effect.succeed(
      new RenderOverlayOutput({
        overlayId: id,
        lane: 'text',
        patches: out.patches ? [...out.patches] : [],
        nodes: out.nodes ? [...out.nodes] : [],
        diagnostics: [],
      }),
    ),
})

describe('OverlayReducerPipeline', () => {
  it.effect('registers overlays and emits deterministic collected output', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          const high = mkOverlay('overlay-high', 200, {
            patches: [
              new RenderPatch({
                path: '/text',
                op: 'append',
                value: 'A',
                lane: 'text',
                overlayId: 'overlay-high',
              }),
            ],
          })

          const low = mkOverlay('overlay-low', 100, {
            nodes: [
              new RenderNode({
                id: 'node-1',
                kind: 'text-fragment',
                lane: 'text',
                props: { content: 'A' },
                children: [],
              }),
            ],
          })

          yield* pipeline.register(high)
          yield* pipeline.register(low)

          const headFiber = yield* Effect.fork(Stream.runHead(pipeline.outputs))
          yield* pipeline.ingest(mkInput())

          const maybe = yield* Fiber.join(headFiber)
          return maybe
        }).pipe(
          Effect.provide(
            makeOverlayReducerPipelineLayer({
              maxBatchSize: 1,
              maxWaitMs: 1,
            }),
          ),
        )

        expect(maybeTag(result)).toBe('Some')
        if (result._tag === 'Some') {
          expect(result.value.overlays).toEqual(['overlay-high', 'overlay-low'])
          expect(result.value.patches.length).toBe(1)
          expect(result.value.nodes.length).toBe(1)
        }
      }),
    ),
  )

  it.effect('unregister removes overlay from execution set', () =>
    Effect.scoped(
      Effect.gen(function* () {
        const overlays = yield* Effect.gen(function* () {
          const pipeline = yield* OverlayReducerPipeline

          const overlay = mkOverlay('overlay-temp', 50, {
            patches: [
              new RenderPatch({
                path: '/x',
                op: 'set',
                value: 1,
                lane: 'text',
                overlayId: 'overlay-temp',
              }),
            ],
          })

          yield* pipeline.register(overlay)
          const before = yield* pipeline.list

          yield* pipeline.unregister('overlay-temp')
          const after = yield* pipeline.list

          return { before, after }
        }).pipe(
          Effect.provide(
            makeOverlayReducerPipelineLayer({
              maxBatchSize: 1,
              maxWaitMs: 1,
            }),
          ),
        )

        expect(overlays.before.some((entry) => entry.id === 'overlay-temp')).toBe(true)
        expect(overlays.after.some((entry) => entry.id === 'overlay-temp')).toBe(false)
      }),
    ),
  )
})

const maybeTag = <A>(value: Option.Option<A>) => value._tag
