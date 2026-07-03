/**
 * LNK adapters for ProjectionWorker runtime ports.
 *
 * These adapters consume LNK's public Durable Streams wire surface. They do not
 * parse MSH/JetStream offsets. Offset authority stays in LNK; PCT only requires
 * that a source read yields a real durable offset before constructing a
 * ProjectionSourceMessage.
 *
 * @module @tmnl/pct/frames/ProjectionLnkAdapters
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import { ContentType, Producer, StreamId } from "@tmnl/lnk/contracts"
import { Wire } from "@tmnl/lnk/services/wire"

import {
  ProjectionOutboxError,
  type ProjectionOutboxRecord as ProjectionOutboxRecordType,
} from "./ProjectionDurableRuntime.js"
import {
  ProjectionRuntimeError,
  ProjectionSourceReader,
  type ProjectionSourceReaderShape,
} from "./ProjectionRuntime.js"
import {
  ProjectionOutputReceipt,
  type ProjectionOutputReceipt as ProjectionOutputReceiptType,
  type ProjectionSourceMessage as ProjectionSourceMessageType,
  type ProjectionWorkerConfig as ProjectionWorkerConfigType,
} from "./ProjectionWorker.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionLnkSourceReadError extends Schema.TaggedErrorClass<ProjectionLnkSourceReadError>()(
  "ProjectionLnkSourceReadError",
  {
    projectionId: Schema.String,
    streamId: Schema.String,
    message: Schema.String,
  },
) {}

export class ProjectionLnkFramePublishError extends Schema.TaggedErrorClass<ProjectionLnkFramePublishError>()(
  "ProjectionLnkFramePublishError",
  {
    projectionId: Schema.String,
    outboxId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Source reader ──────────────────────────────────────────────────────────

export interface ProjectionLnkSourceReaderOptions {
  /** Runtime receive timestamp for deterministic tests. Defaults to Date.now(). */
  readonly now?: () => number
}

const jsonContentType = ContentType.trust("application/json")
const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()

const getPath = (value: unknown, path: ReadonlyArray<string>): unknown => {
  let current = value
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const pathLabel = (path: ReadonlyArray<string>): string => path.at(-1) ?? path.join(".")

const entityKeyFromPayload = (
  payload: unknown,
  keyFields: ReadonlyArray<ReadonlyArray<string>>,
): Record<string, unknown> => {
  const entityKey: Record<string, unknown> = {}
  for (const field of keyFields) entityKey[pathLabel(field)] = getPath(payload, field)
  return entityKey
}

const collectBodyJson = (
  projectionId: string,
  streamId: string,
  body: Stream.Stream<Uint8Array, unknown, never>,
): Effect.Effect<ReadonlyArray<unknown>, ProjectionLnkSourceReadError> =>
  Effect.gen(function* () {
    const chunks = yield* Stream.runCollect(body).pipe(
      Effect.mapError((error) => new ProjectionLnkSourceReadError({
        projectionId,
        streamId,
        message: `failed to collect LNK source body: ${String(error)}`,
      })),
    )
    const bytes = Array.from(chunks)
    const total = bytes.reduce((sum, chunk) => sum + chunk.length, 0)
    if (total === 0) return []
    const combined = new Uint8Array(total)
    let offset = 0
    for (const chunk of bytes) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(textDecoder.decode(combined))
    } catch (error) {
      return yield* Effect.fail(new ProjectionLnkSourceReadError({
        projectionId,
        streamId,
        message: `failed to decode LNK JSON source body: ${error instanceof Error ? error.message : String(error)}`,
      }))
    }
    return Array.isArray(parsed) ? parsed : [parsed]
  })

const readOneSourceMessage = (
  wire: Wire["Service"],
  config: ProjectionWorkerConfigType,
  source: ProjectionWorkerConfigType["spec"]["sources"][number],
  position: string,
  now: () => number,
): Effect.Effect<ProjectionSourceMessageType | undefined, ProjectionLnkSourceReadError> =>
  Effect.gen(function* () {
    const result = yield* Effect.scoped(wire.get({
      streamId: StreamId.trust(source.streamId),
      position: position as never,
      limit: 1,
    })).pipe(
      Effect.mapError((error) => new ProjectionLnkSourceReadError({
        projectionId: config.spec.id,
        streamId: source.streamId,
        message: `failed to read LNK source stream: ${error instanceof Error ? error.message : String(error)}`,
      })),
    )
    const payloads = yield* collectBodyJson(config.spec.id, source.streamId, result.body)
    if (payloads.length === 0) return undefined
    if (result.nextOffset === undefined) {
      return yield* Effect.fail(new ProjectionLnkSourceReadError({
        projectionId: config.spec.id,
        streamId: source.streamId,
        message: "LNK source read did not return a durable offset; projection source reads require limit=1/per-message offset semantics",
      }))
    }
    const payload = payloads[0]
    const observedAt = getPath(payload, source.timeField)
    if (typeof observedAt !== "string") {
      return yield* Effect.fail(new ProjectionLnkSourceReadError({
        projectionId: config.spec.id,
        streamId: source.streamId,
        message: `source payload timeField ${source.timeField.join(".")} did not decode to a string timestamp`,
      }))
    }
    return {
      projectionId: config.spec.id,
      streamId: source.streamId,
      offset: result.nextOffset as string,
      schemaId: source.schemaId,
      partKey: source.as,
      observedAt,
      entityKey: entityKeyFromPayload(payload, source.keyFields),
      payload,
      receivedAt: now(),
    }
  })

