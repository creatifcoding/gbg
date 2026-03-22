/**
 * AgentTaskLogDurabilityService
 *
 * JetStream ack-gated durability service for task log entries.
 *
 * Responsibilities:
 * - Ensure a JetStream stream exists for task log durability subjects
 * - Publish schema-typed log entries via NatsStreamService
 * - Return schema-backed durability receipts from publish acknowledgements
 *
 * @module agent-task/services/AgentTaskLogDurabilityService
 */

import { Context, Data, DateTime, Effect, Layer, Ref } from 'effect'
import { NatsStreamService } from '../../../holonet/nats/stream'
import {
  AgentTaskLogDurabilityReceipt,
  AgentTaskLogEntry,
  AgentTaskLogEntrySchema,
} from '../schemas'

// ---------------------------------------------------------------------------
// Subject + stream conventions
// ---------------------------------------------------------------------------

/** Wildcard durability subject pattern for all agent task logs. */
export const AGENT_TASK_LOG_DURABILITY_WILDCARD = 'agent.task.*.logs'

/** Resolve a concrete task log subject used for durable publishes. */
export const resolveAgentTaskLogDurabilitySubject = (taskId: string): string =>
  `agent.task.${taskId}.logs`

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface AgentTaskLogDurabilityConfigShape {
  /** JetStream stream name storing task log events. */
  readonly streamName: string
  /** Stream subject patterns; must include task log wildcard. */
  readonly subjects: ReadonlyArray<string>
  /** JetStream storage backend. */
  readonly storage: 'file' | 'memory'
  /** Stream retention policy. */
  readonly retention: 'limits' | 'interest' | 'workqueue'
  /** Duplicate window (nanoseconds) for msgId dedupe. */
  readonly duplicateWindow: number
}

export class AgentTaskLogDurabilityConfig extends Context.Tag(
  'AgentTask/LogDurabilityConfig',
)<AgentTaskLogDurabilityConfig, AgentTaskLogDurabilityConfigShape>() {}

export const AgentTaskLogDurabilityConfigDefault = Layer.succeed(
  AgentTaskLogDurabilityConfig,
  {
    streamName: 'AGENT_TASK_LOGS',
    subjects: [AGENT_TASK_LOG_DURABILITY_WILDCARD],
    storage: 'file',
    retention: 'limits',
    duplicateWindow: 60_000_000_000, // 60s in nanos
  } satisfies AgentTaskLogDurabilityConfigShape,
)

export const AgentTaskLogDurabilityConfigCustom = (
  config: AgentTaskLogDurabilityConfigShape,
) => Layer.succeed(AgentTaskLogDurabilityConfig, config)

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AgentTaskLogDurabilityEnsureStreamError extends Data.TaggedError(
  'AgentTask/LogDurabilityEnsureStreamError',
)<{
  readonly message: string
  readonly streamName: string
  readonly cause?: unknown
}> {}

export class AgentTaskLogDurabilityPublishError extends Data.TaggedError(
  'AgentTask/LogDurabilityPublishError',
)<{
  readonly message: string
  readonly streamName: string
  readonly taskId: string
  readonly entryId: string
  readonly subject: string
  readonly cause?: unknown
}> {}

export type AgentTaskLogDurabilityError =
  | AgentTaskLogDurabilityEnsureStreamError
  | AgentTaskLogDurabilityPublishError

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface AgentTaskLogDurabilityServiceShape {
  /**
   * Ensure stream topology exists before first publish.
   * Safe to call repeatedly.
   */
  readonly ensureStream: Effect.Effect<
    void,
    AgentTaskLogDurabilityEnsureStreamError
  >

  /**
   * Publish a task log entry and await JetStream ack.
   * Returns a schema-backed durability receipt.
   */
  readonly publishAndAwaitAck: (
    taskId: string,
    entry: AgentTaskLogEntry,
  ) => Effect.Effect<AgentTaskLogDurabilityReceipt, AgentTaskLogDurabilityError>
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

export class AgentTaskLogDurabilityService extends Context.Tag(
  'AgentTask/AgentTaskLogDurabilityService',
)<AgentTaskLogDurabilityService, AgentTaskLogDurabilityServiceShape>() {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

const make = Effect.gen(function* () {
  const stream = yield* NatsStreamService
  const config = yield* AgentTaskLogDurabilityConfig

  const streamReadyRef = yield* Ref.make(false)

  const ensureStream = Effect.gen(function* () {
    const ready = yield* Ref.get(streamReadyRef)
    if (ready) return

    yield* stream
      .ensureStream({
        name: config.streamName,
        subjects: config.subjects,
        storage: config.storage,
        retention: config.retention,
        duplicateWindow: config.duplicateWindow,
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new AgentTaskLogDurabilityEnsureStreamError({
              message: 'Failed to ensure AgentTask log durability stream',
              streamName: config.streamName,
              cause,
            }),
        ),
      )

    yield* Ref.set(streamReadyRef, true)
  }).pipe(
    Effect.withSpan('AgentTask.LogDurability.ensureStream', {
      attributes: {
        streamName: config.streamName,
      },
    }),
  )

  const publishAndAwaitAck: AgentTaskLogDurabilityServiceShape['publishAndAwaitAck'] = (
    taskId,
    entry,
  ) =>
    Effect.gen(function* () {
      yield* ensureStream

      const subject = resolveAgentTaskLogDurabilitySubject(taskId)
      const startedAt = Date.now()

      const ack = yield* stream
        .publish(subject, AgentTaskLogEntrySchema, entry, {
          msgId: entry.id,
          expectStream: config.streamName,
        })
        .pipe(
          Effect.mapError(
            (cause) =>
              new AgentTaskLogDurabilityPublishError({
                message: 'Failed to publish task log entry to JetStream',
                streamName: config.streamName,
                taskId,
                entryId: entry.id,
                subject,
                cause,
              }),
          ),
        )

      const ackedAt = yield* DateTime.now

      const receipt = new AgentTaskLogDurabilityReceipt({
        taskId,
        entryId: entry.id,
        subject,
        stream: ack.stream,
        sequence: ack.seq,
        duplicate: ack.duplicate === true,
        entryTimestamp: entry.timestamp,
        ackedAt,
        publishLatencyMs: Math.max(0, Date.now() - startedAt),
      })

      return yield* Effect.succeed(receipt).pipe(
        Effect.withSpan('AgentTask.LogDurability.ack', {
          attributes: {
            streamName: ack.stream,
            subject,
            sequence: ack.seq,
            duplicate: ack.duplicate === true ? 1 : 0,
          },
        }),
      )
    }).pipe(
      Effect.withSpan('AgentTask.LogDurability.publish', {
        attributes: {
          taskId,
          entryId: entry.id,
          streamName: config.streamName,
        },
      }),
    )

  return {
    ensureStream,
    publishAndAwaitAck,
  } satisfies AgentTaskLogDurabilityServiceShape
})

export const AgentTaskLogDurabilityServiceLive = Layer.effect(
  AgentTaskLogDurabilityService,
  make,
)

/**
 * Convenience layer: durability service + default config.
 *
 * Still requires NatsStreamService (and its transitive NATS dependencies)
 * to be provided upstream.
 */
export const AgentTaskLogDurabilityServiceDefault =
  AgentTaskLogDurabilityServiceLive.pipe(
    Layer.provide(AgentTaskLogDurabilityConfigDefault),
  )
