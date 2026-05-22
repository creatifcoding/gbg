/** Tests for high-level CAS append orchestration. */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trustProducerId, trustEpoch, trustSeq } from "../../../../src/contracts/Producer.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import {
  BatchPublisher,
  PublishExpectationConflictError,
} from "../../../../src/services/wire/nats-bridge/BatchPublisher.js"
import {
  CasMetadataStore,
  MetadataCasConflictError,
} from "../../../../src/services/wire/nats-bridge/CasMetadataStore.js"
import { appendWithCas } from "../../../../src/services/wire/nats-bridge/CasAppend.js"
import { ShardGuard } from "../../../../src/services/wire/nats-bridge/ShardGuard.js"
import {
  makeInitialMetadata,
  type DurableStreamMetadata,
} from "../../../../src/services/wire/nats-bridge/kernel.js"

const encoder = new TextEncoder()
const bytes = (s: string): Uint8Array => encoder.encode(s)

const streamId = trustStreamId("cas/append")
const contentType = trustContentType("text/plain")
const producerId = trustProducerId("producer.cas")

const makeLayers = (args: {
  readonly get: () => { metadata: DurableStreamMetadata; revision: number } | null
  readonly update: (metadata: DurableStreamMetadata, expectedRevision: number) => Effect.Effect<number, MetadataCasConflictError>
  readonly publish: Parameters<typeof BatchPublisher.of>[0]["publish"]
}) => Layer.mergeAll(
  Layer.succeed(CasMetadataStore)(CasMetadataStore.of({
    get: () => Effect.succeed(args.get()),
    create: () => Effect.fail(new MetadataCasConflictError({
      streamId,
      expectedRevision: 0,
      message: "not used in append tests",
    })),
    updateIfRevision: (_streamId, metadata, expectedRevision) => args.update(metadata, expectedRevision),
    deleteIfRevision: () => Effect.void,
  })),
  Layer.succeed(BatchPublisher)(BatchPublisher.of({ publish: args.publish })),
  ShardGuard.layer({ shardCount: 4 }),
)

describe("appendWithCas", () => {
  it("publishes one batch and commits metadata with the loaded revision", async () => {
    let metadata = makeInitialMetadata({ streamId, contentType, nowMillis: 1 })
    let revision = 1
    const published: Array<{ msgID: string; expected: number }> = []

    const result = await Effect.runPromise(
      appendWithCas({
        streamId,
        contentType,
        messages: [bytes("a"), bytes("bc")],
        producer: { producerId, epoch: trustEpoch(0), seq: trustSeq(0) },
      }).pipe(Effect.provide(makeLayers({
        get: () => ({ metadata, revision }),
        update: (next, expectedRevision) => {
          if (expectedRevision !== revision) {
            return Effect.fail(new MetadataCasConflictError({
              streamId,
              expectedRevision,
              message: "stale revision",
            }))
          }
          metadata = next
          revision += 1
          return Effect.succeed(revision)
        },
        publish: (input) => {
          published.push({ msgID: input.msgID, expected: input.expectedLastSubjectSequence })
          return Effect.succeed({ subjectSequence: 7, duplicate: false })
        },
      }))),
    )

    expect(result.duplicate).toBe(false)
    expect(result.nextOffset).toBe("msh:00000000000000000001_00000000000000000001")
    expect(metadata.lastSubjectSequence).toBe(7)
    expect(metadata.nextSeq).toBe(2)
    expect(metadata.nextByteOffset).toBe(3)
    expect(revision).toBe(2)
    expect(published).toEqual([{ msgID: "lnk.cas%2Fappend.producer.producer.cas.0.0", expected: 0 }])
  })

  it("returns producer duplicates without publishing or committing", async () => {
    const base = makeInitialMetadata({ streamId, contentType, nowMillis: 1 })
    const metadata: DurableStreamMetadata = {
      ...base,
      producers: {
        [producerId as string]: {
          epoch: trustEpoch(0),
          lastSeq: trustSeq(0),
          lastBatchEndOffset: "msh:00000000000000000000_00000000000000000000" as never,
        },
      },
    }
    let publishCalls = 0
    let updateCalls = 0

    const result = await Effect.runPromise(
      appendWithCas({
        streamId,
        messages: [bytes("duplicate body ignored")],
        producer: { producerId, epoch: trustEpoch(0), seq: trustSeq(0) },
      }).pipe(Effect.provide(makeLayers({
        get: () => ({ metadata, revision: 1 }),
        update: () => {
          updateCalls += 1
          return Effect.succeed(2)
        },
        publish: () => {
          publishCalls += 1
          return Effect.succeed({ subjectSequence: 1, duplicate: false })
        },
      }))),
    )

    expect(result.duplicate).toBe(true)
    expect(result.nextOffset).toBe("msh:00000000000000000000_00000000000000000000")
    expect(publishCalls).toBe(0)
    expect(updateCalls).toBe(0)
  })

  it("retries boundedly on publish expectation conflicts", async () => {
    let metadata = makeInitialMetadata({ streamId, contentType, nowMillis: 1 })
    let revision = 1
    let publishCalls = 0

    const result = await Effect.runPromise(
      appendWithCas({
        streamId,
        messages: [bytes("retry")],
      }, { maxAttempts: 2, retryDelayMs: 0 }).pipe(Effect.provide(makeLayers({
        get: () => ({ metadata, revision }),
        update: (next, expectedRevision) => {
          metadata = next
          revision = expectedRevision + 1
          return Effect.succeed(revision)
        },
        publish: (input) => {
          publishCalls += 1
          if (publishCalls === 1) {
            return Effect.fail(new PublishExpectationConflictError({
              streamId,
              expectedLastSubjectSequence: input.expectedLastSubjectSequence,
              message: "tail moved",
            }))
          }
          return Effect.succeed({ subjectSequence: 2, duplicate: false })
        },
      }))),
    )

    expect(result.duplicate).toBe(false)
    expect(publishCalls).toBe(2)
    expect(metadata.lastSubjectSequence).toBe(2)
  })
})
