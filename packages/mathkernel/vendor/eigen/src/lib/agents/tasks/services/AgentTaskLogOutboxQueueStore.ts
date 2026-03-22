/**
 * AgentTaskLogOutboxQueueStore
 *
 * Custom PersistedQueueStore implementation for task log transactional outbox.
 *
 * Role:
 * - local idempotent WAL of unacked entries
 * - replay-safe queue semantics across restart
 * - durable destination remains JetStream (via AgentTaskLogDurabilityService)
 *
 * @module agent-task/services/AgentTaskLogOutboxQueueStore
 */

import { PersistedQueue } from '@effect/experimental'
import * as Persistence from '@effect/experimental/Persistence'
import * as BrowserKeyValueStore from '@effect/platform-browser/BrowserKeyValueStore'
import {
  Context,
  Effect,
  Exit,
  Layer,
  Option,
  Schema,
} from 'effect'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AgentTaskLogOutboxQueueStoreConfigShape {
  readonly storeId: string
  readonly keyPrefix: string
}

export class AgentTaskLogOutboxQueueStoreConfig extends Context.Tag(
  'AgentTask/LogOutboxQueueStoreConfig',
)<
  AgentTaskLogOutboxQueueStoreConfig,
  AgentTaskLogOutboxQueueStoreConfigShape
>() {}

export const AgentTaskLogOutboxQueueStoreConfigDefault = Layer.succeed(
  AgentTaskLogOutboxQueueStoreConfig,
  {
    storeId: 'agent-task-log-outbox',
    keyPrefix: 'queue:',
  } satisfies AgentTaskLogOutboxQueueStoreConfigShape,
)

export const AgentTaskLogOutboxQueueStoreConfigCustom = (
  config: AgentTaskLogOutboxQueueStoreConfigShape,
) => Layer.succeed(AgentTaskLogOutboxQueueStoreConfig, config)

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

const OutboxQueueItemSchema = Schema.Struct({
  id: Schema.String,
  attempts: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  element: Schema.Unknown,
})
type OutboxQueueItem = typeof OutboxQueueItemSchema.Type

const OutboxQueueStateSchema = Schema.Struct({
  ids: Schema.Array(Schema.String),
  items: Schema.Array(OutboxQueueItemSchema),
})
type OutboxQueueState = typeof OutboxQueueStateSchema.Type

interface RuntimeQueue {
  readonly name: string
  readonly key: string
  readonly latch: ReturnType<typeof Effect.unsafeMakeLatch>
  readonly ids: Set<string>
  readonly items: Array<OutboxQueueItem>
}

const emptyQueueState = (): OutboxQueueState => ({
  ids: [],
  items: [],
})

const queueStoreError = (message: string, cause?: unknown) =>
  new PersistedQueue.PersistedQueueError({ message, cause })

// ---------------------------------------------------------------------------
// Live store
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const backing = yield* Persistence.BackingPersistence
  const config = yield* AgentTaskLogOutboxQueueStoreConfig
  const store = yield* backing.make(config.storeId)

  const queueKey = (name: string) => `${config.keyPrefix}${name}`
  const queues = new Map<string, RuntimeQueue>()

  const persistQueue = (queue: RuntimeQueue) =>
    store
      .set(
        queue.key,
        {
          ids: Array.from(queue.ids),
          items: queue.items,
        } satisfies OutboxQueueState,
        Option.none(),
      )
      .pipe(
        Effect.mapError((cause) =>
          queueStoreError(
            `Failed to persist queue state for '${queue.name}'`,
            cause,
          ),
        ),
      )

  const removeQueueKey = (key: string) =>
    store.remove(key).pipe(
      Effect.mapError((cause) =>
        queueStoreError(`Failed to remove corrupted queue state '${key}'`, cause),
      ),
    )

  const loadQueueState = (name: string, key: string) =>
    store
      .get(key)
      .pipe(
        Effect.mapError((cause) =>
          queueStoreError(
            `Failed to read queue state for '${name}'`,
            cause,
          ),
        ),
        Effect.flatMap((stored) => {
          if (Option.isNone(stored)) {
            return Effect.succeed(emptyQueueState())
          }

          return Schema.decodeUnknown(OutboxQueueStateSchema)(stored.value).pipe(
            Effect.mapError((cause) =>
              queueStoreError(
                `Failed to decode queue state for '${name}'`,
                cause,
              ),
            ),
            Effect.catchAll(() =>
              Effect.as(
                Effect.ignore(removeQueueKey(key)),
                emptyQueueState(),
              ),
            ),
          )
        }),
      )

  const getOrCreateQueue = (name: string) =>
    Effect.gen(function* () {
      const existing = queues.get(name)
      if (existing) {
        return existing
      }

      const key = queueKey(name)
      const loaded = yield* loadQueueState(name, key)
      const latch = Effect.unsafeMakeLatch(false)

      const runtime: RuntimeQueue = {
        name,
        key,
        latch,
        ids: new Set(loaded.ids),
        items: Array.from(loaded.items),
      }

      if (runtime.items.length > 0) {
        runtime.latch.unsafeOpen()
      }

      queues.set(name, runtime)
      return runtime
    })

  return PersistedQueue.PersistedQueueStore.of({
    offer: ({ name, id, element }) =>
      Effect.gen(function* () {
        const queue = yield* getOrCreateQueue(name)

        if (queue.ids.has(id)) {
          return
        }

        queue.ids.add(id)
        queue.items.push({ id, attempts: 0, element })
        yield* persistQueue(queue)
        queue.latch.unsafeOpen()
      }),

    take: Effect.fnUntraced(function* ({ name, maxAttempts }) {
      const queue = yield* getOrCreateQueue(name)

      while (true) {
        yield* queue.latch.await

        const item = queue.items.shift()

        if (item === undefined) {
          queue.latch.unsafeClose()
          continue
        }

        if (queue.items.length === 0) {
          queue.latch.unsafeClose()
        }

        yield* persistQueue(queue)

        yield* Effect.addFinalizer((exit) =>
          Effect.gen(function* () {
            if (Exit.isSuccess(exit)) {
              queue.ids.delete(item.id)
              yield* persistQueue(queue)
              return
            }

            if (!Exit.isInterrupted(exit)) {
              item.attempts += 1
            }

            if (item.attempts >= maxAttempts) {
              queue.ids.delete(item.id)
              yield* persistQueue(queue)
              return
            }

            queue.items.push(item)
            yield* persistQueue(queue)
            queue.latch.unsafeOpen()
          }),
        )

        return {
          id: item.id,
          attempts: item.attempts,
          element: item.element,
        }
      }
    }),
  })
})

export const AgentTaskLogOutboxQueueStoreLive = Layer.scoped(
  PersistedQueue.PersistedQueueStore,
  make,
)

export const AgentTaskLogOutboxQueueStoreDefault =
  AgentTaskLogOutboxQueueStoreLive.pipe(
    Layer.provide(AgentTaskLogOutboxQueueStoreConfigDefault),
  )

/**
 * Browser local outbox backing:
 * BackingPersistence via KeyValueStore(LocalStorage).
 */
export const AgentTaskLogOutboxQueueStoreBackingBrowser =
  Persistence.layerKeyValueStore.pipe(
    Layer.provide(BrowserKeyValueStore.layerLocalStorage),
  )

/**
 * Full browser-ready custom PersistedQueueStore layer.
 */
export const AgentTaskLogOutboxQueueStoreBrowser =
  AgentTaskLogOutboxQueueStoreDefault.pipe(
    Layer.provide(AgentTaskLogOutboxQueueStoreBackingBrowser),
  )
