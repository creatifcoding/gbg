import { PersistedQueue } from '@effect/experimental'
import * as Persistence from '@effect/experimental/Persistence'
import {
  Duration,
  Effect,
  Layer,
  Option,
  Schema,
} from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AgentTaskLogOutboxQueueStoreConfigCustom,
  AgentTaskLogOutboxQueueStoreLive,
} from '../AgentTaskLogOutboxQueueStore'

const PayloadSchema = Schema.Struct({
  value: Schema.String,
})

const queueLayer = (
  storeId: string,
  backingLayer: Layer.Layer<Persistence.BackingPersistence, never, never>,
) =>
  PersistedQueue.layer.pipe(
    Layer.provide(
      AgentTaskLogOutboxQueueStoreLive.pipe(
        Layer.provide(
          AgentTaskLogOutboxQueueStoreConfigCustom({
            storeId,
            keyPrefix: 'queue:',
          }),
        ),
        Layer.provide(backingLayer),
      ),
    ),
  )

const makeSharedBackingLayer = () => {
  const map = new Map<string, unknown>()

  const layer = Layer.succeed(
    Persistence.BackingPersistence,
    Persistence.BackingPersistence.of({
      [Persistence.BackingPersistenceTypeId]:
        Persistence.BackingPersistenceTypeId,
      make: () =>
        Effect.succeed({
          get: (key: string) =>
            Effect.succeed(
              map.has(key)
                ? Option.some(map.get(key) as unknown)
                : Option.none(),
            ),
          getMany: (keys: Array<string>) =>
            Effect.succeed(
              keys.map((key) =>
                map.has(key)
                  ? Option.some(map.get(key) as unknown)
                  : Option.none(),
              ),
            ),
          set: (key: string, value: unknown) =>
            Effect.sync(() => {
              map.set(key, value)
            }),
          setMany: (
            entries: ReadonlyArray<
              readonly [key: string, value: unknown, ttl: Option.Option<unknown>]
            >,
          ) =>
            Effect.sync(() => {
              for (const [key, value] of entries) {
                map.set(key, value)
              }
            }),
          remove: (key: string) =>
            Effect.sync(() => {
              map.delete(key)
            }),
          clear: Effect.sync(() => {
            map.clear()
          }),
        }),
    }),
  )

  return { layer, map }
}

describe('AgentTaskLogOutboxQueueStore', () => {
  it('dedupes idempotent offers by custom id', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* PersistedQueue.make({
          name: 'outbox-dedupe',
          schema: PayloadSchema,
        })

        yield* queue.offer({ value: 'first' }, { id: 'id-1' })
        yield* queue.offer({ value: 'first' }, { id: 'id-1' })

        const first = yield* queue.take((value) => Effect.succeed(value))
        const second = yield* queue
          .take((value) => Effect.succeed(value))
          .pipe(Effect.timeoutOption(Duration.millis(40)))

        return { first, second }
      }).pipe(Effect.provide(queueLayer('outbox-store-dedupe', Persistence.layerMemory))),
    )

    expect(result.first.value).toBe('first')
    expect(Option.isNone(result.second)).toBe(true)
  })

  it('requeues failed messages with incremented attempts', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const queue = yield* PersistedQueue.make({
          name: 'outbox-retry',
          schema: PayloadSchema,
        })

        yield* queue.offer({ value: 'retry-me' }, { id: 'id-retry' })

        const failed = yield* Effect.either(
          queue.take(() => Effect.fail('boom')),
        )

        const succeeded = yield* queue.take((value, metadata) =>
          Effect.succeed({ value, attempts: metadata.attempts }),
        )

        return { failed, succeeded }
      }).pipe(Effect.provide(queueLayer('outbox-store-retry', Persistence.layerMemory))),
    )

    expect(result.failed._tag).toBe('Left')
    expect(result.succeeded.value.value).toBe('retry-me')
    expect(result.succeeded.attempts).toBe(1)
  })

  it('replays pending queue items after layer reinitialization with shared backing', async () => {
    const shared = makeSharedBackingLayer()

    const programA = Effect.gen(function* () {
      const queue = yield* PersistedQueue.make({
        name: 'outbox-replay',
        schema: PayloadSchema,
      })

      yield* queue.offer({ value: 'persisted' }, { id: 'id-persisted' })
    }).pipe(
      Effect.provide(queueLayer('outbox-store-replay', shared.layer)),
    )

    const programB = Effect.gen(function* () {
      const queue = yield* PersistedQueue.make({
        name: 'outbox-replay',
        schema: PayloadSchema,
      })

      return yield* queue.take((value) => Effect.succeed(value))
    }).pipe(
      Effect.provide(queueLayer('outbox-store-replay', shared.layer)),
    )

    await Effect.runPromise(programA)
    const replayed = await Effect.runPromise(programB)

    expect(replayed.value).toBe('persisted')
  })
})