export const projectionSourceReaderLayerLnkWire = (
  options: ProjectionLnkSourceReaderOptions = {},
): Layer.Layer<ProjectionSourceReader, never, Wire> =>
  Layer.effect(
    ProjectionSourceReader,
    Effect.gen(function* () {
      const wire = yield* Wire
      const now = options.now ?? Date.now
      const reader: ProjectionSourceReaderShape = {
        read: (config) =>
          Effect.gen(function* () {
            const messages: ProjectionSourceMessageType[] = []
            for (const source of config.spec.sources) {
              if (messages.length >= config.maxMessagesPerTick) break
              const message = yield* readOneSourceMessage(wire, config, source, "-1", now)
              if (message !== undefined) messages.push(message)
            }
            return messages
          }),
      }
      return ProjectionSourceReader.of(reader)
    }),
  )

// ─── Frame stream publisher ─────────────────────────────────────────────────

export interface ProjectionFrameStreamPublisherShape {
  readonly publish: (
    record: ProjectionOutboxRecordType,
  ) => Effect.Effect<ProjectionOutputReceiptType, ProjectionLnkFramePublishError>
}

export interface ProjectionFrameStreamPublisherServiceShape {
  readonly publish: ProjectionFrameStreamPublisherShape["publish"]
}

export class ProjectionFrameStreamPublisherService extends Context.Service<
  ProjectionFrameStreamPublisherService,
  ProjectionFrameStreamPublisherServiceShape
>()("@tmnl/pct/frames/ProjectionFrameStreamPublisherService") {}

export const projectionFrameStreamPublisherLayerLnkWire: Layer.Layer<
  ProjectionFrameStreamPublisherService,
  never,
  Wire
> = Layer.effect(
  ProjectionFrameStreamPublisherService,
  Effect.gen(function* () {
    const wire = yield* Wire
    return ProjectionFrameStreamPublisherService.of({
      publish: (record) =>
        Effect.gen(function* () {
          yield* wire.put({
            streamId: StreamId.trust(record.target),
            contentType: jsonContentType,
            schemaId: record.frame.outputSchemaId,
          }).pipe(
            Effect.mapError((error) => new ProjectionLnkFramePublishError({
              projectionId: record.projectionId,
              outboxId: record.outboxId,
              message: `failed to ensure LNK frame stream: ${error instanceof Error ? error.message : String(error)}`,
            })),
          )
          const body = textEncoder.encode(JSON.stringify(record.frame))
          const result = yield* wire.post({
            streamId: StreamId.trust(record.target),
            contentType: jsonContentType,
            body,
            producer: {
              producerId: Producer.trustProducerId(record.producerId),
              epoch: Producer.trustEpoch(record.producerEpoch),
              seq: Producer.trustSeq(record.producerSeq),
            },
            streamSeq: record.idempotencyKey,
          }).pipe(
            Effect.mapError((error) => new ProjectionLnkFramePublishError({
              projectionId: record.projectionId,
              outboxId: record.outboxId,
              message: `failed to publish LNK frame stream event: ${error instanceof Error ? error.message : String(error)}`,
            })),
          )
          return ProjectionOutputReceipt.make({
            kind: "lnk-frame-stream",
            projectionId: record.projectionId,
            frameId: record.frameId,
            target: record.target,
            idempotencyKey: record.idempotencyKey,
            writtenAt: Date.now(),
          })
        }),
    })
  }),
)

export const projectionOutboxRecordToRuntimeError = (
  error: ProjectionLnkFramePublishError,
): ProjectionOutboxError =>
  new ProjectionOutboxError({
    outboxId: error.outboxId,
    message: error.message,
  })

export const projectionLnkSourceReadErrorToRuntimeError = (
  error: ProjectionLnkSourceReadError,
): ProjectionRuntimeError =>
  new ProjectionRuntimeError({
    projectionId: error.projectionId,
    message: error.message,
  })
