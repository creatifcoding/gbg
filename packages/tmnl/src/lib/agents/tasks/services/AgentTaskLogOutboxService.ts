/**
 * AgentTaskLogOutboxService
 *
 * Transactional outbox orchestrator for task log durability.
 *
 * Flow:
 * 1) enqueue log entry locally (PersistedQueue, idempotent by entry.id)
 * 2) drain queue and publish via AgentTaskLogDurabilityService
 * 3) queue item is committed only after publish ack callback succeeds
 *
 * @module agent-task/services/AgentTaskLogOutboxService
 */

import { PersistedQueue } from '@effect/experimental'
import { Context, Data, DateTime, Effect, Layer } from 'effect'
import {
  AgentTaskLogOutboxEnvelope,
  AgentTaskLogOutboxEnvelopeSchema,
  AgentTaskLogEntry,
} from '../schemas'
import {
  AgentTaskLogDurabilityError,
  AgentTaskLogDurabilityService,
  AgentTaskLogDurabilityReceipt,
} from './AgentTaskLogDurabilityService'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AgentTaskLogOutboxConfigShape {
  readonly queueName: string
  readonly maxAttempts: number
}

export class AgentTaskLogOutboxConfig extends Context.Tag(
  'AgentTask/LogOutboxConfig',
)<AgentTaskLogOutboxConfig, AgentTaskLogOutboxConfigShape>() {}

export const AgentTaskLogOutboxConfigDefault = Layer.succeed(
  AgentTaskLogOutboxConfig,
  {
    queueName: 'agent-task-log-outbox',
    maxAttempts: 20,
  } satisfies AgentTaskLogOutboxConfigShape,
)

export const AgentTaskLogOutboxConfigCustom = (config: AgentTaskLogOutboxConfigShape) =>
  Layer.succeed(AgentTaskLogOutboxConfig, config)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentTaskLogOutboxEnqueueError extends Data.TaggedError(
  'AgentTask/LogOutboxEnqueueError',
)<{
  readonly message: string
  readonly taskId: string
  readonly entryId: string
  readonly cause?: unknown
}> {}

export class AgentTaskLogOutboxDrainError extends Data.TaggedError(
  'AgentTask/LogOutboxDrainError',
)<{
  readonly message: string
  readonly queueName: string
  readonly cause?: unknown
}> {}

export type AgentTaskLogOutboxError =
  | AgentTaskLogOutboxEnqueueError
  | AgentTaskLogOutboxDrainError

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface AgentTaskLogOutboxServiceShape {
  readonly enqueue: (
    taskId: string,
    entry: AgentTaskLogEntry,
    source?: 'runtime' | 'recovery',
  ) => Effect.Effect<string, AgentTaskLogOutboxEnqueueError>

  readonly drainOne: () => Effect.Effect<
    AgentTaskLogDurabilityReceipt,
    AgentTaskLogOutboxDrainError | AgentTaskLogDurabilityError
  >

  readonly drainForever: () => Effect.Effect<never, never>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class AgentTaskLogOutboxService extends Context.Tag(
  'AgentTask/AgentTaskLogOutboxService',
)<AgentTaskLogOutboxService, AgentTaskLogOutboxServiceShape>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const config = yield* AgentTaskLogOutboxConfig
  const durability = yield* AgentTaskLogDurabilityService

  const queue = yield* PersistedQueue.make({
    name: config.queueName,
    schema: AgentTaskLogOutboxEnvelopeSchema,
  })

  const enqueue: AgentTaskLogOutboxServiceShape['enqueue'] = (
    taskId,
    entry,
    source = 'runtime',
  ) =>
    Effect.gen(function* () {
      const enqueuedAt = yield* DateTime.now

      const envelope = new AgentTaskLogOutboxEnvelope({
        taskId,
        entry,
        enqueuedAt,
        source,
      })

      return yield* queue.offer(envelope, { id: entry.id }).pipe(
        Effect.mapError(
          (cause) =>
            new AgentTaskLogOutboxEnqueueError({
              message: 'Failed to enqueue task log entry into outbox',
              taskId,
              entryId: entry.id,
              cause,
            }),
        ),
      )
    }).pipe(
      Effect.withSpan('AgentTask.LogOutbox.enqueue', {
        attributes: {
          queueName: config.queueName,
          taskId,
          entryId: entry.id,
        },
      }),
    )

  const drainOne: AgentTaskLogOutboxServiceShape['drainOne'] = () =>
    queue
      .take(
        (envelope, metadata) =>
          Effect.uninterruptibleMask((restore) =>
            Effect.gen(function* () {
              return yield* restore(
                durability.publishAndAwaitAck(envelope.taskId, envelope.entry),
              ).pipe(
                Effect.withSpan('AgentTask.LogOutbox.publishAwaitAck', {
                  attributes: {
                    queueName: config.queueName,
                    taskId: envelope.taskId,
                    entryId: envelope.entry.id,
                    attempts: metadata.attempts,
                  },
                }),
              )
            }),
          ),
        { maxAttempts: config.maxAttempts },
      )
      .pipe(
        Effect.mapError((cause) => {
          if (
            typeof cause === 'object' &&
            cause !== null &&
            '_tag' in cause &&
            (cause as { _tag: string })._tag.startsWith('AgentTask/LogDurability')
          ) {
            return cause as AgentTaskLogDurabilityError
          }

          return new AgentTaskLogOutboxDrainError({
            message: 'Failed to drain one outbox log entry',
            queueName: config.queueName,
            cause,
          })
        }),
      )

  const drainForever: AgentTaskLogOutboxServiceShape['drainForever'] = () =>
    drainOne().pipe(
      Effect.catchAll((error) =>
        Effect.logWarning('[AgentTaskLogOutbox] drain error').pipe(
          Effect.annotateLogs({
            tag: error._tag,
            queueName: config.queueName,
          }),
        ),
      ),
      Effect.forever,
    )

  return {
    enqueue,
    drainOne,
    drainForever,
  } satisfies AgentTaskLogOutboxServiceShape
})

export const AgentTaskLogOutboxServiceLive = Layer.effect(
  AgentTaskLogOutboxService,
  make,
)

export const AgentTaskLogOutboxServiceDefault = AgentTaskLogOutboxServiceLive.pipe(
  Layer.provide(AgentTaskLogOutboxConfigDefault),
)
