import { Chunk, Effect, Stream } from 'effect'
import { describe, expect, it } from 'vitest'

import { MockTransportServiceCustom } from '../MockTransportService'
import { TransportService } from '../TransportService'

describe('MockTransportService', () => {
  it('keeps emitting past template length when infinite mode is enabled', async () => {
    const emitted = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const transport = yield* TransportService
          const stream = yield* transport.subscribe('task-infinite')
          const entries = yield* stream.pipe(Stream.take(40), Stream.runCollect)
          return Chunk.size(entries)
        }),
      ).pipe(
        Effect.provide(
          MockTransportServiceCustom({
            intervalMs: 0,
            jitterMs: 0,
            infinite: true,
          }),
        ),
      ),
    )

    expect(emitted).toBe(40)
  })

  it('supports deterministic seed mode for reproducible test assertions', async () => {
    const collectProjection = () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const transport = yield* TransportService
            const stream = yield* transport.subscribe('task-seeded')
            const entries = yield* stream.pipe(Stream.take(5), Stream.runCollect)

            return Chunk.toReadonlyArray(entries).map((line) => {
              const parsed = JSON.parse(line) as {
                level: string
                source: string
                message: string
                metadata?: {
                  worker?: string
                  syntheticLatency?: number
                }
              }

              return {
                level: parsed.level,
                source: parsed.source,
                message: parsed.message,
                worker: parsed.metadata?.worker ?? null,
                syntheticLatency: parsed.metadata?.syntheticLatency ?? null,
              }
            })
          }),
        ).pipe(
          Effect.provide(
            MockTransportServiceCustom({
              intervalMs: 0,
              jitterMs: 0,
              infinite: false,
              maxEntries: 5,
              seed: 42,
            }),
          ),
        ),
      )

    const runA = await collectProjection()
    const runB = await collectProjection()

    expect(runA).toEqual(runB)
  })
})
