import { Context, Duration, Effect, Fiber, HashMap, Layer, Option, PubSub, Ref, Stream } from 'effect'

import {
  type RenderBypassClass,
  type RenderEventClass,
  type RenderLane,
  RenderOverlayOutput,
  RenderReducerEmission,
  type RenderReducerInput,
} from './schemas'

type OverlayMatch = {
  readonly lane: RenderLane
  readonly class: RenderEventClass
}

export interface RenderOverlayRegistration {
  readonly id: string
  readonly priority: number
  readonly matches: ReadonlyArray<OverlayMatch>
  readonly run: (batch: ReadonlyArray<RenderReducerInput>) => Effect.Effect<typeof RenderOverlayOutput.Type, never>
}

export interface OverlayReducerPipelineConfig {
  readonly immediateClasses: ReadonlyArray<RenderBypassClass>
  readonly bucketKeyOf: (input: RenderReducerInput) => string
  readonly maxBatchSize: number
  readonly maxWaitMs: number
}

const defaultConfig: OverlayReducerPipelineConfig = {
  immediateClasses: ['error', 'terminal', 'extension', 'tool'],
  bucketKeyOf: (input) => {
    const messagePart = Option.getOrElse(Option.fromNullable(input.messageId), () => 'none')
    return `${input.sessionId}:${messagePart}:${input.lane}`
  },
  maxBatchSize: 32,
  maxWaitMs: 8,
}

interface BucketState {
  readonly pending: ReadonlyArray<RenderReducerInput>
  readonly flushScheduled: boolean
}

const emptyBucket: BucketState = {
  pending: [],
  flushScheduled: false,
}

const overlayAppliesTo = (overlay: RenderOverlayRegistration, input: RenderReducerInput): boolean =>
  overlay.matches.some((m) => m.lane === input.lane && m.class === input.class)

const sortByPriorityDesc = (overlays: ReadonlyArray<RenderOverlayRegistration>) =>
  [...overlays].sort((a, b) => b.priority - a.priority)

export interface OverlayReducerPipelineShape {
  readonly register: (overlay: RenderOverlayRegistration) => Effect.Effect<void>
  readonly unregister: (overlayId: string) => Effect.Effect<void>
  readonly list: Effect.Effect<ReadonlyArray<RenderOverlayRegistration>>
  readonly ingest: (input: RenderReducerInput) => Effect.Effect<void>
  readonly flushBucket: (bucketKey: string) => Effect.Effect<void>
  readonly outputs: Stream.Stream<typeof RenderReducerEmission.Type>
}

export const OverlayReducerPipeline = Context.GenericTag<OverlayReducerPipelineShape>('tmnl/harness/rendering/OverlayReducerPipeline')

