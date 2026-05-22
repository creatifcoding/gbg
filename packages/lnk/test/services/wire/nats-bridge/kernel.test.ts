/**
 * Pure Durable Stream kernel tests for the MSH-backed bridge.
 *
 * These tests lock the LNK-owned semantics before the live MSH substrate is
 * wired in. MSH will provide typed KV CAS and JetStream publish; this kernel
 * decides what metadata transition is legal. Architecture with teeth, Prime.
 */

import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import { trust as trustContentType } from "../../../../src/contracts/ContentType.js"
import { trustProducerId, trustEpoch, trustSeq } from "../../../../src/contracts/Producer.js"
import { trust as trustStreamId } from "../../../../src/contracts/StreamId.js"
import {
  DurableStreamMetadata,
  decodeMshOffset,
  makeInitialMetadata,
  makeMshOffset,
  planAppend,
  planCreate,
  positionToStartSeq,
} from "../../../../src/services/wire/nats-bridge/kernel.js"

const encoder = new TextEncoder()
const bytes = (s: string): Uint8Array => encoder.encode(s)

const streamId = trustStreamId("kernel/test")
const textPlain = trustContentType("text/plain")
const json = trustContentType("application/json")
const producerId = trustProducerId("producer.a")

describe("DurableStreamKernel", () => {
  it("defines schema-backed metadata and opaque MSH offsets", () => {
    const metadata = makeInitialMetadata({
      streamId,
      contentType: textPlain,
      streamClosed: true,
      ttl: 30,
      expiresAt: "2030-01-01T00:00:00.000Z",
      schemaId: "example@1.0.0",
      nowMillis: 123,
    })

    const encoded = Schema.encodeUnknownSync(DurableStreamMetadata)(metadata)
    const decoded = Schema.decodeUnknownSync(DurableStreamMetadata)(encoded)

    expect(decoded).toEqual(metadata)
    expect(metadata.closed).toBe(true)
    expect(metadata.nextSeq).toBe(0)
    expect(metadata.lastSubjectSequence).toBe(0)

    const offset = makeMshOffset(42, 9001)
    expect(offset).toBe("msh:00000000000000000042_00000000000000009001")
    expect(decodeMshOffset(offset)).toEqual({ seq: 42, byteOffset: 9001 })
    expect(positionToStartSeq(offset, metadata)).toBe(43)
    expect(positionToStartSeq("-1", metadata)).toBe(0)
    expect(positionToStartSeq("now", metadata)).toBe("now")
  })

  it("plans idempotent create, close-on-reput, and config mismatch", async () => {
    const created = await Effect.runPromise(
      planCreate(null, { streamId, contentType: textPlain, nowMillis: 1 }),
    )

    expect(created.created).toBe(true)
    expect(created.needsCommit).toBe(true)
    expect(created.metadata.closed).toBe(false)

    const idempotent = await Effect.runPromise(
      planCreate(created.metadata, { streamId, contentType: textPlain }),
    )
    expect(idempotent.created).toBe(false)
    expect(idempotent.needsCommit).toBe(false)
    expect(idempotent.metadata).toBe(created.metadata)

    const close = await Effect.runPromise(
      planCreate(created.metadata, {
        streamId,
        contentType: textPlain,
        streamClosed: true,
      }),
    )
    expect(close.created).toBe(false)
    expect(close.needsCommit).toBe(true)
    expect(close.metadata.closed).toBe(true)

    const mismatch = await Effect.runPromise(
      planCreate(created.metadata, { streamId, contentType: json }).pipe(Effect.result),
    )
    expect(mismatch._tag).toBe("Failure")
    if (mismatch._tag === "Failure") {
      expect(mismatch.failure._tag).toBe("StreamConfigMismatchError")
    }
  })

  it("plans publish batches with producer idempotency and CAS commit metadata", async () => {
    const metadata = makeInitialMetadata({ streamId, contentType: textPlain, nowMillis: 1 })

    const first = await Effect.runPromise(
      planAppend(metadata, {
        streamId,
        contentType: textPlain,
        messages: [bytes("a"), bytes("bc")],
        producer: {
          producerId,
          epoch: trustEpoch(0),
          seq: trustSeq(0),
        },
        streamSeq: "0001",
      }),
    )

    expect(first._tag).toBe("Publish")
    if (first._tag !== "Publish") throw new Error("expected publish plan")
    expect(first.expectedLastSubjectSequence).toBe(0)
    expect(first.envelope.messages.map((m) => m.offset)).toEqual([
      "msh:00000000000000000000_00000000000000000000",
      "msh:00000000000000000001_00000000000000000001",
    ])
    expect(first.envelope.messages.map((m) => m.byteLength)).toEqual([1, 2])
    expect(first.result.nextOffset).toBe("msh:00000000000000000001_00000000000000000001")
    expect(first.msgID).toContain("producer.producer.a.0.0")

    const committed = first.commit({ subjectSequence: 12 })
    expect(committed.nextSeq).toBe(2)
    expect(committed.nextByteOffset).toBe(3)
    expect(committed.lastSubjectSequence).toBe(12)
    expect(committed.lastOffset).toBe(first.result.nextOffset)
    expect(committed.producers[producerId as string]).toMatchObject({
      epoch: trustEpoch(0),
      lastSeq: trustSeq(0),
      lastBatchEndOffset: first.result.nextOffset,
    })

    const duplicate = await Effect.runPromise(
      planAppend(committed, {
        streamId,
        messages: [bytes("DIFFERENT")],
        producer: {
          producerId,
          epoch: trustEpoch(0),
          seq: trustSeq(0),
        },
      }),
    )

    expect(duplicate._tag).toBe("Duplicate")
    expect(duplicate.result.duplicate).toBe(true)
    expect(duplicate.result.nextOffset).toBe(first.result.nextOffset)
    expect(duplicate.result.producerSeq).toBe(trustSeq(0))

    const gap = await Effect.runPromise(
      planAppend(committed, {
        streamId,
        messages: [bytes("gap")],
        producer: {
          producerId,
          epoch: trustEpoch(0),
          seq: trustSeq(2),
        },
      }).pipe(Effect.result),
    )
    expect(gap._tag).toBe("Failure")
    if (gap._tag === "Failure") {
      expect(gap.failure._tag).toBe("SequenceGapError")
    }
  })

  it("plans close-only CAS transitions without publishing", async () => {
    const metadata = makeInitialMetadata({ streamId, contentType: textPlain, nowMillis: 1 })

    const closeOnly = await Effect.runPromise(
      planAppend(metadata, {
        streamId,
        messages: [],
        streamClosed: true,
      }),
    )

    expect(closeOnly._tag).toBe("MetadataOnly")
    expect(closeOnly.result.closed).toBe(true)
    expect(closeOnly.result.duplicate).toBe(false)
    expect(closeOnly.metadata.closed).toBe(true)

    const duplicateClose = await Effect.runPromise(
      planAppend(closeOnly.metadata, {
        streamId,
        messages: [],
        streamClosed: true,
      }),
    )

    expect(duplicateClose._tag).toBe("Duplicate")
    expect(duplicateClose.result.duplicate).toBe(true)

    const appendAfterClose = await Effect.runPromise(
      planAppend(closeOnly.metadata, {
        streamId,
        messages: [bytes("late")],
      }).pipe(Effect.result),
    )
    expect(appendAfterClose._tag).toBe("Failure")
    if (appendAfterClose._tag === "Failure") {
      expect(appendAfterClose.failure._tag).toBe("StreamClosedError")
    }
  })
})
