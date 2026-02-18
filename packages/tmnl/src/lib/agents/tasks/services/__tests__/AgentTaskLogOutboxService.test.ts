import { PersistedQueue } from '@effect/experimental'
import * as Persistence from '@effect/experimental/Persistence'
import {
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
} from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AgentTaskLogDurabilityReceipt,
} from '../../schemas'
import { AgentTaskLogEntry } from '../../schemas/log-entry'
import {
  AgentTaskLogDurabilityPublishError,
  AgentTaskLogDurabilityService,
} from '../AgentTaskLogDurabilityService'
import {
  AgentTaskLogOutboxConfigCustom,
  AgentTaskLogOutboxService,
  AgentTaskLogOutboxServiceLive,
} from '../AgentTaskLogOutboxService'
import {
  AgentTaskLogOutboxQueueStoreConfigCustom,
  AgentTaskLogOutboxQueueStoreLive,
} from '../AgentTaskLogOutboxQueueStore'

const entry = (id: string) =>
  new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeNow(),
    level: 'INFO',
    source: 'outbox.test',
    message: `entry:${id}`,
  })

const queueFactoryLayer = (storeId: string) =>
  PersistedQueue.layer.pipe(
    Layer.provide(
      AgentTaskLogOutboxQueueStoreLive.pipe(
        Layer.provide(
          AgentTaskLogOutboxQueueStoreConfigCustom({
            storeId,
            keyPrefix: 'queue:',
          }),
        ),
        Layer.provide(Persistence.layerMemory),
      ),
    ),
  )

