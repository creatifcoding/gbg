/** Concrete MshBridgePort implementation over MSH substrate seams. */

import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Stream from "effect-v4/Stream"
import { NatsStreamService } from "@tmnl/msh/nats"

import { framingMode } from "../../../contracts/ContentType.js"
import { trust as trustOffset } from "../../../contracts/Offset.js"
import {
  FetchError,
  InvalidOffsetError,
  InvalidPayloadError,
  RetentionDroppedError,
  StreamConfigMismatchError,
  StreamNotFoundError,
} from "../../../contracts/errors.js"
import { splitPostBody, isEmptyArrayBytes, assembleGetBody } from "../framing.js"
import { BatchPublisher, PublishExpectationConflictError } from "./BatchPublisher.js"
import { appendWithCas } from "./CasAppend.js"
import { CasMetadataStore, MetadataCasConflictError, type MetadataStoreError, type RevisionedMetadata } from "./CasMetadataStore.js"
import {
  resolveMshBridgeSubstrateOptions,
  streamNameForStream,
  subjectForStream,
  type MshBridgeSubstrateOptions,
} from "./MshBridgeConfig.js"
import { NatsBridgePort } from "./Port.js"
import { ShardGuard } from "./ShardGuard.js"
import { makeAppendIntent, toDurableAppendInput, toDurableCreateInput } from "./intents.js"
import {
  DurableBatchEnvelope,
  makeInitialMetadata,
  planCreate,
  positionToStartSeq,
} from "./kernel.js"
import { MshBridgeSpan } from "./spans.js"

const EMPTY_TAIL_OFFSET = trustOffset("-")
const NATS_MIN_FETCH_EXPIRES = Duration.seconds(1)
const DEFAULT_LIVE_WAIT = Duration.seconds(5)
const LIVE_POLL_INTERVAL = Duration.millis(50)

const liveWaitDuration = (timeout: Duration.Input | undefined): Duration.Duration =>
  timeout === undefined ? DEFAULT_LIVE_WAIT : Duration.fromInputUnsafe(timeout)

const natsPullExpiresMillis = (): number => Duration.toMillis(NATS_MIN_FETCH_EXPIRES)

const toFetchError = (message: string, cause: unknown, status = 500): FetchError =>
  cause instanceof FetchError ? cause : new FetchError({ status, message, cause })

const mapSubstrateError = (message: string, status = 500) => (cause: unknown): FetchError =>
  toFetchError(message, cause, status)

const mapCasExhausted = (cause: unknown): FetchError => {
  if (cause instanceof FetchError) return cause
  if (cause instanceof MetadataCasConflictError || cause instanceof PublishExpectationConflictError) {
    return new FetchError({ status: 409, message: cause.message, cause })
  }
  return new FetchError({ status: 500, message: "MSH bridge CAS operation failed", cause })
}

const mapMetadataCommitError = (cause: MetadataStoreError): FetchError =>
  cause instanceof FetchError
    ? cause
    : new FetchError({ status: 409, message: cause.message, cause })

