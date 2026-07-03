/**
 * Projection output outbox publisher lane.
 *
 * Drains durable frame-stream outbox records and delegates the actual LNK append
 * to an injected publisher. This keeps dual-system output crash-safe: Timescale
 * owns the outbox transaction, this lane only marks publish results.
 *
 * @module @tmnl/pct/frames/ProjectionOutboxPublisher
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

import {
  ProjectionOutputOutbox,
  type ProjectionOutputOutboxShape,
  type ProjectionOutboxRecord as ProjectionOutboxRecordType,
} from "./ProjectionDurableRuntime.js"
import {
  ProjectionFrameStreamPublisherService,
  type ProjectionFrameStreamPublisherServiceShape,
} from "./ProjectionLnkAdapters.js"

export const ProjectionOutboxPublishRequest = Schema.Struct({
  projectionId: Schema.optional(Schema.String),
  limit: Schema.Int,
  now: Schema.optional(Schema.Number),
  retryDelayMs: Schema.optional(Schema.Int),
  poisonAfterAttempts: Schema.optional(Schema.Int),
})
export type ProjectionOutboxPublishRequest = typeof ProjectionOutboxPublishRequest.Type

export const ProjectionOutboxPublishAttempt = Schema.Struct({
  outboxId: Schema.String,
  projectionId: Schema.String,
  frameId: Schema.String,
  published: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
})
export type ProjectionOutboxPublishAttempt = typeof ProjectionOutboxPublishAttempt.Type

export const ProjectionOutboxPublishSummary = Schema.Struct({
  requested: Schema.Int,
  attempted: Schema.Int,
  published: Schema.Int,
  failed: Schema.Int,
  attempts: Schema.Array(ProjectionOutboxPublishAttempt),
  startedAt: Schema.Number,
  finishedAt: Schema.Number,
})
export type ProjectionOutboxPublishSummary = typeof ProjectionOutboxPublishSummary.Type

export interface ProjectionOutboxPublisherShape {
  readonly drain: (request: ProjectionOutboxPublishRequest) => Effect.Effect<ProjectionOutboxPublishSummary, unknown>
}

export class ProjectionOutboxPublisher extends Context.Service<
  ProjectionOutboxPublisher,
  ProjectionOutboxPublisherShape
>()("@tmnl/pct/frames/ProjectionOutboxPublisher") {}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const publishOne = (
  outbox: ProjectionOutputOutboxShape,
  publisher: ProjectionFrameStreamPublisherServiceShape,
  record: ProjectionOutboxRecordType,
  request: ProjectionOutboxPublishRequest,
): Effect.Effect<ProjectionOutboxPublishAttempt, unknown> =>
  Effect.gen(function* () {
    const receipt = yield* Effect.result(publisher.publish(record))
    if (receipt._tag === "Success") {
      yield* outbox.markPublished({
        outboxId: record.outboxId,
        receipt: receipt.success,
        ...(request.now !== undefined ? { now: request.now } : {}),
      })
      return ProjectionOutboxPublishAttempt.make({
        outboxId: record.outboxId,
        projectionId: record.projectionId,
        frameId: record.frameId,
        published: true,
        error: null,
      })
    }

    const message = errorMessage(receipt.failure)
    const retryDelayMs = request.retryDelayMs ?? 1_000
    const poisonAfterAttempts = request.poisonAfterAttempts ?? 5
    const now = request.now ?? Date.now()
    yield* outbox.markFailed({
      outboxId: record.outboxId,
      error: message,
      retryAt: now + retryDelayMs,
      poison: record.attempt + 1 >= poisonAfterAttempts,
      now,
    })
    return ProjectionOutboxPublishAttempt.make({
      outboxId: record.outboxId,
      projectionId: record.projectionId,
      frameId: record.frameId,
      published: false,
      error: message,
    })
  })

export const projectionOutboxPublisherLayer: Layer.Layer<
  ProjectionOutboxPublisher,
  never,
  ProjectionOutputOutbox | ProjectionFrameStreamPublisherService
> = Layer.effect(
  ProjectionOutboxPublisher,
  Effect.gen(function* () {
    const outbox = yield* ProjectionOutputOutbox
    const publisher = yield* ProjectionFrameStreamPublisherService
    return ProjectionOutboxPublisher.of({
      drain: (request) =>
        Effect.gen(function* () {
          const startedAt = request.now ?? Date.now()
          const pending = yield* outbox.pending({
            projectionId: request.projectionId,
            limit: request.limit,
            now: startedAt,
          })
          const attempts = [] as ProjectionOutboxPublishAttempt[]
          for (const record of pending) attempts.push(yield* publishOne(outbox, publisher, record, request))
          const finishedAt = request.now ?? Date.now()
          return ProjectionOutboxPublishSummary.make({
            requested: request.limit,
            attempted: attempts.length,
            published: attempts.filter((attempt) => attempt.published).length,
            failed: attempts.filter((attempt) => !attempt.published).length,
            attempts,
            startedAt,
            finishedAt,
          })
        }),
    })
  }),
)
