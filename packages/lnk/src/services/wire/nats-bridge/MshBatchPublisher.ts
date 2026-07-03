/** Concrete BatchPublisher backed by @tmnl/msh JetStream publish. */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { NatsStreamService } from "@tmnl/msh/nats"

import { FetchError } from "../../../contracts/errors.js"
import {
  BatchPublisher,
  PublishExpectationConflictError,
  type PublishBatchInput,
} from "./BatchPublisher.js"
import {
  resolveMshBridgeSubstrateOptions,
  streamNameForStream,
  subjectForStream,
  type MshBridgeSubstrateOptions,
} from "./MshBridgeConfig.js"
import { DurableBatchEnvelope } from "./kernel.js"
import { MshBridgeSpan } from "./spans.js"

const errorText = (error: unknown): string => {
  if (typeof error !== "object" || error === null) return String(error)
  const message = "message" in error ? String((error as { readonly message?: unknown }).message ?? "") : ""
  const cause = "cause" in error ? errorText((error as { readonly cause?: unknown }).cause) : ""
  return `${message} ${cause}`.trim()
}

const hasJetStreamConflictCode = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false
  if ("api_error" in error) {
    const apiError = (error as { readonly api_error?: { readonly err_code?: unknown } }).api_error
    if (apiError?.err_code === 10071) return true
  }
  return "cause" in error && hasJetStreamConflictCode((error as { readonly cause?: unknown }).cause)
}

const isPublishExpectationConflict = (error: unknown): boolean => {
  const text = errorText(error).toLowerCase()
  return hasJetStreamConflictCode(error) ||
    text.includes("wrong last sequence") ||
    text.includes("wrong last seq") ||
    text.includes("last sequence mismatch")
}

const mapPublishError = (input: PublishBatchInput) => (error: unknown) =>
  isPublishExpectationConflict(error)
    ? new PublishExpectationConflictError({
        streamId: input.streamId,
        expectedLastSubjectSequence: input.expectedLastSubjectSequence,
        message: "JetStream publish expectation conflict",
        cause: error,
      })
    : new FetchError({
        status: 500,
        message: `MSH JetStream publish failed for stream '${input.streamId as string}'`,
        cause: error,
      })

export class MshBatchPublisher {
  static readonly layer = (
    options: MshBridgeSubstrateOptions = {},
  ): Layer.Layer<BatchPublisher, never, NatsStreamService> => {
    const resolved = resolveMshBridgeSubstrateOptions(options)
    return Layer.effect(
      BatchPublisher,
      Effect.gen(function* () {
        const stream = yield* NatsStreamService
        return BatchPublisher.of({
          publish: (input) =>
            stream.publish(
              subjectForStream(input.streamId, resolved),
              DurableBatchEnvelope,
              input.envelope,
              {
                msgId: input.msgID,
                expectStream: streamNameForStream(input.streamId, resolved),
                expectLastSubjectSequence: input.expectedLastSubjectSequence,
              },
            ).pipe(
              Effect.map((ack) => ({
                subjectSequence: ack.seq,
                duplicate: ack.duplicate === true,
              })),
              Effect.mapError(mapPublishError(input)),
              Effect.withSpan(MshBridgeSpan.Publisher.publish),
            ),
        })
      }),
    )
  }
}