export class MshBridgePortLive {
  static readonly layer = (
    options: MshBridgeSubstrateOptions = {},
  ): Layer.Layer<NatsBridgePort, never, CasMetadataStore | BatchPublisher | ShardGuard | NatsStreamService> => {
    const resolved = resolveMshBridgeSubstrateOptions(options)
    return Layer.effect(
      NatsBridgePort,
      Effect.gen(function* () {
        const store = yield* CasMetadataStore
        const publisher = yield* BatchPublisher
        const guard = yield* ShardGuard
        const stream = yield* NatsStreamService
        const appendLayer = Layer.mergeAll(
          Layer.succeed(CasMetadataStore)(CasMetadataStore.of(store)),
          Layer.succeed(BatchPublisher)(BatchPublisher.of(publisher)),
          Layer.succeed(ShardGuard)(ShardGuard.of(guard)),
        )

        const ensureDataStream = (streamId: Parameters<typeof streamNameForStream>[0]) =>
          stream.ensureStream({
            name: streamNameForStream(streamId, resolved),
            subjects: [subjectForStream(streamId, resolved)],
          }).pipe(
            Effect.mapError(mapSubstrateError(`Failed to ensure MSH bridge stream '${streamId as string}'`)),
          )

        return NatsBridgePort.of({
          create: (input) =>
            Effect.gen(function* () {
              yield* ensureDataStream(input.streamId)
              const existing = yield* store.get(input.streamId)
              const hasAppendBody = input.body !== undefined &&
                input.body.length > 0 &&
                !(framingMode(input.contentType as string) === "json" && isEmptyArrayBytes(input.body))
              const createPlan = yield* planCreate(
                existing?.metadata ?? null,
                toDurableCreateInput(input, hasAppendBody),
              )

              if (createPlan.needsCommit) {
                if (existing) {
                  yield* store.updateIfRevision(input.streamId, createPlan.metadata, existing.revision).pipe(
                    Effect.mapError(mapMetadataCommitError),
                  )
                } else {
                  yield* store.create(input.streamId, createPlan.metadata).pipe(
                    Effect.mapError(mapMetadataCommitError),
                  )
                }
              }

              if (hasAppendBody) {
                const messages = yield* splitPostBody(input.streamId as string, input.contentType as string, input.body!).pipe(
                  Effect.mapError((error) => new FetchError({
                    status: 400,
                    message: `Invalid PUT body for stream '${input.streamId as string}'`,
                    cause: error,
                  })),
                )
                const appendInput = toDurableAppendInput(
                  makeAppendIntent({
                    streamId: input.streamId,
                    contentType: input.contentType,
                    streamClosed: input.streamClosed,
                  }, messages),
                )
                const appended = yield* appendWithCas(appendInput).pipe(
                  Effect.provide(appendLayer),
                  Effect.mapError(mapCasExhausted),
                )
                return {
                  streamId: input.streamId,
                  contentType: input.contentType,
                  created: createPlan.created,
                  closed: appended.closed,
                  nextOffset: appended.nextOffset,
                  ...(input.schemaId !== undefined ? { schemaId: input.schemaId } : {}),
                }
              }

              return {
                streamId: input.streamId,
                contentType: createPlan.metadata.contentType,
                created: createPlan.created,
                closed: createPlan.metadata.closed,
                nextOffset: createPlan.metadata.lastOffset ?? EMPTY_TAIL_OFFSET,
                ...(createPlan.metadata.schemaId !== undefined ? { schemaId: createPlan.metadata.schemaId } : {}),
                ...(createPlan.metadata.ttl !== undefined ? { ttl: createPlan.metadata.ttl } : {}),
                ...(createPlan.metadata.expiresAt !== undefined ? { expiresAt: createPlan.metadata.expiresAt } : {}),
              }
            }).pipe(Effect.withSpan(MshBridgeSpan.Port.create)),

          append: (input) =>
            Effect.gen(function* () {
              const current = yield* store.get(input.streamId)
              if (!current) return yield* new StreamNotFoundError({ streamId: input.streamId })
              yield* ensureDataStream(input.streamId)
              const explicitClientCt = input.contentType !== undefined &&
                (input.contentType as string) !== "application/octet-stream"
                  ? input.contentType
                  : undefined
              const messages = input.body.length === 0
                ? []
                : yield* splitPostBody(input.streamId as string, current.metadata.contentType as string, input.body)
              const intent = makeAppendIntent(input, messages, explicitClientCt)
              return yield* appendWithCas(toDurableAppendInput(intent)).pipe(
                Effect.provide(appendLayer),
                Effect.mapError(mapCasExhausted),
              )
            }).pipe(Effect.withSpan(MshBridgeSpan.Port.append)),

          read: (input) =>
            Effect.gen(function* () {
              const current = yield* store.get(input.streamId)
              if (!current) return yield* new StreamNotFoundError({ streamId: input.streamId })
              const startSeq = positionToStartSeq(input.position, current.metadata)
              if (startSeq === null) {
                return yield* new InvalidOffsetError({
                  value: input.position as string,
                  reason: "forbidden-characters",
                })
              }

              const requestedStartSeq = startSeq === "now" ? current.metadata.nextSeq : startSeq
              const hasReadableData = (entry: RevisionedMetadata): boolean =>
                entry.metadata.nextSeq > requestedStartSeq

              const emptyResult = (entry: RevisionedMetadata) => ({
                body: assembleGetBody(entry.metadata.contentType as string, Stream.empty),
                upToDate: true as const,
                ...(entry.metadata.closed ? { closed: true as const } : {}),
                ...(entry.metadata.lastOffset !== undefined ? { nextOffset: entry.metadata.lastOffset } : {}),
                ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
              })

              if (input.live === undefined && !hasReadableData(current)) {
                return emptyResult(current)
              }

              type ReadWaitState =
                | { readonly _tag: "Readable"; readonly entry: RevisionedMetadata }
                | { readonly _tag: "Waiting"; readonly entry: RevisionedMetadata }

              const classifyReadWait = (entry: RevisionedMetadata): ReadWaitState =>
                entry.metadata.closed || hasReadableData(entry)
                  ? { _tag: "Readable", entry }
                  : { _tag: "Waiting", entry }

              const awaitReadableMetadata = (snapshot: RevisionedMetadata) =>
                Effect.gen(function* () {
                  let state = classifyReadWait(snapshot)
                  while (state._tag === "Waiting") {
                    yield* Effect.sleep(LIVE_POLL_INTERVAL)
                    const next = yield* store.get(input.streamId)
                    if (!next) return yield* new StreamNotFoundError({ streamId: input.streamId })
                    state = classifyReadWait(next)
                  }
                  return state.entry
                }).pipe(
                  Effect.timeoutOrElse({
                    duration: liveWaitDuration(input.timeout),
                    orElse: () => Effect.succeed(snapshot),
                  }),
                )

              const readable = input.live === undefined || current.metadata.closed || hasReadableData(current)
                ? current
                : yield* awaitReadableMetadata(current)

              if (!hasReadableData(readable)) return emptyResult(readable)

              const batchCount = readable.metadata.lastSubjectSequence
              const batches = batchCount === 0
                ? []
                : yield* Effect.gen(function* () {
                  yield* ensureDataStream(input.streamId)
                  const consumer = yield* stream.getConsumer(streamNameForStream(input.streamId, resolved), undefined, {
                    deliverPolicy: "all",
                    ackPolicy: "explicit",
                    filterSubject: subjectForStream(input.streamId, resolved),
                  }).pipe(Effect.mapError(mapSubstrateError(`Failed to get MSH bridge consumer for '${input.streamId as string}'`)))
                  return yield* stream.fetch(consumer, DurableBatchEnvelope, {
                    max: batchCount,
                    expires: natsPullExpiresMillis(),
                  }).pipe(Effect.mapError(mapSubstrateError(`Failed to read MSH bridge batches for '${input.streamId as string}'`)))
                })

              const messages = batches.flatMap((batch) => batch.data.messages)
                .filter((message) => {
                  const parsed = /^msh:(\d{20})_/.exec(message.offset as string)
                  return parsed ? Number(parsed[1]) >= requestedStartSeq : false
                })
                .slice(0, input.limit ?? Number.MAX_SAFE_INTEGER)
              const rawBody = Stream.fromIterable(messages.map((message) => message.body))
              return {
                body: assembleGetBody(readable.metadata.contentType as string, rawBody),
                nextOffset: messages.at(-1)?.offset ?? readable.metadata.lastOffset ?? EMPTY_TAIL_OFFSET,
                upToDate: true as const,
                ...(readable.metadata.closed ? { closed: true as const } : {}),
                ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
              }
            }).pipe(Effect.withSpan(MshBridgeSpan.Port.read)),

          metadata: (streamId) =>
            Effect.gen(function* () {
              const current = yield* store.get(streamId)
              if (!current) return yield* new StreamNotFoundError({ streamId })
              return {
                streamId,
                contentType: current.metadata.contentType,
                closed: current.metadata.closed,
                nextOffset: current.metadata.lastOffset ?? EMPTY_TAIL_OFFSET,
                ...(current.metadata.schemaId !== undefined ? { schemaId: current.metadata.schemaId } : {}),
                ...(current.metadata.ttl !== undefined ? { ttl: current.metadata.ttl } : {}),
                ...(current.metadata.expiresAt !== undefined ? { expiresAt: current.metadata.expiresAt } : {}),
              }
            }).pipe(Effect.withSpan(MshBridgeSpan.Port.metadata)),

          delete: (streamId) =>
            Effect.gen(function* () {
              const current = yield* store.get(streamId)
              if (!current) return { deleted: false }
              yield* store.deleteIfRevision(streamId, current.revision).pipe(
                Effect.mapError(mapMetadataCommitError),
              )
              yield* stream.deleteStream(streamNameForStream(streamId, resolved)).pipe(
                Effect.orElseSucceed(() => false),
              )
              return { deleted: true }
            }).pipe(Effect.withSpan(MshBridgeSpan.Port.delete)),
        })
      }),
    )
  }
}
