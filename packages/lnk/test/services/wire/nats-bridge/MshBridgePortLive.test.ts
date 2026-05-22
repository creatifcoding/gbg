/** Tests for concrete MshBridgePortLive composition. */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Stream from "effect-v4/Stream"
import { NatsStreamService } from "@tmnl/msh/nats"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import { BatchPublisher } from "../../../../src/services/wire/nats-bridge/BatchPublisher.js"
import { CasMetadataStore, MetadataCasConflictError } from "../../../../src/services/wire/nats-bridge/CasMetadataStore.js"
import { MshBridgePortLive } from "../../../../src/services/wire/nats-bridge/MshBridgePortLive.js"
import { NatsBridgePort } from "../../../../src/services/wire/nats-bridge/Port.js"
import { ShardGuard } from "../../../../src/services/wire/nats-bridge/ShardGuard.js"
import { type DurableBatchEnvelope, type DurableStreamMetadata } from "../../../../src/services/wire/nats-bridge/kernel.js"

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const bytes = (s: string) => encoder.encode(s)

const collectText = (body: Stream.Stream<Uint8Array, never, never>) =>
  Effect.gen(function* () {
    const chunks = yield* Stream.runCollect(body)
    return chunks.map((chunk) => decoder.decode(chunk)).join("")
  })

const streamId = trustStreamId("live/port")
const contentType = trustContentType("application/json")

const makeHarnessLayer = () => {
  let revision = 0
  let metadata: DurableStreamMetadata | null = null
  let subjectSequence = 0
  const envelopes: DurableBatchEnvelope[] = []
  const ensured: string[] = []

  const storeLayer = Layer.succeed(CasMetadataStore)(CasMetadataStore.of({
    get: () => Effect.succeed(metadata ? { metadata, revision } : null),
    create: (_streamId, next) => {
      if (metadata) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision: 0,
          message: "exists",
        }))
      }
      revision += 1
      metadata = next
      return Effect.succeed(revision)
    },
    updateIfRevision: (_streamId, next, expectedRevision) => {
      if (expectedRevision !== revision) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision,
          message: "stale",
        }))
      }
      revision += 1
      metadata = next
      return Effect.succeed(revision)
    },
    deleteIfRevision: (_streamId, expectedRevision) => {
      if (expectedRevision !== revision) {
        return Effect.fail(new MetadataCasConflictError({
          streamId,
          expectedRevision,
          message: "stale",
        }))
      }
      revision += 1
      metadata = null
      return Effect.void
    },
  }))

  const publisherLayer = Layer.succeed(BatchPublisher)(BatchPublisher.of({
    publish: (input) => {
      subjectSequence += 1
      envelopes.push(input.envelope)
      return Effect.succeed({ subjectSequence, duplicate: false })
    },
  }))

  const streamLayer = Layer.succeed(NatsStreamService)(NatsStreamService.of({
    ensureStream: (config: { readonly name: string }) => {
      ensured.push(config.name)
      return Effect.succeed({ config, state: {} })
    },
    deleteStream: () => Effect.succeed(true),
    getConsumer: () => Effect.succeed({}),
    fetch: () => Effect.succeed(envelopes.map((data, index) => ({
      subject: "_test.lnk.live_2Fport",
      data,
      seq: index + 1,
      time: new Date(0),
      ack: () => Effect.void,
      nak: () => Effect.void,
      working: () => Effect.void,
      term: () => Effect.void,
    }))),
  } as never))

  return {
    layer: MshBridgePortLive.layer({
      subjectRoot: "_test.lnk",
      streamNamePrefix: "TEST_LNK",
      metadataBucket: "TEST_META",
    }).pipe(Layer.provide(Layer.mergeAll(storeLayer, publisherLayer, streamLayer, ShardGuard.layer({ shardCount: 4 })))) as Layer.Layer<NatsBridgePort>,
    snapshot: () => ({ revision, metadata, subjectSequence, envelopes, ensured }),
  }
}

describe("MshBridgePortLive", () => {
  it("creates, appends, reads, metadata-checks, and deletes via CAS seams", async () => {
    const harness = makeHarnessLayer()

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const port = yield* NatsBridgePort
        const created = yield* port.create({
          streamId,
          contentType,
          body: bytes('[{"a":1},{"b":2}]'),
          schemaId: "json@1",
        })
        const appended = yield* port.append({
          streamId,
          contentType,
          body: bytes('{"c":3}'),
        })
        const read = yield* port.read({ streamId, position: "-1" })
        const body = yield* collectText(read.body)
        const head = yield* port.metadata(streamId)
        const deleted = yield* port.delete(streamId)
        return { created, appended, read, body, head, deleted }
      }).pipe(Effect.provide(harness.layer)),
    )

    expect(result.created).toMatchObject({
      streamId,
      contentType,
      created: true,
      closed: false,
      schemaId: "json@1",
    })
    expect(result.created.nextOffset).toBe("msh:00000000000000000001_00000000000000000007")
    expect(result.appended.nextOffset).toBe("msh:00000000000000000002_00000000000000000014")
    expect(result.body).toBe('[{"a":1},{"b":2},{"c":3}]')
    expect(result.read.upToDate).toBe(true)
    expect(result.head.nextOffset).toBe(result.appended.nextOffset)
    expect(result.deleted.deleted).toBe(true)
    expect(harness.snapshot().ensured).toContain("TEST_LNK_live_2Fport")
  })
})