describe('AgentTaskLogOutboxService', () => {
  it('enqueues idempotently and drains one durable publish', async () => {
    let publishCalls = 0

    const fakeDurability = Layer.succeed(
      AgentTaskLogDurabilityService,
      AgentTaskLogDurabilityService.of({
        ensureStream: Effect.void,
        publishAndAwaitAck: (taskId, e) =>
          Effect.sync(() => {
            publishCalls += 1
            return new AgentTaskLogDurabilityReceipt({
              taskId,
              entryId: e.id,
              subject: `agent.task.${taskId}.logs`,
              stream: 'AGENT_TASK_LOGS',
              sequence: publishCalls,
              duplicate: false,
              entryTimestamp: e.timestamp,
              ackedAt: DateTime.unsafeNow(),
              publishLatencyMs: 1,
            })
          }),
      }),
    )

    const layer = AgentTaskLogOutboxServiceLive.pipe(
      Layer.provide(AgentTaskLogOutboxConfigCustom({
        queueName: 'outbox-service-a',
        maxAttempts: 5,
      })),
      Layer.provide(fakeDurability),
      Layer.provide(queueFactoryLayer('outbox-service-store-a')),
    )

    const successAttempts: string[] = []

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* AgentTaskLogOutboxService

        yield* outbox.enqueue('task-a', entry('entry-a'))
        yield* outbox.enqueue('task-a', entry('entry-a'))

        const first = yield* outbox.drainOne({
          onAttemptSuccess: (attempt) =>
            Effect.sync(() => {
              successAttempts.push(attempt.entry.id)
            }),
        })
        const second = yield* outbox
          .drainOne()
          .pipe(Effect.timeoutOption(Duration.millis(40)))

        return { first, second }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.first.entryId).toBe('entry-a')
    expect(result.first.sequence).toBe(1)
    expect(Option.isNone(result.second)).toBe(true)
    expect(successAttempts).toEqual(['entry-a'])
    expect(publishCalls).toBe(1)
  })

  it('retries on durability failure via persisted queue semantics', async () => {
    let publishCalls = 0

    const fakeDurability = Layer.succeed(
      AgentTaskLogDurabilityService,
      AgentTaskLogDurabilityService.of({
        ensureStream: Effect.void,
        publishAndAwaitAck: (taskId, e) =>
          Effect.gen(function* () {
            publishCalls += 1

            if (publishCalls === 1) {
              return yield* Effect.fail(
                new AgentTaskLogDurabilityPublishError({
                  message: 'boom',
                  streamName: 'AGENT_TASK_LOGS',
                  taskId,
                  entryId: e.id,
                  subject: `agent.task.${taskId}.logs`,
                }),
              )
            }

            return new AgentTaskLogDurabilityReceipt({
              taskId,
              entryId: e.id,
              subject: `agent.task.${taskId}.logs`,
              stream: 'AGENT_TASK_LOGS',
              sequence: 2,
              duplicate: false,
              entryTimestamp: e.timestamp,
              ackedAt: DateTime.unsafeNow(),
              publishLatencyMs: 1,
            })
          }),
      }),
    )

    const attempts: number[] = []
    const failures: Array<{ dropped: boolean; attempt: number; retried: boolean }> = []

    const layer = AgentTaskLogOutboxServiceLive.pipe(
      Layer.provide(AgentTaskLogOutboxConfigCustom({
        queueName: 'outbox-service-b',
        maxAttempts: 5,
      })),
      Layer.provide(fakeDurability),
      Layer.provide(queueFactoryLayer('outbox-service-store-b')),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* AgentTaskLogOutboxService

        yield* outbox.enqueue('task-b', entry('entry-b'))

        const hooks = {
          onAttemptStart: (attempt: { attempt: number }) =>
            Effect.sync(() => {
              attempts.push(attempt.attempt)
            }),
          onAttemptFailure: (failure: {
            dropped: boolean
            attempt: number
            retried: boolean
          }) =>
            Effect.sync(() => {
              failures.push({
                dropped: failure.dropped,
                attempt: failure.attempt,
                retried: failure.retried,
              })
            }),
        }

        const first = yield* Effect.either(outbox.drainOne(hooks))
        const second = yield* Effect.either(outbox.drainOne(hooks))

        return { first, second }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.first._tag).toBe('Left')
    expect(result.second._tag).toBe('Right')
    if (result.second._tag === 'Right') {
      expect(result.second.right.entryId).toBe('entry-b')
      expect(result.second.right.sequence).toBe(2)
    }

    expect(attempts).toEqual([1, 2])
    expect(failures).toEqual([{ dropped: false, attempt: 1, retried: false }])
    expect(publishCalls).toBe(2)
  })

  it('marks attempt failure as dropped at max-attempt boundary', async () => {
    const fakeDurability = Layer.succeed(
      AgentTaskLogDurabilityService,
      AgentTaskLogDurabilityService.of({
        ensureStream: Effect.void,
        publishAndAwaitAck: (taskId, e) =>
          Effect.fail(
            new AgentTaskLogDurabilityPublishError({
              message: 'permanent-failure',
              streamName: 'AGENT_TASK_LOGS',
              taskId,
              entryId: e.id,
              subject: `agent.task.${taskId}.logs`,
            }),
          ),
      }),
    )

    const failures: Array<{ dropped: boolean; attempt: number; maxAttempts: number }> = []

    const layer = AgentTaskLogOutboxServiceLive.pipe(
      Layer.provide(AgentTaskLogOutboxConfigCustom({
        queueName: 'outbox-service-c',
        maxAttempts: 1,
      })),
      Layer.provide(fakeDurability),
      Layer.provide(queueFactoryLayer('outbox-service-store-c')),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outbox = yield* AgentTaskLogOutboxService

        yield* outbox.enqueue('task-c', entry('entry-c'))

        return yield* Effect.either(
          outbox.drainOne({
            onAttemptFailure: (failure) =>
              Effect.sync(() => {
                failures.push({
                  dropped: failure.dropped,
                  attempt: failure.attempt,
                  maxAttempts: failure.maxAttempts,
                })
              }),
          }),
        )
      }).pipe(Effect.provide(layer)),
    )

    expect(result._tag).toBe('Left')
    expect(failures).toEqual([{ dropped: true, attempt: 1, maxAttempts: 1 }])
  })
})
