/**
 * Durable batch publisher seam for MshBridgePort.
 *
 * Concrete MSH implementation publishes `DurableBatchEnvelope` to JetStream
 * with `msgID` and `expect.lastSubjectSequence`. This interface keeps those
 * substrate mechanics out of the CAS planner.
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import { StreamId } from "../../../contracts/StreamId.js"
import { FetchError } from "../../../contracts/errors.js"
import { DurableBatchEnvelope } from "./kernel.js"

export class PublishExpectationConflictError extends Schema.TaggedErrorClass<PublishExpectationConflictError>(
  "@tmnl/lnk/PublishExpectationConflictError",
)("PublishExpectationConflictError", {
  streamId: StreamId,
  expectedLastSubjectSequence: Schema.Number,
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export interface PublishBatchInput {
  readonly streamId: typeof StreamId.Type
  readonly envelope: DurableBatchEnvelope
  readonly msgID: string
  readonly expectedLastSubjectSequence: number
}

export interface PublishBatchAck {
  readonly subjectSequence: number
  readonly duplicate: boolean
}

export interface BatchPublisherShape {
  readonly publish: (
    input: PublishBatchInput,
  ) => Effect.Effect<PublishBatchAck, FetchError | PublishExpectationConflictError>
}

export class BatchPublisher extends Context.Service<
  BatchPublisher,
  BatchPublisherShape
>()("@tmnl/lnk/services/wire/nats-bridge/BatchPublisher") {}