export const makeOverlayReducerPipelineLayer = (config?: Partial<OverlayReducerPipelineConfig>) =>
  Layer.effect(
    OverlayReducerPipeline,
    Effect.gen(function* () {
      const resolved: OverlayReducerPipelineConfig = {
        ...defaultConfig,
        ...config,
        maxBatchSize: Math.max(1, Number(config?.maxBatchSize ?? defaultConfig.maxBatchSize)),
        maxWaitMs: Math.max(1, Number(config?.maxWaitMs ?? defaultConfig.maxWaitMs)),
      }

      const overlaysRef = yield* Ref.make<HashMap.HashMap<string, RenderOverlayRegistration>>(HashMap.empty())
      const bucketsRef = yield* Ref.make<HashMap.HashMap<string, BucketState>>(HashMap.empty())
      const timersRef = yield* Ref.make<HashMap.HashMap<string, Fiber.RuntimeFiber<void, never>>>(HashMap.empty())
      const outputs = yield* PubSub.unbounded<typeof RenderReducerEmission.Type>()

      const listOverlays = Ref.get(overlaysRef).pipe(
        Effect.map((map) => sortByPriorityDesc(Array.from(HashMap.values(map)))),
      )

      const reduceBucket = (
        bucketKey: string,
        batch: ReadonlyArray<RenderReducerInput>,
        backlogDepth: number,
      ) =>
        Effect.gen(function* () {
          if (batch.length === 0) {
            return
          }

          const startedAtMs = Date.now()

          const overlays = yield* listOverlays
          const matching = overlays.filter((overlay) => batch.some((input) => overlayAppliesTo(overlay, input)))

          if (matching.length === 0) {
            return
          }

          const overlayOutputs = yield* Effect.forEach(
            matching,
            (overlay) => overlay.run(batch),
            { concurrency: 'unbounded' },
          )

          const nonEmpty = overlayOutputs.filter((entry) => entry.patches.length > 0 || entry.nodes.length > 0)
          if (nonEmpty.length === 0) {
            return
          }

          const first = batch[0]
          const seqHighWatermark = batch.reduce((max, item) => Math.max(max, item.seq), 0)
          const completedAtMs = Date.now()

          yield* PubSub.publish(
            outputs,
            new RenderReducerEmission({
              sessionId: first.sessionId,
              messageId: first.messageId,
              bucketKey,
              seqHighWatermark,
              emittedAt: completedAtMs,
              transformMs: Math.max(0, completedAtMs - startedAtMs),
              batchSize: batch.length,
              backlogDepth: Math.max(backlogDepth, batch.length),
              overlays: nonEmpty.map((entry) => entry.overlayId),
              patches: nonEmpty.flatMap((entry) => [...entry.patches]),
              nodes: nonEmpty.flatMap((entry) => [...entry.nodes]),
            }),
          )
        })

      const drainBucket = (bucketKey: string) =>
        Effect.gen(function* () {
          const drained = yield* Ref.modify(bucketsRef, (current) => {
            const bucket = HashMap.get(current, bucketKey)
            if (Option.isNone(bucket)) {
              return [{ pending: [] as ReadonlyArray<RenderReducerInput>, backlogDepth: 0 }, current] as const
            }

            const next: BucketState = {
              pending: [],
              flushScheduled: false,
            }

            return [
              {
                pending: bucket.value.pending,
                backlogDepth: bucket.value.pending.length,
              },
              HashMap.set(current, bucketKey, next),
            ] as const
          })

          yield* reduceBucket(bucketKey, drained.pending, drained.backlogDepth)
        })

      const clearTimer = (bucketKey: string) =>
        Effect.gen(function* () {
          const maybeTimer = yield* Ref.modify(timersRef, (current) => {
            const timer = HashMap.get(current, bucketKey)
            return [timer, HashMap.remove(current, bucketKey)] as const
          })

          if (Option.isSome(maybeTimer)) {
            yield* Fiber.interrupt(maybeTimer.value)
          }
        })

      const flushBucket = (bucketKey: string) =>
        Effect.gen(function* () {
          yield* clearTimer(bucketKey)
          yield* drainBucket(bucketKey)
        })

      const scheduleBucketFlush = (bucketKey: string) =>
        Effect.gen(function* () {
          const hasTimer = yield* Ref.get(timersRef).pipe(Effect.map((map) => Option.isSome(HashMap.get(map, bucketKey))))
          if (hasTimer) {
            return
          }

          const timerFiber = yield* Effect.forkDaemon(
            Effect.sleep(Duration.millis(resolved.maxWaitMs)).pipe(
              Effect.zipRight(
                Effect.gen(function* () {
                  yield* Ref.update(timersRef, HashMap.remove(bucketKey))
                  yield* drainBucket(bucketKey)
                }),
              ),
              Effect.catchAll(() => Effect.void),
            ),
          )

          yield* Ref.update(timersRef, HashMap.set(bucketKey, timerFiber))
        })

      const ingest = (input: RenderReducerInput) =>
        Effect.gen(function* () {
          const bucketKey = resolved.bucketKeyOf(input)
          const bypass = resolved.immediateClasses.includes(input.class as RenderBypassClass)

          const decision = yield* Ref.modify(bucketsRef, (current) => {
            const currentBucket = Option.getOrElse(HashMap.get(current, bucketKey), () => emptyBucket)
            const nextPending = [...currentBucket.pending, input]
            const reachedBatch = nextPending.length >= resolved.maxBatchSize
            const shouldSchedule = !bypass && !reachedBatch && !currentBucket.flushScheduled

            const nextBucket: BucketState = {
              pending: nextPending,
              flushScheduled: shouldSchedule || currentBucket.flushScheduled,
            }

            const nextMap = HashMap.set(current, bucketKey, nextBucket)
            return [{ bypass, reachedBatch, shouldSchedule }, nextMap] as const
          })

          if (decision.bypass || decision.reachedBatch) {
            yield* flushBucket(bucketKey)
            return
          }

          if (decision.shouldSchedule) {
            yield* scheduleBucketFlush(bucketKey)
          }
        })

      return OverlayReducerPipeline.of({
        register: (overlay) => Ref.update(overlaysRef, HashMap.set(overlay.id, overlay)),
        unregister: (overlayId) => Ref.update(overlaysRef, HashMap.remove(overlayId)),
        list: listOverlays,
        ingest,
        flushBucket,
        outputs: Stream.fromPubSub(outputs),
      })
    }),
  )

export const OverlayReducerPipelineLive = makeOverlayReducerPipelineLayer()
