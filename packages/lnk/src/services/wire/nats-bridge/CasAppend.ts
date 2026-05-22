/**
 * High-level CAS append orchestration.
 *
 * This is the core loop the concrete MSH bridge will use:
 *   1. serialize locally by stream shard;
 *   2. load revisioned metadata from typed KV;
 *   3. ask the Durable Stream kernel for the legal transition;
 *   4. publish one DurableBatchEnvelope with JetStream expectations;
 *   5. commit metadata with KV updateIfRevision;
 *   6. retry boundedly on CAS/tail conflicts.
 */

import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Schedule from "effect-v4/Schedule"

import {
  FetchError,
  InvalidPayloadError,
  SequenceGapError,
  StaleEpochError,
  StreamClosedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"
import { BatchPublisher, PublishExpectationConflictError } from "./BatchPublisher.js"
import { CasMetadataStore, MetadataCasConflictError } from "./CasMetadataStore.js"
import { ShardGuard } from "./ShardGuard.js"
import { type DurableAppendInput, type DurableAppendResult, planAppend } from "./kernel.js"
import { MshBridgeSpan } from "./spans.js"

export interface CasAppendOptions {
  readonly maxAttempts?: number
  /** Effect Duration input for CAS retry spacing. */
  readonly retryDelay?: Duration.Input
  /** @deprecated use retryDelay. Preserved for older bridge tests/callers. */
  readonly retryDelayMs?: number
}

export type CasAppendError =
  | FetchError
  | InvalidPayloadError
  | StaleEpochError
  | SequenceGapError
  | StreamClosedError
  | StreamConfigMismatchError
  | StreamNotFoundError
  | MetadataCasConflictError
  | PublishExpectationConflictError

const DEFAULT_MAX_ATTEMPTS = 8
const DEFAULT_RETRY_DELAY = Duration.millis(5)

const isRetryable = (error: CasAppendError): boolean =>
  error._tag === "MetadataCasConflictError" || error._tag === "PublishExpectationConflictError"

const failMissing = (streamId: DurableAppendInput["streamId"]): StreamNotFoundError =>
  new StreamNotFoundError({ streamId })

export const appendWithCas = (
  input: DurableAppendInput,
  options: CasAppendOptions = {},
): Effect.Effect<
  DurableAppendResult,
  CasAppendError,
  CasMetadataStore | BatchPublisher | ShardGuard
> =>
  Effect.gen(function* () {
    const store = yield* CasMetadataStore
    const publisher = yield* BatchPublisher
    const guard = yield* ShardGuard
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    const retryDelay = options.retryDelay !== undefined
      ? Duration.fromInputUnsafe(options.retryDelay)
      : options.retryDelayMs !== undefined
      ? Duration.millis(options.retryDelayMs)
      : DEFAULT_RETRY_DELAY
    const retryPolicy = Schedule.spaced(retryDelay).pipe(
      Schedule.satisfiesInputType<CasAppendError>(),
      Schedule.both(Schedule.recurs(Math.max(0, maxAttempts - 1))),
      Schedule.while((metadata) => isRetryable(metadata.input)),
    )

    const attempt = Effect.gen(function* () {
      const current = yield* store.get(input.streamId)
      if (!current) return yield* failMissing(input.streamId)

      const plan = yield* planAppend(current.metadata, input)
      switch (plan._tag) {
        case "Duplicate":
          return plan.result
        case "MetadataOnly":
          yield* store.updateIfRevision(input.streamId, plan.metadata, current.revision)
          return plan.result
        case "Publish": {
          const ack = yield* publisher.publish({
            streamId: input.streamId,
            envelope: plan.envelope,
            msgID: plan.msgID,
            expectedLastSubjectSequence: plan.expectedLastSubjectSequence,
          })
          const nextMetadata = plan.commit({ subjectSequence: ack.subjectSequence })
          yield* store.updateIfRevision(input.streamId, nextMetadata, current.revision)
          return {
            ...plan.result,
            duplicate: plan.result.duplicate || ack.duplicate,
          }
        }
      }
    }).pipe(Effect.withSpan(MshBridgeSpan.CAS.attempt))

    return yield* guard.withStream(input.streamId)(
      attempt.pipe(Effect.retry(retryPolicy)),
    )
  }).pipe(Effect.withSpan(MshBridgeSpan.CAS.append))
