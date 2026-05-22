/** MshBridgeWire conformance over the concrete PortLive CAS seams. */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import { NatsStreamService } from "@tmnl/msh/nats"

import { trust as trustStreamId, type StreamId } from "../../../../src/contracts/StreamId.js"
import { BatchPublisher, PublishExpectationConflictError } from "../../../../src/services/wire/nats-bridge/BatchPublisher.js"
import { CasMetadataStore, MetadataCasConflictError } from "../../../../src/services/wire/nats-bridge/CasMetadataStore.js"
import { MshBridgePortLive } from "../../../../src/services/wire/nats-bridge/MshBridgePortLive.js"
import { MshBridgeWire } from "../../../../src/services/wire/nats-bridge/MshBridgeWire.js"
import { ShardGuard } from "../../../../src/services/wire/nats-bridge/ShardGuard.js"
import {
  streamNameForStream,
  subjectForStream,
  resolveMshBridgeSubstrateOptions,
} from "../../../../src/services/wire/nats-bridge/MshBridgeConfig.js"
import { NatsBridgePort } from "../../../../src/services/wire/nats-bridge/Port.js"
import type { DurableBatchEnvelope, DurableStreamMetadata } from "../../../../src/services/wire/nats-bridge/kernel.js"
import { runConformance } from "../conformance.js"

interface RecordState {
  revision: number
  metadata: DurableStreamMetadata
  subjectSequence: number
  envelopes: DurableBatchEnvelope[]
}

const makeConformanceLayer = () => {
  const options = resolveMshBridgeSubstrateOptions({
    subjectRoot: "_test.msh.conformance",
    streamNamePrefix: "MSHCONF",
    metadataBucket: "MSHCONF_META",
  })
  const records = new Map<string, RecordState>()
  const streamNameToId = new Map<string, StreamId>()

  const storeLayer = Layer.succeed(CasMetadataStore)(CasMetadataStore.of({
    get: (streamId) => {
      const record = records.get(streamId as string)
      return Effect.succeed(record ? { metadata: record.metadata, revision: record.revision } : null)
    },
    create: (streamId, metadata) => {
      if (records.has(streamId as string)) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision: 0,
          message: "metadata already exists",
        }))
      }
      records.set(streamId as string, {
        revision: 1,
        metadata,
        subjectSequence: 0,
        envelopes: [],
      })
      return Effect.succeed(1)
    },
    updateIfRevision: (streamId, metadata, expectedRevision) => {
      const record = records.get(streamId as string)
      if (!record || record.revision !== expectedRevision) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision,
          message: "stale metadata revision",
        }))
      }
      record.revision += 1
      record.metadata = metadata
      return Effect.succeed(record.revision)
    },
    deleteIfRevision: (streamId, expectedRevision) => {
      const record = records.get(streamId as string)
      if (!record || record.revision !== expectedRevision) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision,
          message: "stale metadata revision",
        }))
      }
      records.delete(streamId as string)
      streamNameToId.delete(streamNameForStream(streamId, options))
      return Effect.void
    },
  }))

  const publisherLayer = Layer.succeed(BatchPublisher)(BatchPublisher.of({
    publish: (input) => {
      const record = records.get(input.streamId as string)
      if (!record) {
        return Effect.fail(new PublishExpectationConflictError({
          streamId: input.streamId,
          expectedLastSubjectSequence: input.expectedLastSubjectSequence,
          message: "stream metadata missing",
        }))
      }
      if (record.subjectSequence !== input.expectedLastSubjectSequence) {
        return Effect.fail(new PublishExpectationConflictError({
          streamId: input.streamId,
          expectedLastSubjectSequence: input.expectedLastSubjectSequence,
          message: "wrong last subject sequence",
        }))
      }
      record.subjectSequence += 1
      record.envelopes.push(input.envelope)
      return Effect.succeed({ subjectSequence: record.subjectSequence, duplicate: false })
    },
  }))

  const streamLayer = Layer.succeed(NatsStreamService)(NatsStreamService.of({
    ensureStream: (config: { readonly name: string; readonly subjects?: readonly string[] }) => {
      const subject = config.subjects?.[0]
      if (subject !== undefined) {
        for (const streamIdText of records.keys()) {
          const streamId = trustStreamId(streamIdText)
          if (subject === subjectForStream(streamId, options)) {
            streamNameToId.set(config.name, streamId)
            break
          }
        }
      }
      return Effect.succeed({ config, state: {} })
    },
    deleteStream: (name: string) => {
      const streamId = streamNameToId.get(name)
      if (streamId !== undefined) records.delete(streamId as string)
      streamNameToId.delete(name)
      return Effect.succeed(true)
    },
    getConsumer: (streamName: string) => Effect.succeed({ streamName }),
    fetch: (consumer: { readonly streamName: string }) => {
      const streamId = streamNameToId.get(consumer.streamName)
      const record = streamId === undefined ? undefined : records.get(streamId as string)
      return Effect.succeed((record?.envelopes ?? []).map((data, index) => ({
        subject: streamId === undefined ? "_missing" : subjectForStream(streamId, options),
        data,
        seq: index + 1,
        time: new Date(0),
        ack: () => Effect.void,
        nak: () => Effect.void,
        working: () => Effect.void,
        term: () => Effect.void,
      })))
    },
  } as never))

  const portLayer = MshBridgePortLive.layer(options).pipe(
    Layer.provide(Layer.mergeAll(storeLayer, publisherLayer, streamLayer, ShardGuard.layer({ shardCount: 8 }))),
  ) as Layer.Layer<NatsBridgePort>

  return MshBridgeWire.layerFromPort(options).pipe(Layer.provide(portLayer))
}

runConformance({
  wireLayer: makeConformanceLayer(),
  skipCategories: [
    // The current MSH bridge read path is fetch/catch-up based. True cursor,
    // long-poll, and SSE hardening lands after the CAS foundation.
    "long-poll",
    "stream-cursor",
    "sse",
  ] as never,
})
